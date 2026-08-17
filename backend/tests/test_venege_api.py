"""VENEGE backend Phase-1 tests: new users, composite roles, BF Goodrich,
cost hiding for master, status/me endpoints, history capped at 5, facets/filters.
"""
import time
import pytest
import requests
from conftest import (
    BASE_URL, SEED_USERS, ROLE_ALLOWED_KEYS, ROLE_COUNT, EXPECTED_LETTERS,
    COST_KEYS, auth_headers,
)


# -------------------- AUTH --------------------
class TestAuth:
    def test_login_all_new_users(self, api):
        for u, (p, role, name) in SEED_USERS.items():
            r = api.post(f"{BASE_URL}/api/auth/login", json={"username": u, "password": p})
            assert r.status_code == 200, f"{u}: {r.text}"
            data = r.json()
            assert data["user"]["role"] == role
            assert data["user"]["name"] == name
            assert data["user"]["authorized_price_count"] == ROLE_COUNT[role]

    def test_login_wrong_password_spanish(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"username": "Admon", "password": "wrong"})
        assert r.status_code == 401
        assert "incorrect" in r.json()["detail"].lower() or "usuario" in r.json()["detail"].lower()

    def test_me_returns_name_and_role_label(self, tokens):
        for username, entry in tokens.items():
            r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers(entry))
            assert r.status_code == 200
            d = r.json()
            assert d["username"] == username
            assert d["name"] == SEED_USERS[username][2]
            assert d["role"] == entry["role"]
            assert d["role_label"]  # non-empty label

    def test_me_requires_bearer(self):
        assert requests.get(f"{BASE_URL}/api/auth/me").status_code == 401


# -------------------- STATUS --------------------
class TestStatus:
    def test_status_for_any_user(self, tokens):
        for u in ["roilan", "andrea.casanova", "gerencia"]:
            r = requests.get(f"{BASE_URL}/api/status", headers=auth_headers(tokens[u]))
            assert r.status_code == 200
            d = r.json()
            assert d["product_count"] > 0
            assert "last_sync" in d

    def test_status_no_token(self):
        assert requests.get(f"{BASE_URL}/api/status").status_code == 401


# -------------------- ADMIN RBAC --------------------
class TestAdminProtection:
    @pytest.mark.parametrize("u", ["roilan", "adriana", "andrea.casanova",
                                    "andrea.manrique", "mariateresa"])
    def test_seller_roles_admin_forbidden(self, tokens, u):
        for path, method in [("/api/admin/dashboard", "GET"),
                             ("/api/admin/sync", "POST"),
                             ("/api/admin/products", "GET")]:
            r = requests.request(method, f"{BASE_URL}{path}", headers=auth_headers(tokens[u]))
            assert r.status_code == 403, f"{u} {method} {path} -> {r.status_code}"

    @pytest.mark.parametrize("u", ["gerencia", "Admon"])
    def test_master_users_admin_ok(self, tokens, u):
        r = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=auth_headers(tokens[u]))
        assert r.status_code == 200
        d = r.json()
        assert d["worksheet"] == "Precios Actual"
        assert d["table"] == "_202606_Precios"
        assert d["provider"] == "zoho"
        assert d["product_count"] > 0

    def test_master_dashboard_live_zoho(self, tokens):
        d = requests.get(f"{BASE_URL}/api/admin/dashboard",
                         headers=auth_headers(tokens["gerencia"])).json()
        assert d["connection_ready"] is True, d
        assert d["source"] == "zoho:Precios Actual", d
        assert d["last_error"] is None
        assert d["last_sync"] is not None
        assert d["total_users"] >= 7

    def test_master_sync_live(self, tokens):
        r = requests.post(f"{BASE_URL}/api/admin/sync",
                          headers=auth_headers(tokens["gerencia"]), timeout=180)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["source"] == "zoho:Precios Actual"
        assert d["row_count"] >= 400, d


# -------------------- REFRESH (all roles) --------------------
class TestRefresh:
    @pytest.mark.parametrize("u", list(SEED_USERS.keys()))
    def test_refresh_all_roles(self, tokens, u):
        r = requests.post(f"{BASE_URL}/api/refresh", headers=auth_headers(tokens[u]))
        assert r.status_code == 200
        assert r.json()["product_count"] > 0


