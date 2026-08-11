"""VENEGE backend API tests — schema v2 (Precios Actual): auth, RBAC, search+filters, facets, favorites, history, admin sync/dashboard."""
import time
import pytest
import requests
from conftest import BASE_URL, SEED_USERS, ROLE_ALLOWED_KEYS, ROLE_COUNT, EXPECTED_LETTERS, auth_headers


# ---------------- AUTH ----------------
class TestAuth:
    def test_login_all_roles(self, api):
        for role, (u, p) in SEED_USERS.items():
            r = api.post(f"{BASE_URL}/api/auth/login", json={"username": u, "password": p})
            assert r.status_code == 200, f"{role}: {r.text}"
            data = r.json()
            assert "access_token" in data
            assert data["user"]["role"] == role
            assert data["user"]["authorized_price_count"] == ROLE_COUNT[role]

    def test_login_wrong_password_spanish(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"username": "Admon", "password": "wrong"})
        assert r.status_code == 401
        assert "incorrect" in r.json()["detail"].lower() or "usuario" in r.json()["detail"].lower()

    def test_me_requires_bearer(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, tokens):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers(tokens["caracas"]))
        assert r.status_code == 200
        assert r.json()["role"] == "caracas"


# ---------------- AUTH ENFORCEMENT ----------------
class TestAuthEnforcement:
    @pytest.mark.parametrize("path,method", [
        ("/api/products/search?q=bridgestone", "GET"),
        ("/api/products/facets", "GET"),
        ("/api/history", "GET"),
        ("/api/history", "POST"),
        ("/api/favorites", "GET"),
        ("/api/favorites", "POST"),
        ("/api/favorites/ABC", "DELETE"),
        ("/api/refresh", "POST"),
        ("/api/admin/dashboard", "GET"),
        ("/api/admin/sync", "POST"),
        ("/api/admin/products", "GET"),
    ])
    def test_no_token_returns_401(self, path, method):
        r = requests.request(method, f"{BASE_URL}{path}", json={} if method == "POST" else None)
        assert r.status_code == 401, f"{method} {path} => {r.status_code}"


