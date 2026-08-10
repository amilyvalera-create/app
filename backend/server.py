"""Lista de Precios VENEGE - Backend API.

Phase 1: read-only pricing consultation with role-based column authorization.
Data source is currently seeded MOCK data that strictly follows the approved
workbook schema (worksheet "202607"). The OneDrive/Microsoft Graph integration
layer is isolated in `onedrive_service.py` so it can be plugged in later WITHOUT
touching auth, roles, search or the UI.
"""

import os
import logging
import unicodedata
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List

import jwt
import bcrypt
from fastapi import FastAPI, APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

from schema import (
    PRICE_COLUMNS,
    ROLE_COLUMN_MAP,
    ROLE_LABELS,
    column_currency,
    column_label,
)
from mock_data import build_mock_products, SEED_USERS
from onedrive_service import OneDriveService

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("venege")

# ---------------------------------------------------------------------------
# Config / DB
# ---------------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ.get("JWT_SECRET", "venege-dev-secret-change-me")
JWT_ALGO = "HS256"
JWT_EXPIRE_HOURS = 12

app = FastAPI(title="Lista de Precios VENEGE")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

onedrive = OneDriveService()


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(username: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": username,
        "role": role,
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def normalize(text) -> str:
    """Case + accent insensitive normalization for forgiving search."""
    if text is None:
        return ""
    text = unicodedata.normalize("NFKD", str(text))
    text = "".join(c for c in text if not unicodedata.combining(c))
    return text.lower().strip()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class LoginRequest(BaseModel):
    username: str
    password: str


class SearchLog(BaseModel):
    sku: str
    marca: str
    descripcion: str


class CurrentUser(BaseModel):
    username: str
    role: str


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------
async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> CurrentUser:
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=401, detail="No autorizado")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
        username = payload["sub"]
        role = payload["role"]
    except Exception:
        raise HTTPException(status_code=401, detail="Sesión expirada")

    user = await db.users.find_one({"username": username})
    if not user or user.get("role") != role:
        raise HTTPException(status_code=401, detail="No autorizado")
    return CurrentUser(username=username, role=role)


