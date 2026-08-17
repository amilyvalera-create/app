"""Tests for the new GET /api/products/export endpoint (iteration_6).

Requirements:
- Requires auth (401 without bearer).
- Returns { products: [{sku, rin, marca, descripcion, prices:[...]}], count }.
- Honors ?rin= and ?marca= filters (server-side).
- Prices arrays contain ONLY the authorized selling columns for that role
  (+ BF_GOODRICH). NEVER any cost keys, for ANY role including master.
- Non-master roles never receive columns outside their role's authorized set.
"""
import pytest
import requests
from conftest import (
    BASE_URL, SEED_USERS, ROLE_ALLOWED_KEYS, COST_KEYS,
    MASTER, ROILAN, ADRIANA, CASANOVA, MANRIQUE, MARIA, auth_headers,
)


class TestExportEndpoint:
    def test_export_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/products/export")
        assert r.status_code == 401

    @pytest.mark.parametrize("u", list(SEED_USERS.keys()))
    def test_export_shape_and_columns(self, tokens, u):
        role = SEED_USERS[u][1]
        r = requests.get(f"{BASE_URL}/api/products/export",
                         headers=auth_headers(tokens[u]), timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "products" in d and "count" in d
        assert isinstance(d["products"], list)
        assert d["count"] == len(d["products"])
        assert d["count"] > 0
        expected = ROLE_ALLOWED_KEYS[role]
        # sample first 25 products
        for row in d["products"][:25]:
            assert set(row.keys()) >= {"sku", "rin", "marca", "descripcion", "prices"}
            keys = {p["key"] for p in row["prices"]}
            # NEVER cost keys leak
            assert not (keys & COST_KEYS), f"{u!r} sku={row['sku']} cost leak: {keys & COST_KEYS}"
            # only authorized keys visible
            assert keys.issubset(expected), (
                f"{u!r} unauthorized keys leaked: {keys - expected} sku={row['sku']}")
            # each price entry must have position/label/currency/column
            for p in row["prices"]:
                assert {"key", "column", "label", "currency", "position", "value"}.issubset(p.keys())

    def test_export_roilan_caracas_tires_only(self, tokens):
        r = requests.get(f"{BASE_URL}/api/products/export",
                         headers=auth_headers(tokens[ROILAN]), timeout=60)
        assert r.status_code == 200
        forbidden = {"PANOFRE_BS", "PANOFRE_CASH",
                     "ORIENTE_SUR_BS", "ORIENTE_SUR_CASH", "ORIENTE_SUR_ZELLE",
                     "ORIENTE_NORTE_BS", "ORIENTE_NORTE_CASH", "ORIENTE_NORTE_ZELLE",
                     "OTROS_CASH", "OTROS_ZELLE"}
        seen_caracas = seen_tcc = seen_bf = False
        for row in r.json()["products"]:
            keys = {p["key"] for p in row["prices"]}
            assert not (keys & forbidden), f"leak on {row['sku']}: {keys & forbidden}"
            assert not (keys & COST_KEYS)
            seen_caracas = seen_caracas or bool(keys & {"CARACAS_BS", "CARACAS_CASH", "CARACAS_ZELLE"})
            seen_tcc = seen_tcc or bool(keys & {"TCC_TTC_BS", "TCC_TTC_CASH", "TCC_TTC_ZELLE"})
            seen_bf = seen_bf or ("BF_GOODRICH" in keys)
        assert seen_caracas and seen_tcc and seen_bf

    def test_export_manrique_oriente_sur_only(self, tokens):
        r = requests.get(f"{BASE_URL}/api/products/export",
                         headers=auth_headers(tokens[MANRIQUE]), timeout=60)
        assert r.status_code == 200
        forbidden = {"CARACAS_BS", "CARACAS_CASH", "CARACAS_ZELLE",
                     "PANOFRE_BS", "PANOFRE_CASH",
                     "TCC_TTC_BS", "TCC_TTC_CASH", "TCC_TTC_ZELLE",
                     "ORIENTE_NORTE_BS", "ORIENTE_NORTE_CASH", "ORIENTE_NORTE_ZELLE",
                     "OTROS_CASH", "OTROS_ZELLE"}
        seen_osur = seen_bf = False
        for row in r.json()["products"]:
            keys = {p["key"] for p in row["prices"]}
            assert not (keys & forbidden), f"leak on {row['sku']}: {keys & forbidden}"
            assert not (keys & COST_KEYS)
            seen_osur = seen_osur or bool(keys & {"ORIENTE_SUR_BS", "ORIENTE_SUR_CASH", "ORIENTE_SUR_ZELLE"})
            seen_bf = seen_bf or ("BF_GOODRICH" in keys)
        assert seen_osur and seen_bf

    def test_export_master_no_costs_ever(self, tokens):
        r = requests.get(f"{BASE_URL}/api/products/export",
                         headers=auth_headers(tokens[MASTER]), timeout=60)
        assert r.status_code == 200
        for row in r.json()["products"]:
            keys = {p["key"] for p in row["prices"]}
            assert not (keys & COST_KEYS), f"master cost leak: {keys & COST_KEYS} sku={row['sku']}"

    def test_export_filter_by_marca(self, tokens):
        # Find a marca that exists.
        facets = requests.get(f"{BASE_URL}/api/products/facets",
                              headers=auth_headers(tokens[MASTER])).json()
        assert facets["marcas"]
        marca = facets["marcas"][0]
        r = requests.get(f"{BASE_URL}/api/products/export",
                         headers=auth_headers(tokens[MASTER]),
                         params={"marca": marca}, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["count"] > 0
        for row in d["products"]:
            assert row["marca"].strip().lower() == marca.strip().lower(), row

    def test_export_filter_by_rin(self, tokens):
        facets = requests.get(f"{BASE_URL}/api/products/facets",
                              headers=auth_headers(tokens[MASTER])).json()
        assert facets["rins"]
        rin = facets["rins"][0]
        r = requests.get(f"{BASE_URL}/api/products/export",
                         headers=auth_headers(tokens[MASTER]),
                         params={"rin": str(rin)}, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["count"] > 0
        for row in d["products"]:
            assert str(row["rin"]) == str(rin), row

    def test_export_filter_combined(self, tokens):
        facets = requests.get(f"{BASE_URL}/api/products/facets",
                              headers=auth_headers(tokens[MASTER])).json()
        # Find a (rin, marca) pair that yields >=1 product.
        picked = None
        for rin in facets["rins"][:6]:
            for marca in facets["marcas"][:10]:
                r = requests.get(f"{BASE_URL}/api/products/export",
                                 headers=auth_headers(tokens[MASTER]),
                                 params={"rin": str(rin), "marca": marca}, timeout=60)
                if r.status_code == 200 and r.json()["count"] > 0:
                    picked = (rin, marca, r.json()["products"])
                    break
            if picked:
                break
        assert picked, "could not find any (rin, marca) yielding products"
        rin, marca, products = picked
        for row in products:
            assert str(row["rin"]) == str(rin)
            assert row["marca"].strip().lower() == marca.strip().lower()

    def test_export_never_returns_costs_any_role(self, tokens):
        for u in SEED_USERS:
            r = requests.get(f"{BASE_URL}/api/products/export",
                             headers=auth_headers(tokens[u]), timeout=60)
            assert r.status_code == 200
            for row in r.json()["products"][:50]:
                keys = {p["key"] for p in row["prices"]}
                assert not (keys & COST_KEYS), f"{u!r} cost leak"

    def test_export_unknown_marca_returns_empty(self, tokens):
        r = requests.get(f"{BASE_URL}/api/products/export",
                         headers=auth_headers(tokens[MASTER]),
                         params={"marca": "___NO_SUCH_MARCA___"}, timeout=60)
        assert r.status_code == 200
        assert r.json()["count"] == 0
