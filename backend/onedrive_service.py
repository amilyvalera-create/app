"""Microsoft OneDrive for Business / Microsoft Graph integration layer.

Phase 1 is READ-ONLY and, until corporate Microsoft OAuth credentials are
provided, falls back to the seeded MOCK dataset. This service is intentionally
isolated so that connecting the real workbook (worksheet "202607") later does
NOT require changes to authentication, role logic, search or the UI.

REQUIRED SETUP (single pending item) — provide these as secure env secrets:
  - MS_TENANT_ID          Azure AD tenant id of the corporate account
  - MS_CLIENT_ID          App registration (application) client id
  - MS_CLIENT_SECRET      App registration client secret
  - MS_DRIVE_ID           OneDrive for Business drive id (corporate account)
  - MS_WORKBOOK_ITEM_ID   Item id (or path) of the approved Excel workbook
  - MS_WORKSHEET          Worksheet name (must be "202607")

Only read-only Microsoft Graph scopes are used (Files.Read.All / Sites.Read.All).
The app never edits, deletes, moves, renames or shares the workbook.
"""

import os
import logging

logger = logging.getLogger("venege.onedrive")

WORKSHEET = "202607"

_REQUIRED_KEYS = [
    "MS_TENANT_ID",
    "MS_CLIENT_ID",
    "MS_CLIENT_SECRET",
    "MS_DRIVE_ID",
    "MS_WORKBOOK_ITEM_ID",
]


class OneDriveService:
    def __init__(self):
        self.worksheet = os.environ.get("MS_WORKSHEET", WORKSHEET)

    def is_configured(self) -> bool:
        """True only when every required Microsoft secret is present."""
        return all(os.environ.get(k) for k in _REQUIRED_KEYS)

    def missing_setup(self):
        return [k for k in _REQUIRED_KEYS if not os.environ.get(k)]

    async def fetch_rows(self):
        """Fetch and map worksheet "202607" rows from Microsoft Graph.

        Not yet wired because corporate OAuth credentials are pending. When
        configured, this reads the approved worksheet read-only and maps the
        exact columns from schema.PRICE_COLUMNS. Returns None to signal the
        caller to use the mock fallback.
        """
        if not self.is_configured():
            logger.info("OneDrive not configured; using mock fallback. Missing: %s", self.missing_setup())
            return None
        # Placeholder for the real Graph call (read-only). Kept intentionally
        # inert until credentials are provided to avoid fabricating data.
        logger.info("OneDrive configured but Graph fetch not enabled in phase 1.")
        return None

    async def sync(self, db, build_mock_products, normalize):
        """Full source synchronization (master only).

        Uses the real worksheet when configured; otherwise reseeds the mock
        dataset that mirrors the approved schema. Returns metadata for the panel.
        """
        rows = await self.fetch_rows()
        source = "onedrive:202607" if rows is not None else "mock"
        products = rows if rows is not None else build_mock_products()

        for p in products:
            p["search_blob"] = " ".join([
                normalize(p["sku"]), normalize(p["marca"]),
                normalize(p["descripcion"]), normalize(str(p["rin"])),
            ])

        await db.products.delete_many({})
        if products:
            await db.products.insert_many(products)

        return {"source": source, "row_count": len(products), "worksheet": self.worksheet}