# -------------------- RBAC PRICE COLUMNS (CRITICAL) --------------------
class TestRoleBasedPriceColumns:
    def _skus(self, tokens, limit=6):
        r = requests.get(f"{BASE_URL}/api/products/search?q=&limit={limit}",
                         headers=auth_headers(tokens["gerencia"]))
        return [x["sku"] for x in r.json()["results"]]

    @pytest.mark.parametrize("u", list(SEED_USERS.keys()))
    def test_authorized_columns_only(self, tokens, u):
        role = SEED_USERS[u][1]
        skus = self._skus(tokens)
        assert skus
        expected = ROLE_ALLOWED_KEYS[role]
        for sku in skus:
            r = requests.get(f"{BASE_URL}/api/products/{sku}", headers=auth_headers(tokens[u]))
            assert r.status_code == 200, f"{u} {sku}"
            keys = {p["key"] for p in r.json()["prices"]}
            assert keys == expected, f"{u} sku={sku} got={keys} exp={expected}"
            # NEVER any cost key, EVER — including master.
            assert not (keys & COST_KEYS), f"{u} leaked cost columns: {keys & COST_KEYS}"

    def test_bf_goodrich_present_for_every_role(self, tokens):
        skus = self._skus(tokens)
        for u in SEED_USERS:
            r = requests.get(f"{BASE_URL}/api/products/{skus[0]}", headers=auth_headers(tokens[u]))
            prices = r.json()["prices"]
            bf = [p for p in prices if p["key"] == "BF_GOODRICH"]
            assert len(bf) == 1, f"{u} missing BF_GOODRICH"
            assert bf[0]["label"] == "Precio BF Goodrich"
            assert bf[0]["currency"] == "$"
            assert bf[0]["column"] == "AM"

    def test_bf_goodrich_has_values_and_null_mix(self, tokens):
        """~47 SKUs carry BF; the rest must return null (No disponible)."""
        r = requests.get(f"{BASE_URL}/api/products/search?q=&limit=500",
                         headers=auth_headers(tokens["gerencia"]))
        skus = [x["sku"] for x in r.json()["results"]]
        assert len(skus) >= 100
        with_val = 0
        without_val = 0
        for sku in skus:
            rr = requests.get(f"{BASE_URL}/api/products/{sku}",
                              headers=auth_headers(tokens["andrea.casanova"]))
            if rr.status_code != 200:
                continue
            for p in rr.json()["prices"]:
                if p["key"] == "BF_GOODRICH":
                    if p["value"] is None:
                        without_val += 1
                    else:
                        assert isinstance(p["value"], (int, float))
                        assert round(p["value"], 2) == p["value"]
                        with_val += 1
        assert with_val > 0, "expected some SKUs to carry BF_GOODRICH"
        assert without_val > 0, "expected some SKUs to show No disponible for BF"

    def test_master_never_sees_costs(self, tokens):
        skus = self._skus(tokens, limit=10)
        for sku in skus:
            r = requests.get(f"{BASE_URL}/api/products/{sku}",
                             headers=auth_headers(tokens["gerencia"]))
            keys = {p["key"] for p in r.json()["prices"]}
            assert not (keys & COST_KEYS), f"gerencia leaked costs on {sku}: {keys & COST_KEYS}"

    def test_tampering_url_never_leaks_unauthorized(self, tokens):
        skus = self._skus(tokens, limit=8)
        # andrea.casanova should never see ORIENTE / PANOFRE / TCC / OTROS keys
        forbidden = (ROLE_ALLOWED_KEYS["master"] - ROLE_ALLOWED_KEYS["caracas"])
        for sku in skus:
            r = requests.get(f"{BASE_URL}/api/products/{sku}",
                             headers=auth_headers(tokens["andrea.casanova"]))
            keys = {p["key"] for p in r.json()["prices"]}
            assert not (keys & forbidden), f"leak on {sku}: {keys & forbidden}"

    def test_column_letters_match(self, tokens):
        skus = self._skus(tokens, limit=1)
        r = requests.get(f"{BASE_URL}/api/products/{skus[0]}",
                         headers=auth_headers(tokens["roilan"]))
        for p in r.json()["prices"]:
            assert p["column"] == EXPECTED_LETTERS[p["key"]], p

    def test_prices_2_decimals(self, tokens):
        skus = self._skus(tokens, limit=5)
        for sku in skus:
            r = requests.get(f"{BASE_URL}/api/products/{sku}",
                             headers=auth_headers(tokens["gerencia"]))
            for p in r.json()["prices"]:
                if p["value"] is not None:
                    assert round(p["value"], 2) == p["value"]

    def test_unknown_sku_404(self, tokens):
        r = requests.get(f"{BASE_URL}/api/products/NON-EXISTENT",
                         headers=auth_headers(tokens["andrea.casanova"]))
        assert r.status_code == 404


