"""Shared fixtures for VENEGE backend tests (schema v2 - Precios Actual)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://venege-precios.preview.emergentagent.com").rstrip("/")

SEED_USERS = {
    "master": ("Admon", "Master"),
    "caracas": ("Ventasccs", "ccs2026"),
    "oriente_sur": ("Ventasorientesur", "Orisur2026"),
    "oriente_norte": ("Ventasorientenorte", "Orinorte2026"),
    "panofre": ("Panofre", "Panofre2026"),
    "tires_center": ("TiresCenter", "Tirescenter2026"),
}

# Confirmed production mapping (schema v2). Master = all 20 columns.
ROLE_ALLOWED_KEYS = {
    "master": None,
    "caracas": {"CARACAS_BS", "CARACAS_CASH", "CARACAS_ZELLE"},
    "oriente_sur": {"ORIENTE_SUR_BS", "ORIENTE_SUR_CASH", "ORIENTE_SUR_ZELLE"},
    "oriente_norte": {"ORIENTE_NORTE_BS", "ORIENTE_NORTE_CASH", "ORIENTE_NORTE_ZELLE"},
    "panofre": {"PANOFRE_BS", "PANOFRE_CASH"},
    "tires_center": {"TCC_TTC_BS", "TCC_TTC_CASH", "TCC_TTC_ZELLE"},
}

ROLE_COUNT = {"master": 20, "caracas": 3, "oriente_sur": 3, "oriente_norte": 3, "panofre": 2, "tires_center": 3}

# Column letter map (for the tampering check).
EXPECTED_LETTERS = {
    "CARACAS_BS": "I", "CARACAS_CASH": "J", "CARACAS_ZELLE": "K",
    "ORIENTE_SUR_BS": "L", "ORIENTE_SUR_CASH": "M", "ORIENTE_SUR_ZELLE": "N",
    "ORIENTE_NORTE_BS": "O", "ORIENTE_NORTE_CASH": "P", "ORIENTE_NORTE_ZELLE": "Q",
    "PANOFRE_BS": "R", "PANOFRE_CASH": "S",
    "TCC_TTC_BS": "AE", "TCC_TTC_CASH": "AF", "TCC_TTC_ZELLE": "AG",
}


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def tokens(api):
    out = {}
    for role, (u, p) in SEED_USERS.items():
        r = api.post(f"{BASE_URL}/api/auth/login", json={"username": u, "password": p}, timeout=15)
        assert r.status_code == 200, f"Login failed for {role}: {r.status_code} {r.text}"
        out[role] = r.json()["access_token"]
    return out


def auth_headers(token: str):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