async def require_master(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role != "master":
        raise HTTPException(status_code=403, detail="Acceso restringido")
    return user


def authorized_columns(role: str) -> List[str]:
    """Server-side source of truth for which price columns a role may read."""
    if role == "master":
        return [c["key"] for c in PRICE_COLUMNS]
    return ROLE_COLUMN_MAP.get(role, [])


def build_price_payload(product: dict, role: str) -> List[dict]:
    allowed = authorized_columns(role)
    prices = product.get("prices", {})
    payload = []
    position = 0
    for col in PRICE_COLUMNS:
        key = col["key"]
        if key not in allowed:
            continue
        position += 1
        raw = prices.get(key, None)
        value = None
        if raw is not None:
            try:
                value = round(float(raw), 2)
            except (ValueError, TypeError):
                value = None
        payload.append({
            "key": key,
            "column": col["letter"],
            "label": column_label(key),
            "currency": column_currency(key),
            "position": position,
            "value": value,
        })
    return payload


# ---------------------------------------------------------------------------
# Routes: auth
# ---------------------------------------------------------------------------
@api_router.post("/auth/login")
async def login(body: LoginRequest):
    user = await db.users.find_one({"username": body.username})
    dummy = "$2b$12$" + "x" * 53
    stored = user["password_hash"] if user else dummy
    valid = verify_password(body.password, stored)
    if not user or not valid:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    token = create_token(user["username"], user["role"])
    allowed = authorized_columns(user["role"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "username": user["username"],
            "role": user["role"],
            "role_label": ROLE_LABELS.get(user["role"], user["role"]),
            "is_master": user["role"] == "master",
            "authorized_price_count": len(allowed),
        },
    }


@api_router.get("/auth/me")
async def me(user: CurrentUser = Depends(get_current_user)):
    return {
        "username": user.username,
        "role": user.role,
        "role_label": ROLE_LABELS.get(user.role, user.role),
        "is_master": user.role == "master",
        "authorized_price_count": len(authorized_columns(user.role)),
    }


# ---------------------------------------------------------------------------
# Routes: search + product
# ---------------------------------------------------------------------------
@api_router.get("/products/search")
async def search_products(q: str = "", limit: int = 12, user: CurrentUser = Depends(get_current_user)):
    """Autocomplete: matches SKU / MARCA / DESCRIPCION. Never returns prices."""
    nq = normalize(q)
    cursor = db.products.find({}, {"_id": 0, "sku": 1, "rin": 1, "marca": 1, "descripcion": 1, "search_blob": 1})
    docs = await cursor.to_list(2000)

    if nq:
        matched = [d for d in docs if nq in d.get("search_blob", "")]
    else:
        matched = docs

    seen = set()
    results = []
    for d in matched:
        if d["sku"] in seen:
            continue
        seen.add(d["sku"])
        results.append({
            "sku": d["sku"],
            "rin": d["rin"],
            "marca": d["marca"],
            "descripcion": d["descripcion"],
        })
        if len(results) >= limit:
            break
    return {"results": results, "count": len(results)}


@api_router.get("/products/{sku}")
async def get_product(sku: str, user: CurrentUser = Depends(get_current_user)):
    product = await db.products.find_one({"sku": sku}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    prices = build_price_payload(product, user.role)
    return {
        "sku": product["sku"],
        "rin": product["rin"],
        "marca": product["marca"],
        "descripcion": product["descripcion"],
        "prices": prices,
    }


# ---------------------------------------------------------------------------
# Routes: per-user recent search history (last 6)
# ---------------------------------------------------------------------------
@api_router.get("/history")
async def get_history(user: CurrentUser = Depends(get_current_user)):
    doc = await db.search_history.find_one({"username": user.username}, {"_id": 0, "items": 1})
    return {"items": (doc or {}).get("items", [])}


@api_router.post("/history")
async def add_history(entry: SearchLog, user: CurrentUser = Depends(get_current_user)):
    item = {
        "sku": entry.sku,
        "marca": entry.marca,
        "descripcion": entry.descripcion,
        "at": datetime.now(timezone.utc).isoformat(),
    }
    await db.search_history.update_one(
        {"username": user.username},
        {"$pull": {"items": {"sku": entry.sku}}},
    )
    await db.search_history.update_one(
        {"username": user.username},
        {"$push": {"items": {"$each": [item], "$position": 0, "$slice": 6}}},
        upsert=True,
    )
    global_item = {**item, "username": user.username}
    await db.global_activity.update_one(
        {"_id": "feed"},
        {"$push": {"items": {"$each": [global_item], "$position": 0, "$slice": 20}}},
        upsert=True,
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Routes: refresh (all users) + admin sync (master only)
# ---------------------------------------------------------------------------
@api_router.post("/refresh")
async def refresh_view(user: CurrentUser = Depends(get_current_user)):
    """On-demand reload of the current authorized data view. Read-only."""
    count = await db.products.count_documents({})
    meta = await db.meta.find_one({"_id": "sync"}, {"_id": 0}) or {}
    return {
        "ok": True,
        "product_count": count,
        "last_sync": meta.get("last_sync"),
        "refreshed_at": datetime.now(timezone.utc).isoformat(),
    }


@api_router.post("/admin/sync")
async def admin_sync(user: CurrentUser = Depends(require_master)):
    """Master-only full source synchronization (Phase 1 = reseed mock schema)."""
    result = await onedrive.sync(db, build_mock_products, normalize)
    now = datetime.now(timezone.utc).isoformat()
    await db.meta.update_one(
        {"_id": "sync"},
        {"$set": {"last_sync": now, "source": result["source"], "row_count": result["row_count"]}},
        upsert=True,
    )
    return {"ok": True, "last_sync": now, **result}


@api_router.get("/admin/dashboard")
async def admin_dashboard(user: CurrentUser = Depends(require_master)):
    count = await db.products.count_documents({})
    meta = await db.meta.find_one({"_id": "sync"}, {"_id": 0}) or {}
    feed = await db.global_activity.find_one({"_id": "feed"}, {"_id": 0, "items": 1}) or {}
    global_items = feed.get("items", [])
    return {
        "product_count": count,
        "last_sync": meta.get("last_sync"),
        "source": meta.get("source", "mock"),
        "worksheet": "202607",
        "connection_ready": onedrive.is_configured(),
        "recent_global_searches": global_items[:6],
        "activity": global_items[:12],
        "total_users": await db.users.count_documents({}),
    }


@api_router.get("/admin/products")
async def admin_products(limit: int = 200, user: CurrentUser = Depends(require_master)):
    cursor = db.products.find({}, {"_id": 0})
    docs = await cursor.to_list(limit)
    rows = []
    for d in docs:
        rows.append({
            "sku": d["sku"],
            "rin": d["rin"],
            "marca": d["marca"],
            "descripcion": d["descripcion"],
            "prices": build_price_payload(d, "master"),
        })
    return {"products": rows, "count": len(rows)}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Startup: idempotent seed of users + products
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def seed():
    await db.users.create_index("username", unique=True)
    await db.products.create_index("sku", unique=True)

    for u in SEED_USERS:
        await db.users.update_one(
            {"username": u["username"]},
            {"$set": {
                "username": u["username"],
                "role": u["role"],
                "password_hash": hash_password(u["password"]),
            }},
            upsert=True,
        )
    logger.info("Seeded %d users", len(SEED_USERS))

    if await db.products.count_documents({}) == 0:
        products = build_mock_products()
        for p in products:
            p["search_blob"] = " ".join([
                normalize(p["sku"]), normalize(p["marca"]),
                normalize(p["descripcion"]), normalize(str(p["rin"])),
            ])
        await db.products.insert_many(products)
        await db.meta.update_one(
            {"_id": "sync"},
            {"$set": {
                "last_sync": datetime.now(timezone.utc).isoformat(),
                "source": "mock",
                "row_count": len(products),
            }},
            upsert=True,
        )
        logger.info("Seeded %d products", len(products))


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
