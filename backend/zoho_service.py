"""Zoho WorkDrive data provider (PRIMARY, live source of truth).

Reads the pricing master .xlsx from a Zoho WorkDrive public download link,
worksheet "Precios Actual", table `_202606_Precios`. READ-ONLY.

The custom-domain share URL returns the WorkDrive viewer HTML, which embeds the
real download coordinates (resourceId, linkId, download server). We extract those
and fetch the actual bytes from:
  {DOWNLOADSERVER}/public/workdrive-external/download/{resourceId}?x-cli-msg={"linkId":"..."}

Robust validation:
  - HTTP 200 + Excel content-type + PK/zip signature (reject HTML/preview/login).
  - Required worksheet AND table must exist (parse_workbook enforces).
  - Empty/corrupt parse -> raise (caller keeps last valid dataset).

To rotate the weekly link, just update ZOHO_SHARE_URL — no app logic changes.
An OAuth self-client fallback is available if ever needed.
"""

import os
import re
import json
import logging
from urllib.parse import quote

import httpx

from workbook_parser import parse_workbook

logger = logging.getLogger("venege.zoho")

WORKSHEET = "Precios Actual"
TABLE = "_202606_Precios"
DEFAULT_SHARE_URL = (
    "https://workdrive.venegeca.com/external/"
    "2a3d8f1e9391b727aa12eb8506abf7d3803bc7fdc0f625cd629b806d2a49c276/download"
)
EXCEL_CT = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


class ZohoWorkDriveService:
    def __init__(self):
        self.worksheet = os.environ.get("ZOHO_WORKSHEET", WORKSHEET)
        self.table = os.environ.get("ZOHO_TABLE", TABLE)
        self.share_url = os.environ.get("ZOHO_SHARE_URL", DEFAULT_SHARE_URL)

    def is_configured(self) -> bool:
        return bool(self.share_url)

    def _oauth_ready(self) -> bool:
        return all(os.environ.get(k) for k in ("ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN", "ZOHO_RESOURCE_ID"))

    def missing_setup(self):
        return [] if self._oauth_ready() else ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN", "ZOHO_RESOURCE_ID"]

    @staticmethod
    def _is_excel(resp: httpx.Response) -> bool:
        ct = resp.headers.get("content-type", "").lower()
        return resp.status_code == 200 and (EXCEL_CT in ct or "octet-stream" in ct) and resp.content[:2] == b"PK"

    async def _download_public(self, client: httpx.AsyncClient) -> bytes:
        headers = {
            "User-Agent": "Mozilla/5.0 (venege-precios/1.0)",
            "Accept": f"{EXCEL_CT},*/*",
        }
        # 1) Fetch the share/download URL. It may return the xlsx directly, or the
        #    WorkDrive viewer HTML that embeds the real download coordinates.
        r = await client.get(self.share_url, headers=headers)
        if self._is_excel(r):
            return r.content
        html = r.content.decode("utf-8", "ignore") if r.content else ""
        if not html:
            raise RuntimeError(f"public_download_unavailable: status={r.status_code}")

        def find(key):
            m = re.search(re.escape(key) + r'["\']?\s*[:=]\s*["\']([^"\']+)["\']', html)
            return m.group(1) if m else None

        rid = find("resourceId") or find("RESOURCE_ID")
        link_id = find("linkId") or find("LINK_ID")
        server = find("DOWNLOADSERVER_URL") or "https://files-accl.zohoexternal.com"
        if not rid or not link_id:
            raise RuntimeError("public_download_unavailable: no download coordinates in page")

        x_cli = quote(json.dumps({"linkId": link_id}))
        dl_url = f"{server.rstrip('/')}/public/workdrive-external/download/{rid}?x-cli-msg={x_cli}"
        ref = {"Referer": self.share_url, "Origin": self.share_url.split("/external/")[0]}
        r2 = await client.get(dl_url, headers={**headers, **ref})
        if not self._is_excel(r2):
            raise RuntimeError(f"public_download_unavailable: dl status={r2.status_code} ct={r2.headers.get('content-type')}")
        return r2.content

    async def _download_oauth(self, client: httpx.AsyncClient) -> bytes:
        accounts = os.environ.get("ZOHO_ACCOUNTS_DOMAIN", "https://accounts.zoho.com").rstrip("/")
        api = os.environ.get("ZOHO_API_DOMAIN", "https://www.zohoapis.com").rstrip("/")
        tok = await client.post(
            f"{accounts}/oauth/v2/token",
            data={
                "refresh_token": os.environ["ZOHO_REFRESH_TOKEN"],
                "client_id": os.environ["ZOHO_CLIENT_ID"],
                "client_secret": os.environ["ZOHO_CLIENT_SECRET"],
                "grant_type": "refresh_token",
            },
        )
        if tok.status_code != 200 or "access_token" not in tok.json():
            raise RuntimeError(f"zoho_token_failed: {tok.status_code}: {tok.text[:200]}")
        j = tok.json()
        access = j["access_token"]
        api = j.get("api_domain", api).rstrip("/")
        rid = os.environ["ZOHO_RESOURCE_ID"]
        r = await client.get(
            f"{api}/workdrive/api/v1/download/{rid}",
            headers={"Authorization": f"Zoho-oauthtoken {access}", "Accept": "application/octet-stream"},
        )
        if not self._is_excel(r):
            raise RuntimeError(f"zoho_api_download_failed: {r.status_code}")
        return r.content

    async def fetch_rows(self):
        """Return validated, mapped product rows from Zoho (live). Raises with a
        diagnostic reason; never returns partial/empty silently."""
        if not self.is_configured():
            return None
        async with httpx.AsyncClient(timeout=120, follow_redirects=True) as client:
            content = None
            public_error = None
            try:
                content = await self._download_public(client)
                logger.info("Zoho public download OK (%d bytes)", len(content))
            except Exception as e:
                public_error = str(e)
                logger.info("Zoho public download failed: %s", public_error)
            if content is None:
                if self._oauth_ready():
                    content = await self._download_oauth(client)
                else:
                    raise RuntimeError(f"download_not_enabled: {public_error}")
        rows = parse_workbook(content, self.worksheet, self.table, require_table=True)
        if not rows:
            raise RuntimeError("empty_dataset")
        return rows

    async def sync(self, db, build_mock_products, normalize):
        """Full source synchronization. Replaces data ONLY with a validated,
        non-empty live dataset; otherwise raises so the caller keeps last valid data."""
        rows = await self.fetch_rows()
        if not rows:
            raise RuntimeError("empty_dataset")
        for p in rows:
            p["search_blob"] = " ".join([
                normalize(p["sku"]), normalize(p["marca"]),
                normalize(p["descripcion"]), normalize(str(p["rin"])),
            ])
        await db.products.delete_many({})
        await db.products.insert_many(rows)
        return {"source": "zoho:Precios Actual", "row_count": len(rows), "worksheet": self.worksheet}
