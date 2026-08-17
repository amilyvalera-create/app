# PRD — Lista de Precios VENEGE

## Original problem statement
Premium, mobile-first + desktop-ready pricing consultation app for a Venezuelan tire
distributor. Sales users and special customers log in and search products by SKU / MARCA /
DESCRIPCIÓN and instantly see ONLY the price columns their role is authorized to view.
Data source = Microsoft OneDrive for Business Excel workbook, worksheet "202607" only.
Read-only phase 1. Prepared for phase-2 inventory + Zoho. Dark premium VENEGE-branded UI.
All user-facing text in Spanish.

## Architecture
- **Frontend**: Expo Router (React Native, runs on mobile + web). Auth stack + `(app)` route
  group guarded by `AuthContext`. Screens: `login`, `(app)/home`, `(app)/result`,
  `(app)/master`. Design tokens in `src/theme/tokens.ts`. Fonts: BebasNeue (display) + Inter
  (body) via expo-font. Keyboard via react-native-keyboard-controller.
- **Backend**: FastAPI + Motor (MongoDB). JWT (PyJWT, HS256) auth, bcrypt password hashing.
  All routes under `/api`. Server-side role → column authorization is the security boundary.
  - `schema.py` = single source of truth: exact column map (A..S, AC..AF), role→columns matrix,
    Spanish labels, currency derivation.
  - `mock_data.py` = 46 seeded tire products following the exact workbook schema + fixed users.
  - `onedrive_service.py` = isolated Microsoft Graph/OneDrive integration layer (mock fallback).
- **DB collections**: users, products, search_history (per user, last 6), global_activity, meta.

## User personas
- Sales rep (regional role): searches products, sees only their region's authorized prices.
- Special customer (e.g. Tires Center): sees only their assigned price columns.
- Master/Admin (Admon): sees all prices + admin panel (sync, timestamp, global activity).

## Core requirements (static)
- Fixed credentials + 6 roles with exact column mappings (see test_credentials.md). ✅
- Role-based price columns enforced SERVER-SIDE (URL tampering cannot reveal others). ✅
- Search by SKU/MARCA/DESCRIPCIÓN, accent+case insensitive, deduped by SKU, autocomplete. ✅
- Prices formatted to exactly 2 decimals; blank/null → "No disponible". ✅
- Per-user last-6 search history; global feed for master. ✅
- Refresh for all users (reloads view); full sync + last-sync timestamp master-only. ✅
- Read-only phase 1; OneDrive integration-ready with single pending setup item. ✅
- Spanish UI everywhere; friendly error/empty/loading states. ✅
- Consultar inventario = phase-2 placeholder modal (no fabricated inventory). ✅

## Implemented (2026-08-11) — Production update (worksheet "Precios Actual")
- Corrected production column mapping (schema v2): I,J,K Caracas · L,M,N Oriente Sur · O,P,Q
  Oriente Norte · R,S Panofre · AE,AF,AG TiresCenter (TCC/TTC) · AC,AD OTROS master-only.
  TiresCenter NEVER uses OTROS. Verified by 49 backend tests.
- Live OneDrive provider: `onedrive_service.py` does Microsoft Graph app-only (client
  credentials) + `/shares/{id}/driveItem/content` download + openpyxl parse of "Precios
  Actual", mapping strictly by column letter. Falls back to schema-accurate mock when
  MS_* creds are unset. Auto-refresh scheduler runs ~3x/day (no-op without creds).
- UX: quick filters (RIN + MARCA chip rows), per-user favorites (pin/unpin), WhatsApp
  share quotation with VENEGE branding, refined transparent logo mark (no box).

## PHASE 1 REFINEMENTS (2026-08-17)
- New named users + composite roles (see test_credentials.md): gerencia+Admon (master),
  roilan=caracas_tirescenter, adriana=caracas_panofre, andrea.casanova=caracas,
  andrea.manrique=oriente_sur, mariateresa=oriente_norte.
- Costs (E–H) HIDDEN for ALL roles incl. master; master shows all SELLING blocks only.
- Added selling price "Precio BF Goodrich" = column AM header "BF VIP_VIP_143" (resolved by
  header text) to every authorized view; "No disponible" when empty (~47 SKUs carry it).
- Header: reduced logo, time-based greeting + first name; subtle "Actualizado" timestamp
  (GET /api/status). Recent searches capped at 5; favorites separate.
- Quick filters (RIN + MARCA) + "Limpiar filtros"; product cards 2-line clamp.
- Tap any price to copy (expo-clipboard) with toast; BF tile highlighted.
- Cotizar flow (QuoteModal): recipient + seller phone, multi-item with price picker + qty,
  add items via search, premium branded PDF (expo-print + expo-sharing). Disabled
  "Agregar a pedido" + disabled inventory traffic-light placeholders (Phase 2).
- Verified: 43/43 backend tests + full E2E on LIVE Zoho (iteration_4). No costs anywhere.

## LIVE ✅ (2026-08-14) — Zoho WorkDrive direct download connected
- Direct-download link works: the custom-domain `/download` serves the WorkDrive viewer HTML,
  from which the provider extracts `resourceId` + `linkId` and downloads the real .xlsx from
  `files-accl.zohoexternal.com/public/workdrive-external/download/{resourceId}?x-cli-msg={"linkId":..}`.