# -------------------- FACETS + SEARCH FILTERS --------------------
class TestFacetsAndSearch:
    def test_facets_real_rin_and_marca(self, tokens):
        r = requests.get(f"{BASE_URL}/api/products/facets",
                         headers=auth_headers(tokens["roilan"]))
        assert r.status_code == 200
        d = r.json()
        assert len(d["rins"]) > 0
        assert len(d["marcas"]) > 0
        assert d["marcas"] == sorted(d["marcas"])

    def test_search_filter_rin(self, tokens):
        r = requests.get(f"{BASE_URL}/api/products/search?rin=16",
                         headers=auth_headers(tokens["gerencia"]))
        assert r.status_code == 200
        for it in r.json()["results"]:
            assert str(it["rin"]) == "16"

    def test_search_filter_marca(self, tokens):
        facets = requests.get(f"{BASE_URL}/api/products/facets",
                              headers=auth_headers(tokens["gerencia"])).json()
        marca = facets["marcas"][0]
        r = requests.get(f"{BASE_URL}/api/products/search?marca={marca}",
                         headers=auth_headers(tokens["gerencia"]))
        for it in r.json()["results"]:
            assert it["marca"].upper() == marca.upper()

    def test_search_never_returns_prices(self, tokens):
        r = requests.get(f"{BASE_URL}/api/products/search?q=firestone",
                         headers=auth_headers(tokens["andrea.casanova"]))
        for it in r.json()["results"]:
            assert "prices" not in it


# -------------------- HISTORY (last 5) --------------------
class TestHistory:
    def test_history_capped_at_5(self, tokens):
        skus = requests.get(f"{BASE_URL}/api/products/search?q=&limit=20",
                            headers=auth_headers(tokens["gerencia"])).json()["results"]
        assert len(skus) >= 8
        # push 8 unique SKUs
        for e in skus[:8]:
            requests.post(f"{BASE_URL}/api/history",
                          headers=auth_headers(tokens["andrea.manrique"]),
                          json={"sku": e["sku"], "marca": e["marca"],
                                "descripcion": e["descripcion"]})
        items = requests.get(f"{BASE_URL}/api/history",
                             headers=auth_headers(tokens["andrea.manrique"])).json()["items"]
        assert len(items) <= 5, f"expected <=5 got {len(items)}"
        assert items[0]["sku"] == skus[7]["sku"]

    def test_history_isolated_between_users(self, tokens):
        s = requests.get(f"{BASE_URL}/api/products/search?q=&limit=1",
                         headers=auth_headers(tokens["gerencia"])).json()["results"][0]
        requests.post(f"{BASE_URL}/api/history", headers=auth_headers(tokens["adriana"]),
                      json={"sku": s["sku"], "marca": s["marca"], "descripcion": s["descripcion"]})
        other = requests.get(f"{BASE_URL}/api/history",
                             headers=auth_headers(tokens["mariateresa"])).json()["items"]
        assert s["sku"] not in [x["sku"] for x in other]


# -------------------- FAVORITES --------------------
class TestFavorites:
    def test_add_dedupe_delete(self, tokens):
        results = requests.get(f"{BASE_URL}/api/products/search?q=&limit=3",
                               headers=auth_headers(tokens["gerencia"])).json()["results"]
        assert len(results) >= 2
        p1, p2 = results[0], results[1]
        for e in [p1, p2, p1]:
            r = requests.post(f"{BASE_URL}/api/favorites",
                              headers=auth_headers(tokens["andrea.casanova"]),
                              json={"sku": e["sku"], "marca": e["marca"],
                                    "descripcion": e["descripcion"]})
            assert r.status_code == 200
            assert r.json()["favorited"] is True
        items = requests.get(f"{BASE_URL}/api/favorites",
                             headers=auth_headers(tokens["andrea.casanova"])).json()["items"]
        skus = [i["sku"] for i in items]
        assert len(skus) == len(set(skus))
        assert items[0]["sku"] == p1["sku"]
        rd = requests.delete(f"{BASE_URL}/api/favorites/{p1['sku']}",
                             headers=auth_headers(tokens["andrea.casanova"]))
        assert rd.status_code == 200
        assert rd.json()["favorited"] is False
