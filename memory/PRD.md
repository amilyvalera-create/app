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