- Validation: only accepts Excel content-type + PK signature (rejects HTML/preview/login),
  requires sheet "Precios Actual" + table "_202606_Precios", rejects empty parse; on any
  failure keeps the last valid dataset and shows Admin a Spanish error.
- Verified: 433 records loaded; real SKUs (e.g. FIRESTONE ANV1093); RBAC intact; 51/51 backend
  tests + full E2E pass (iteration_3). Auto-refresh every 6h; manual refresh all; full sync Admin only.
- Weekly rotation: update ZOHO_SHARE_URL only.

## SOURCE OF TRUTH SWITCHED → Zoho WorkDrive (2026-08-14)
- Primary provider is now `zoho_service.ZohoWorkDriveService` (OneDrive kept but secondary).
  Env: ZOHO_SHARE_URL (weekly-replaceable), ZOHO_WORKSHEET="Precios Actual",
  ZOHO_TABLE="_202606_Precios". Auto-refresh every 6 hours; shared parser in
  `workbook_parser.py` keeps the exact column mapping/business logic for every source.
- Two read modes: (1) PUBLIC `<share>/download` (needs "Allow download" enabled on the
  external link) — preferred, zero creds; (2) OAUTH self-client fallback
  (ZOHO_CLIENT_ID/SECRET/REFRESH_TOKEN/RESOURCE_ID via www.zohoapis.com).
- BLOCKER: the external link currently returns the HTML viewer for `/download` (200 text/html),
  i.e. direct download is NOT enabled (view-only) — so live read fails and the app serves
  schema-accurate reference data. Master panel shows the exact Spanish reason.
- TO GO LIVE (single user-side action, no app changes): EITHER enable "Allow download" on the
  Zoho WorkDrive external link (owner: Share → Manage external link → Edit → Allow download),
  OR provide Zoho OAuth self-client creds (WorkDrive.files.READ) + the file RESOURCE_ID.
- When the weekly link changes: just update ZOHO_SHARE_URL (Deployment → Secrets); nothing else.

## LIVE CONNECTION STATUS (2026-08-11) — OneDrive attempt (now secondary)
- OAuth token: ✅ works (tenant e98f980c…, client fc11a183…, real secret VALUE).
- Workbook read: ❌ blocked by Microsoft with `400 BadRequest: "Tenant does not have a
  SPO license."` The share resolves to `onedrive.live.com/personal/…` → the file lives on a
  PERSONAL (consumer) OneDrive, which an app-only (client-credentials) token for a business
  tenant cannot read. App-only Graph reads require the file on the tenant's OneDrive for
  Business / SharePoint (tenant must have a SharePoint Online license).
- Resolution options (user action on Microsoft side; NO app changes needed):
  1. Upload "Maestro Precios N.xlsx" to the corporate OneDrive for Business in tenant
     e98f980c… (tenant needs a SharePoint/OneDrive for Business license), re-share, update
     ONEDRIVE_SHARE_URL → live read works immediately.
  2. OR keep it on personal OneDrive but switch to a delegated OAuth flow with that consumer
     account (interactive sign-in) — different auth model.
- Meanwhile the app serves schema-accurate reference data; the master panel shows the exact
  Spanish reason and connection_ready=false (honest status).

## PENDING SETUP (single item) to go LIVE
Set these backend secrets (Deployment → Secrets), then master taps "Actualizar datos":
  MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET  (Entra app registration, Files.Read.All +
  admin consent). ONEDRIVE_SHARE_URL + MS_WORKSHEET="Precios Actual" already set.
Note: the 1drv.ms link is a OneDrive for Business share — anonymous download is blocked, so
Microsoft Graph OAuth (above 3 secrets) is required. No app logic changes needed afterward.

## Implemented (2026-08-10)
- Secure JWT login for all 6 seeded roles; bcrypt hashing; 401/403 enforcement.
- Server-side column authorization (verified: caracas 4, oriente_sur 3, oriente_norte 2,
  panofre 2, tires_center 4, master 19) — validated by 41 passing backend tests.
- Premium dark VENEGE UI: branded login (hero + glass card), search home with big search bar +
  autocomplete + recent searches, product result with price tiles (Precio N badges, $/Bs),
  master admin panel (sync, timestamp, stats, global searches feed).
- Responsive: mobile single-column + desktop centered multi-column grid.
- OneDrive service layer stubbed with mock fallback + "Conexión OneDrive pendiente" banner.

## Pending setup item (single)
Connect the corporate Microsoft account (env secrets: MS_TENANT_ID, MS_CLIENT_ID,
MS_CLIENT_SECRET, MS_DRIVE_ID, MS_WORKBOOK_ITEM_ID, MS_WORKSHEET=202607) to read worksheet
"202607" live. Until then, schema-accurate mock data is served. No business logic changes needed.

## Backlog / next (P1/P2)
- P1: Wire real Microsoft Graph read-only fetch in `onedrive_service.fetch_rows()`.
- P2: Inventory consultation (real quantities) + Zoho integration (service layer ready).
- P2: Export/share a price quote; filter by RIN/marca on search home.
