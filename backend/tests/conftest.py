"""Shared fixtures for VENEGE backend tests."""
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

ROLE_ALLOWED_KEYS = {
    "master": None,  # all 19
    "caracas": {"VENTA_CARACAS", "VENTA_CARACAS_BS_18", "VENTA_CARACAS_CASH_21", "VENTA_CARACAS_ZELLE_24"},
    "oriente_sur": {
        "VENTA_ORIENTE_SUR_Y_BOLIVAR_BS_28",
        "VENTA_ORIENTE_SUR_Y_BOLIVAR_CASH_31",
        "VENTA_ORIENTE_SUR_Y_BOLIVAR_ZELLE_34",
    },
    "oriente_norte": {
        "VENTA_ORIENTE_NORTE_MONAGAS_Y_CUMANA_CASH",
        "VENTA_ORIENTE_NORTE_MONAGAS_Y_CUMANA_ZELLE_44",
    },
    "panofre": {"PANOFRE_BS_48", "PANOFRE_CASH_51"},
    "tires_center": {"OTROS_CASH_95", "OTROS_ZELLE_98", "TCC_TTC_BS_102", "TCC_TTC_CASH_105"},
}

ROLE_COUNT = {"master": 19, "caracas": 4, "oriente_sur": 3, "oriente_norte": 2, "panofre": 2, "tires_center": 4}


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(api, username, password):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"username": username, "password": password}, timeout=15)
    return r


@pytest.fixture(scope="session")
def tokens(api):
    out = {}
    for role, (u, p) in SEED_USERS.items():
        r = _login(api, u, p)
        assert r.status_code == 200, f"Login failed for {role}: {r.status_code} {r.text}"
        out[role] = r.json()["access_token"]
    return out


def auth_headers(token: str):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
