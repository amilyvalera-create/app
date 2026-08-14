"""Zoho WorkDrive data provider (PRIMARY source of truth).

Reads the pricing master .xlsx from a Zoho WorkDrive public external share link,
worksheet "Precios Actual", table `_202606_Precios`. READ-ONLY.

Two modes (auto):
  1. PUBLIC  — GET <share-url>/download (works only if the external link has
     "Allow download" enabled). Preferred, zero credentials, survives weekly
     re-uploads to the SAME link.
  2. OAUTH   — official WorkDrive API self-client (refresh token) as a robust
     fallback if the public link cannot be downloaded unattended.

When the link changes, just update ZOHO_SHARE_URL — no app logic changes.
"""

import os
import logging

import httpx

from workbook_parser import parse_workbook

logger = logging.getLogger("venege.zoho")

WORKSHEET = "Precios Actual"
TABLE = "_202606_Precios"
DEFAULT_SHARE_URL = (
    "https://workdrive.venegeca.com/external/"
    "42b7f9b156fb025e5e429c6e563f205e59b5098b9d2aaab4a8e318fd82a60668"
)


class ZohoWorkDriveService:
    def __init__(self):
        self.worksheet = os.environ.get("ZOHO_WORKSHEET", WORKSHEET)
        self.table = os.environ.get("ZOHO_TABLE", TABLE)
        self.share_url = os.environ.get("ZOHO_SHARE_URL", DEFAULT_SHARE_URL)

    # A share link is always present, so public mode is always attemptable.
    def is_configured(self) -> bool:
        return bool(self.share_url)

    def _oauth_ready(self) -> bool:
        return all(os.environ.get(k) for k in ("ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN", "ZOHO_RESOURCE_ID"))

    def missing_setup(self):
        # If public download works we need nothing; otherwise these enable OAuth.
        return [] if self._oauth_ready() else ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN", "ZOHO_RESOURCE_ID"]

    async def _download_public(self, client: httpx.AsyncClient) -> bytes:
        url = self.share_url.rstrip("/") + "/download"
        headers = {
            "User-Agent": "venege-precios/1.0",
            "Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
        }
        r = await client.get(url, headers=headers)
        ctype = r.headers.get("content-type", "").lower()
        if r.status_code != 200 or ctype.startswith("text/html") or not r.content.startswith(b"PK"):
            raise RuntimeError(f"public_download_unavailable: status={r.status_code} ctype={ctype}")
        return r.content

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
        if r.status_code != 200 or not r.content.startswith(b"PK"):
            raise RuntimeError(f"zoho_api_download_failed: {r.status_code}: {r.text[:200]}")
        return r.content

    async def fetch_rows(self):
        """Return mapped product rows from Zoho, or None if not configured.
        Tries public link first, then OAuth. Raises with a diagnostic reason."""
        if not self.is_configured():
            return None
        async with httpx.AsyncClient(timeout=90, follow_redirects=True) as client:
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
                    logger.info("Zoho OAuth download OK (%d bytes)", len(content))
                else:
                    raise RuntimeError(f"download_not_enabled: {public_error}")
        return parse_workbook(content, self.worksheet, self.table)

    async def sync(self, db, build_mock_products, normalize):
        """Full source synchronization. Live Zoho when possible; else mock fallback."""
        rows = await self.fetch_rows()
        source = "zoho:Precios Actual" if rows is not None else "mock"
        products = rows if rows is not None else build_mock_products()
        for p in products:
            p["search_blob"] = " ".join([
                normalize(p["sku"]), normalize(p["marca"]),
                normalize(p["descripcion"]), normalize(str(p["rin"])),
            ])
        if products:
            await db.products.delete_many({})
            await db.products.insert_many(products)
        return {"source": source, "row_count": len(products), "worksheet": self.worksheet}