# ---------------- RBAC / ADMIN ----------------
class TestAdminProtection:
    @pytest.mark.parametrize("role", ["caracas", "oriente_sur", "oriente_norte", "panofre", "tires_center"])
    def test_non_master_admin_forbidden(self, tokens, role):
        for path, method in [("/api/admin/dashboard", "GET"),
                             ("/api/admin/sync", "POST"),
                             ("/api/admin/products", "GET")]:
            r = requests.request(method, f"{BASE_URL}{path}", headers=auth_headers(tokens[role]))
            assert r.status_code == 403, f"{role} {method} {path} => {r.status_code}"

    def test_master_dashboard(self, tokens):
        r = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=auth_headers(tokens["master"]))
        assert r.status_code == 200
        d = r.json()
        assert d["product_count"] > 0
        assert d["worksheet"] == "Precios Actual"
        assert d["connection_ready"] is False
        for k in ["MS_TENANT_ID", "MS_CLIENT_ID", "MS_CLIENT_SECRET"]:
            assert k in d["missing_setup"], f"expected {k} in missing_setup"
        assert len(d["recent_global_searches"]) <= 6
        assert d["total_users"] >= 6

    def test_master_sync(self, tokens):
        r0 = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=auth_headers(tokens["master"]))
        prev = r0.json()["last_sync"]
        time.sleep(1.1)
        r = requests.post(f"{BASE_URL}/api/admin/sync", headers=auth_headers(tokens["master"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["last_sync"] != prev
        assert d["row_count"] > 0
        assert d["source"] == "mock"  # MS creds not configured

    def test_master_products_list(self, tokens):
        r = requests.get(f"{BASE_URL}/api/admin/products", headers=auth_headers(tokens["master"]))
        assert r.status_code == 200
        d = r.json()
        assert d["count"] > 0
        assert len(d["products"][0]["prices"]) == 20


# ---------------- SEARCH + FILTERS ----------------
class TestSearch:
    def test_search_never_returns_prices(self, tokens):
        r = requests.get(f"{BASE_URL}/api/products/search?q=bridgestone",
                         headers=auth_headers(tokens["caracas"]))
        assert r.status_code == 200
        for item in r.json()["results"]:
            assert "prices" not in item
            assert set(item.keys()) <= {"sku", "rin", "marca", "descripcion"}

    def test_search_case_accent_insensitive(self, tokens):
        r1 = requests.get(f"{BASE_URL}/api/products/search?q=BRIDGESTONE", headers=auth_headers(tokens["master"]))
        r2 = requests.get(f"{BASE_URL}/api/products/search?q=br%C3%AFdg%C3%A9ston%C3%A9", headers=auth_headers(tokens["master"]))
        assert r1.status_code == 200 and r2.status_code == 200
        assert {x["sku"] for x in r1.json()["results"]} == {x["sku"] for x in r2.json()["results"]}

    def test_filter_by_rin(self, tokens):
        r = requests.get(f"{BASE_URL}/api/products/search?rin=16", headers=auth_headers(tokens["master"]))
        assert r.status_code == 200
        results = r.json()["results"]
        assert len(results) > 0
        for item in results:
            assert str(item["rin"]) == "16"

    def test_filter_by_marca_case_insensitive(self, tokens):
        # try both cases
        r = requests.get(f"{BASE_URL}/api/products/search?marca=BRIDGESTONE", headers=auth_headers(tokens["master"]))
        assert r.status_code == 200
        for item in r.json()["results"]:
            assert item["marca"].upper() == "BRIDGESTONE"
        r2 = requests.get(f"{BASE_URL}/api/products/search?marca=bridgestone", headers=auth_headers(tokens["master"]))
        assert r2.status_code == 200
        assert {x["sku"] for x in r.json()["results"]} == {x["sku"] for x in r2.json()["results"]}

    def test_combined_q_rin_marca(self, tokens):
        # get facets to pick a valid marca that exists at rin 16
        facets = requests.get(f"{BASE_URL}/api/products/facets", headers=auth_headers(tokens["master"])).json()
        assert facets["marcas"]
        marca = facets["marcas"][0]
        r = requests.get(f"{BASE_URL}/api/products/search?q=&rin=16&marca={marca}",
                         headers=auth_headers(tokens["master"]))
        assert r.status_code == 200
        for item in r.json()["results"]:
            assert str(item["rin"]) == "16"
            assert item["marca"] == marca


class TestFacets:
    def test_facets_returns_sorted_distinct(self, tokens):
        r = requests.get(f"{BASE_URL}/api/products/facets", headers=auth_headers(tokens["caracas"]))
        assert r.status_code == 200
        d = r.json()
        assert "rins" in d and "marcas" in d
        assert len(d["rins"]) == len(set(d["rins"]))
        assert len(d["marcas"]) == len(set(d["marcas"]))
        assert d["marcas"] == sorted(d["marcas"])
        assert len(d["rins"]) > 0 and len(d["marcas"]) > 0


# ---------------- RBAC PRICE COLUMNS (CRITICAL) ----------------
class TestRoleBasedPriceColumns:
    def _all_skus(self, token):
        r = requests.get(f"{BASE_URL}/api/products/search?q=&limit=100", headers=auth_headers(token))
        return [x["sku"] for x in r.json()["results"]]

    @pytest.mark.parametrize("role", ["caracas", "oriente_sur", "oriente_norte", "panofre", "tires_center", "master"])
    def test_authorized_columns_only(self, tokens, role):
        skus = self._all_skus(tokens["master"])
        assert len(skus) > 0
        for sku in skus[:5]:
            r = requests.get(f"{BASE_URL}/api/products/{sku}", headers=auth_headers(tokens[role]))
            assert r.status_code == 200, f"{role} {sku}: {r.status_code}"
            data = r.json()
            keys = {p["key"] for p in data["prices"]}
            if role == "master":
                assert len(data["prices"]) == 20
            else:
                allowed = ROLE_ALLOWED_KEYS[role]
                assert keys == allowed, f"{role} sku={sku} got={keys} expected={allowed}"
                assert len(data["prices"]) == ROLE_COUNT[role]

    def test_tires_center_never_gets_otros(self, tokens):
        skus = self._all_skus(tokens["master"])
        for sku in skus[:5]:
            r = requests.get(f"{BASE_URL}/api/products/{sku}", headers=auth_headers(tokens["tires_center"]))
            keys = {p["key"] for p in r.json()["prices"]}
            assert "OTROS_CASH" not in keys and "OTROS_ZELLE" not in keys

    def test_column_letters_match_expected(self, tokens):
        skus = self._all_skus(tokens["master"])
        r = requests.get(f"{BASE_URL}/api/products/{skus[0]}", headers=auth_headers(tokens["caracas"]))
        for p in r.json()["prices"]:
            assert p["column"] == EXPECTED_LETTERS[p["key"]], p

    def test_prices_rounded_to_2_decimals(self, tokens):
        skus = self._all_skus(tokens["master"])
        for sku in skus[:3]:
            r = requests.get(f"{BASE_URL}/api/products/{sku}", headers=auth_headers(tokens["master"]))
            for p in r.json()["prices"]:
                if p["value"] is not None:
                    assert round(p["value"], 2) == p["value"]

    def test_null_prices_present(self, tokens):
        skus = self._all_skus(tokens["master"])
        found_null = False
        for sku in skus:
            r = requests.get(f"{BASE_URL}/api/products/{sku}", headers=auth_headers(tokens["master"]))
            for p in r.json()["prices"]:
                if p["value"] is None:
                    found_null = True
                    break
            if found_null:
                break
        assert found_null

    def test_unknown_sku_404(self, tokens):
        r = requests.get(f"{BASE_URL}/api/products/NON-EXISTENT-SKU", headers=auth_headers(tokens["caracas"]))
        assert r.status_code == 404


# ---------------- FAVORITES ----------------
class TestFavorites:
    def test_favorites_add_list_delete_isolation(self, tokens):
        # Get sample products via master search
        results = requests.get(f"{BASE_URL}/api/products/search?q=&limit=5",
                               headers=auth_headers(tokens["master"])).json()["results"]
        assert len(results) >= 2
        p1, p2 = results[0], results[1]

        # caracas adds two favorites (with a duplicate to test dedupe)
        for e in [p1, p2, p1]:
            r = requests.post(f"{BASE_URL}/api/favorites", headers=auth_headers(tokens["caracas"]),
                              json={"sku": e["sku"], "marca": e["marca"], "descripcion": e["descripcion"]})
            assert r.status_code == 200
            assert r.json()["favorited"] is True

        r = requests.get(f"{BASE_URL}/api/favorites", headers=auth_headers(tokens["caracas"]))
        assert r.status_code == 200
        items = r.json()["items"]
        skus = [i["sku"] for i in items]
        assert len(skus) == len(set(skus))  # deduped
        assert items[0]["sku"] == p1["sku"]  # newest first
        # Includes rin
        assert all("rin" in i for i in items)

        # panofre should NOT see caracas favorites
        r2 = requests.get(f"{BASE_URL}/api/favorites", headers=auth_headers(tokens["panofre"]))
        assert r2.status_code == 200
        panofre_skus = [i["sku"] for i in r2.json()["items"]]
        assert p1["sku"] not in panofre_skus

        # delete
        rd = requests.delete(f"{BASE_URL}/api/favorites/{p1['sku']}", headers=auth_headers(tokens["caracas"]))
        assert rd.status_code == 200
        assert rd.json()["favorited"] is False
        remaining = [i["sku"] for i in requests.get(f"{BASE_URL}/api/favorites",
                                                    headers=auth_headers(tokens["caracas"])).json()["items"]]
        assert p1["sku"] not in remaining


# ---------------- HISTORY ----------------
class TestHistory:
    def test_history_isolated_and_dedupe(self, tokens):
        skus = requests.get(f"{BASE_URL}/api/products/search?q=&limit=10",
                            headers=auth_headers(tokens["master"])).json()["results"]
        assert len(skus) >= 3
        sku1, sku2 = skus[0], skus[1]
        for entry in [sku1, sku2, sku1]:
            r = requests.post(f"{BASE_URL}/api/history", headers=auth_headers(tokens["caracas"]),
                              json={"sku": entry["sku"], "marca": entry["marca"], "descripcion": entry["descripcion"]})
            assert r.status_code == 200
        items = requests.get(f"{BASE_URL}/api/history", headers=auth_headers(tokens["caracas"])).json()["items"]
        assert items[0]["sku"] == sku1["sku"]
        seen = [i["sku"] for i in items]
        assert len(seen) == len(set(seen))

    def test_history_capped_at_6(self, tokens):
        skus = requests.get(f"{BASE_URL}/api/products/search?q=&limit=20",
                            headers=auth_headers(tokens["master"])).json()["results"]
        assert len(skus) >= 8
        for e in skus[:8]:
            requests.post(f"{BASE_URL}/api/history", headers=auth_headers(tokens["oriente_sur"]),
                          json={"sku": e["sku"], "marca": e["marca"], "descripcion": e["descripcion"]})
        items = requests.get(f"{BASE_URL}/api/history", headers=auth_headers(tokens["oriente_sur"])).json()["items"]
        assert len(items) <= 6
        assert items[0]["sku"] == skus[7]["sku"]


# ---------------- REFRESH ----------------
class TestRefresh:
    @pytest.mark.parametrize("role", list(SEED_USERS.keys()))
    def test_refresh_all_roles(self, tokens, role):
        r = requests.post(f"{BASE_URL}/api/refresh", headers=auth_headers(tokens[role]))
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True
        assert d["product_count"] > 0
