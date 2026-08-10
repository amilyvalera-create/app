"""VENEGE backend API tests — auth, RBAC, search, history, admin."""
import time
import pytest
import requests
from conftest import BASE_URL, SEED_USERS, ROLE_ALLOWED_KEYS, ROLE_COUNT, auth_headers


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

    def test_login_unknown_user(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"username": "nobody", "password": "x"})
        assert r.status_code == 401

    def test_me_requires_bearer(self, api):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, api, tokens):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers(tokens["caracas"]))
        assert r.status_code == 200
        assert r.json()["role"] == "caracas"


# ---------------- AUTH ENFORCEMENT ----------------
class TestAuthEnforcement:
    @pytest.mark.parametrize("path,method", [
        ("/api/products/VNG-161000", "GET"),
        ("/api/products/search?q=bridgestone", "GET"),
        ("/api/history", "GET"),
        ("/api/history", "POST"),
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
        assert "product_count" in d and d["product_count"] > 0
        assert d["worksheet"] == "202607"
        assert "last_sync" in d
        assert "recent_global_searches" in d and len(d["recent_global_searches"]) <= 6
        assert d["total_users"] >= 6

    def test_master_sync_updates_last_sync(self, tokens):
        r0 = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=auth_headers(tokens["master"]))
        prev = r0.json()["last_sync"]
        time.sleep(1.1)
        r = requests.post(f"{BASE_URL}/api/admin/sync", headers=auth_headers(tokens["master"]))
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True
        assert d["last_sync"] != prev
        assert d["row_count"] > 0

    def test_master_products_list(self, tokens):
        r = requests.get(f"{BASE_URL}/api/admin/products", headers=auth_headers(tokens["master"]))
        assert r.status_code == 200
        d = r.json()
        assert d["count"] > 0
        # Master sees all 19 prices per product
        assert len(d["products"][0]["prices"]) == 19


# ---------------- SEARCH ----------------
class TestSearch:
    def test_search_never_returns_prices(self, tokens):
        r = requests.get(f"{BASE_URL}/api/products/search?q=bridgestone",
                         headers=auth_headers(tokens["caracas"]))
        assert r.status_code == 200
        data = r.json()
        assert "results" in data
        for item in data["results"]:
            assert "prices" not in item
            assert set(item.keys()) <= {"sku", "rin", "marca", "descripcion"}

    def test_search_case_accent_insensitive(self, tokens):
        r1 = requests.get(f"{BASE_URL}/api/products/search?q=BRIDGESTONE",
                          headers=auth_headers(tokens["master"]))
        r2 = requests.get(f"{BASE_URL}/api/products/search?q=brïdgéstoné",
                          headers=auth_headers(tokens["master"]))
        assert r1.status_code == 200 and r2.status_code == 200
        # Both should return same set of SKUs
        skus1 = {x["sku"] for x in r1.json()["results"]}
        skus2 = {x["sku"] for x in r2.json()["results"]}
        assert skus1 == skus2 and len(skus1) > 0

    def test_search_dedupe(self, tokens):
        r = requests.get(f"{BASE_URL}/api/products/search?q=",
                         headers=auth_headers(tokens["master"]))
        assert r.status_code == 200
        skus = [x["sku"] for x in r.json()["results"]]
        assert len(skus) == len(set(skus))


# ---------------- RBAC PRICE COLUMNS (CRITICAL SECURITY) ----------------
class TestRoleBasedPriceColumns:
    def _all_skus(self, token):
        r = requests.get(f"{BASE_URL}/api/products/search?q=&limit=100", headers=auth_headers(token))
        return [x["sku"] for x in r.json()["results"]]

    @pytest.mark.parametrize("role", ["caracas", "oriente_sur", "oriente_norte", "panofre", "tires_center", "master"])
    def test_authorized_columns_only(self, tokens, role):
        skus = self._all_skus(tokens["master"])
        assert len(skus) > 0
        # sample first 5 SKUs — non-master roles must NEVER return unauthorized cols
        for sku in skus[:5]:
            r = requests.get(f"{BASE_URL}/api/products/{sku}", headers=auth_headers(tokens[role]))
            assert r.status_code == 200, f"{role} {sku}: {r.status_code}"
            data = r.json()
            keys = {p["key"] for p in data["prices"]}
            if role == "master":
                assert len(data["prices"]) == 19
            else:
                allowed = ROLE_ALLOWED_KEYS[role]
                assert keys == allowed, f"{role} sku={sku} got={keys} expected={allowed}"
                assert len(data["prices"]) == ROLE_COUNT[role]

    def test_prices_rounded_to_2_decimals(self, tokens):
        skus = self._all_skus(tokens["master"])
        for sku in skus[:3]:
            r = requests.get(f"{BASE_URL}/api/products/{sku}", headers=auth_headers(tokens["master"]))
            for p in r.json()["prices"]:
                if p["value"] is not None:
                    # check 2 decimal rounding
                    assert round(p["value"], 2) == p["value"]

    def test_null_prices_present(self, tokens):
        # At least one product should have a null value for master
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
        assert found_null, "Expected at least one null price to exercise No disponible"

    def test_unknown_sku_404(self, tokens):
        r = requests.get(f"{BASE_URL}/api/products/NON-EXISTENT-SKU", headers=auth_headers(tokens["caracas"]))
        assert r.status_code == 404


# ---------------- HISTORY ----------------
class TestHistory:
    def test_history_isolated_per_user_and_dedupe(self, tokens):
        skus_master = requests.get(f"{BASE_URL}/api/products/search?q=&limit=10",
                                   headers=auth_headers(tokens["master"])).json()["results"]
        assert len(skus_master) >= 3
        sku1, sku2, sku3 = skus_master[0], skus_master[1], skus_master[2]

        # caracas logs 2 items, then repeats sku1 -> should still be 2, sku1 first
        for entry in [sku1, sku2, sku1]:
            r = requests.post(f"{BASE_URL}/api/history", headers=auth_headers(tokens["caracas"]),
                              json={"sku": entry["sku"], "marca": entry["marca"], "descripcion": entry["descripcion"]})
            assert r.status_code == 200

        r = requests.get(f"{BASE_URL}/api/history", headers=auth_headers(tokens["caracas"]))
        assert r.status_code == 200
        items = r.json()["items"]
        assert items[0]["sku"] == sku1["sku"]  # newest first
        skus_seen = [i["sku"] for i in items]
        # dedupe: no duplicate SKUs
        assert len(skus_seen) == len(set(skus_seen))
        # both fresh SKUs present
        assert sku1["sku"] in skus_seen and sku2["sku"] in skus_seen

        # panofre history is empty / does not contain caracas items
        r2 = requests.get(f"{BASE_URL}/api/history", headers=auth_headers(tokens["panofre"]))
        assert r2.status_code == 200
        panofre_skus = [i["sku"] for i in r2.json()["items"]]
        assert sku1["sku"] not in panofre_skus

    def test_history_capped_at_6(self, tokens):
        skus = requests.get(f"{BASE_URL}/api/products/search?q=&limit=20",
                            headers=auth_headers(tokens["master"])).json()["results"]
        assert len(skus) >= 8
        for e in skus[:8]:
            requests.post(f"{BASE_URL}/api/history", headers=auth_headers(tokens["oriente_sur"]),
                          json={"sku": e["sku"], "marca": e["marca"], "descripcion": e["descripcion"]})
        r = requests.get(f"{BASE_URL}/api/history", headers=auth_headers(tokens["oriente_sur"]))
        items = r.json()["items"]
        assert len(items) <= 6
        # newest first: last pushed sku should be first
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
        assert "last_sync" in d
