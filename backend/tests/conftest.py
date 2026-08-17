"""Shared fixtures for VENEGE backend tests (schema v2 + Phase-1 refinements).

New credentials (see /app/memory/test_credentials.md), composite roles, and
BF_GOODRICH appended to every authorized view. COSTS are hidden for ALL roles.
"""
import os
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")

# username -> (password, role, name)
SEED_USERS = {
    "gerencia": ("Gerencia2026", "master", "Gerencia Venege"),
    "Admon": ("Master", "master", "Administrador"),
    "roilan": ("Roilan2026", "caracas_tirescenter", "Roilan Narváez"),
    "adriana": ("Adriana2026", "caracas_panofre", "Adriana Martínez"),
    "andrea.casanova": ("Casanova2026", "caracas", "Andrea Casanova"),
    "andrea.manrique": ("Manrique2026", "oriente_sur", "Andrea Manrique"),
    "mariateresa": ("MariaTeresa2026", "oriente_norte", "María Teresa"),
}

COST_KEYS = {"COSTO", "COSTO_BS", "COSTO_DOLAR", "COSTO_ZELLE"}
BF = "BF_GOODRICH"

# Role -> expected allowed SELLING price keys (post-Phase-1: BF appended, no costs).
_CARACAS = {"CARACAS_BS", "CARACAS_CASH", "CARACAS_ZELLE"}
_ORIENTE_SUR = {"ORIENTE_SUR_BS", "ORIENTE_SUR_CASH", "ORIENTE_SUR_ZELLE"}
_ORIENTE_NORTE = {"ORIENTE_NORTE_BS", "ORIENTE_NORTE_CASH", "ORIENTE_NORTE_ZELLE"}
_PANOFRE = {"PANOFRE_BS", "PANOFRE_CASH"}
_TCC = {"TCC_TTC_BS", "TCC_TTC_CASH", "TCC_TTC_ZELLE"}
_OTROS = {"OTROS_CASH", "OTROS_ZELLE"}

ROLE_ALLOWED_KEYS = {
    "master": _CARACAS | _ORIENTE_SUR | _ORIENTE_NORTE | _PANOFRE | _OTROS | _TCC | {BF},
    "caracas": _CARACAS | {BF},
    "caracas_panofre": _CARACAS | _PANOFRE | {BF},
    "caracas_tirescenter": _CARACAS | _TCC | {BF},
    "oriente_sur": _ORIENTE_SUR | {BF},
    "oriente_norte": _ORIENTE_NORTE | {BF},
}

ROLE_COUNT = {r: len(k) for r, k in ROLE_ALLOWED_KEYS.items()}

EXPECTED_LETTERS = {
    "CARACAS_BS": "I", "CARACAS_CASH": "J", "CARACAS_ZELLE": "K",
    "ORIENTE_SUR_BS": "L", "ORIENTE_SUR_CASH": "M", "ORIENTE_SUR_ZELLE": "N",
    "ORIENTE_NORTE_BS": "O", "ORIENTE_NORTE_CASH": "P", "ORIENTE_NORTE_ZELLE": "Q",
    "PANOFRE_BS": "R", "PANOFRE_CASH": "S",
    "OTROS_CASH": "AC", "OTROS_ZELLE": "AD",
    "TCC_TTC_BS": "AE", "TCC_TTC_CASH": "AF", "TCC_TTC_ZELLE": "AG",
    "BF_GOODRICH": "AM",
}


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def tokens(api):
    out = {}
    for username, (password, role, _name) in SEED_USERS.items():
        r = api.post(f"{BASE_URL}/api/auth/login",
                     json={"username": username, "password": password}, timeout=20)
        assert r.status_code == 200, f"Login failed for {username}: {r.status_code} {r.text}"
        out[username] = {"token": r.json()["access_token"], "role": role,
                         "name": _name, "user": r.json()["user"]}
    return out


def auth_headers(entry):
    if isinstance(entry, dict):
        entry = entry["token"]
    return {"Authorization": f"Bearer {entry}", "Content-Type": "application/json"}
