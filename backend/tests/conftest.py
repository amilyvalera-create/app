"""Shared fixtures for VENEGE backend tests (Phase-1 + login-fix iteration).

EXACT usernames (with spaces + accents), new passwords per /app/memory/test_credentials.md.
Composite roles, BF_GOODRICH appended to every authorized view, COSTS hidden always.
"""
import os
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")

# EXACT username (spaces/accents/caps) -> (password, role, name)
SEED_USERS = {
    "Gerencia venege":  ("Master2026gerencia",  "master",              "Gerencia venege"),
    "Roilan Narv\u00e1ez":   ("ventasccs202601",     "caracas_tirescenter", "Roilan Narv\u00e1ez"),
    "Adriana Martinez": ("ventasccs202602",     "caracas_panofre",     "Adriana Martinez"),
    "Andrea Casanova":  ("ventascorpccs2026",   "caracas",             "Andrea Casanova"),
    "Andrea Manrique":  ("ventasorisur2026",    "oriente_sur",         "Andrea Manrique"),
    "Maria Teresa":     ("ventasorinorte2026",  "oriente_norte",       "Maria Teresa"),
}

# Simple aliases used across the test file for readability.
MASTER = "Gerencia venege"
ROILAN = "Roilan Narv\u00e1ez"
ADRIANA = "Adriana Martinez"
CASANOVA = "Andrea Casanova"
MANRIQUE = "Andrea Manrique"
MARIA = "Maria Teresa"

SELLERS = [ROILAN, ADRIANA, CASANOVA, MANRIQUE, MARIA]

# Stale accounts that must be purged and now return 401.
STALE_USERNAMES = ["roilan", "adriana", "gerencia", "Admon", "Ventasccs",
                   "andrea.casanova", "andrea.manrique", "mariateresa"]

INVALID_MSG = "Usuario o contrase\u00f1a incorrectos."

COST_KEYS = {"COSTO", "COSTO_BS", "COSTO_DOLAR", "COSTO_ZELLE"}
BF = "BF_GOODRICH"

_CARACAS = {"CARACAS_BS", "CARACAS_CASH", "CARACAS_ZELLE"}
_ORIENTE_SUR = {"ORIENTE_SUR_BS", "ORIENTE_SUR_CASH", "ORIENTE_SUR_ZELLE"}
_ORIENTE_NORTE = {"ORIENTE_NORTE_BS", "ORIENTE_NORTE_CASH", "ORIENTE_NORTE_ZELLE"}
_PANOFRE = {"PANOFRE_BS", "PANOFRE_CASH"}
_TCC = {"TCC_TTC_BS", "TCC_TTC_CASH", "TCC_TTC_ZELLE"}
_OTROS = {"OTROS_CASH", "OTROS_ZELLE"}

ROLE_ALLOWED_KEYS = {
    "master":               _CARACAS | _ORIENTE_SUR | _ORIENTE_NORTE | _PANOFRE | _OTROS | _TCC | {BF},
    "caracas":              _CARACAS | {BF},
    "caracas_panofre":      _CARACAS | _PANOFRE | {BF},
    "caracas_tirescenter":  _CARACAS | _TCC | {BF},
    "oriente_sur":          _ORIENTE_SUR | {BF},
    "oriente_norte":        _ORIENTE_NORTE | {BF},
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
        assert r.status_code == 200, f"Login failed for {username!r}: {r.status_code} {r.text}"
        out[username] = {"token": r.json()["access_token"], "role": role,
                         "name": _name, "user": r.json()["user"]}
    return out


def auth_headers(entry):
    if isinstance(entry, dict):
        entry = entry["token"]
    return {"Authorization": f"Bearer {entry}", "Content-Type": "application/json"}
