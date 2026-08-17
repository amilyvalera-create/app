"""VENEGE backend tests - login-fix iteration.

Covers:
- Login success for EXACT usernames (spaces/accents/caps) + new passwords.
- Invalid login exact Spanish detail message.
- Stale accounts purged (401).
- Role isolation via GET /api/products/{sku} (no costs anywhere; BF for all).
- Admin-only endpoints (master vs 5 sellers).
- Zoho live sync unchanged (worksheet 'Precios Actual', ~418 rows).
- Status, /auth/me, history capped at 5, favorites, facets.
"""
import pytest
import requests
from conftest import (
    BASE_URL, SEED_USERS, ROLE_ALLOWED_KEYS, ROLE_COUNT, EXPECTED_LETTERS,
    COST_KEYS, STALE_USERNAMES, INVALID_MSG, MASTER, ROILAN, ADRIANA, CASANOVA,
    MANRIQUE, MARIA, SELLERS, auth_headers,
)


# -------------------- AUTH (login fix) --------------------
class TestAuthLoginFix:
    def test_login_all_exact_usernames(self, api):
        for u, (p, role, name) in SEED_USERS.items():
            r = api.post(f"{BASE_URL}/api/auth/login", json={"username": u, "password": p})
            assert r.status_code == 200, f"{u!r}: {r.status_code} {r.text}"
            d = r.json()
            assert d["user"]["username"] == u
            assert d["user"]["name"] == name
            assert d["user"]["role"] == role
            assert d["user"]["authorized_price_count"] == ROLE_COUNT[role]
            assert d["token_type"] == "bearer"
            assert d["access_token"]

    def test_invalid_password_returns_exact_spanish_message(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login",
                     json={"username": "Gerencia venege", "password": "wrong-pass"})
        assert r.status_code == 401
        assert r.json()["detail"] == INVALID_MSG

    def test_invalid_username_returns_same_message(self, api):
        """Never leak whether it was the username or the password that was wrong."""
        r = api.post(f"{BASE_URL}/api/auth/login",
                     json={"username": "NoSuchUser", "password": "whatever"})
        assert r.status_code == 401
        assert r.json()["detail"] == INVALID_MSG

    @pytest.mark.parametrize("u", STALE_USERNAMES)
    def test_stale_accounts_removed(self, api, u):
        # Use a plausible password; must still 401 because user does not exist.
        r = api.post(f"{BASE_URL}/api/auth/login",
                     json={"username": u, "password": "Roilan2026"})
        assert r.status_code == 401, f"{u!r} should not exist -> got {r.status_code}"
        assert r.json()["detail"] == INVALID_MSG

    def test_case_sensitive_username(self, api):
        # Exact match required; lowercase variant must fail.
        r = api.post(f"{BASE_URL}/api/auth/login",
                     json={"username": "gerencia venege", "password": "Master2026gerencia"})
        assert r.status_code == 401
        assert r.json()["detail"] == INVALID_MSG

    def test_accent_sensitive_username(self, api):
        # 'Roilan Narvaez' (no accent) must NOT authenticate.
        r = api.post(f"{BASE_URL}/api/auth/login",
                     json={"username": "Roilan Narvaez", "password": "ventasccs202601"})
        assert r.status_code == 401
        assert r.json()["detail"] == INVALID_MSG

    def test_me_returns_name_and_role_label(self, tokens):
        for username, entry in tokens.items():
            r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers(entry))
            assert r.status_code == 200
            d = r.json()
            assert d["username"] == username
            assert d["name"] == SEED_USERS[username][2]
            assert d["role"] == entry["role"]
            assert d["role_label"]

    def test_me_requires_bearer(self):
        assert requests.get(f"{BASE_URL}/api/auth/me").status_code == 401


# -------------------- STATUS --------------------
class TestStatus:
    def test_status_for_any_user(self, tokens):
        for u in [ROILAN, CASANOVA, MASTER]:
            r = requests.get(f"{BASE_URL}/api/status", headers=auth_headers(tokens[u]))
            assert r.status_code == 200
            d = r.json()
            assert d["product_count"] > 0
            assert "last_sync" in d

    def test_status_no_token(self):
        assert requests.get(f"{BASE_URL}/api/status").status_code == 401


# -------------------- ADMIN RBAC --------------------
class TestAdminProtection:
    @pytest.mark.parametrize("u", SELLERS)
    def test_seller_roles_admin_forbidden(self, tokens, u):
        for path, method in [("/api/admin/dashboard", "GET"),
                             ("/api/admin/sync", "POST"),
                             ("/api/admin/products", "GET")]:
            r = requests.request(method, f"{BASE_URL}{path}", headers=auth_headers(tokens[u]))
            assert r.status_code == 403, f"{u!r} {method} {path} -> {r.status_code}"

    def test_master_dashboard_ok(self, tokens):
        r = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=auth_headers(tokens[MASTER]))
        assert r.status_code == 200
        d = r.json()
        assert d["worksheet"] == "Precios Actual"
        assert d["table"] == "_202606_Precios"
        assert d["provider"] == "zoho"
        assert d["product_count"] > 0
        assert d["total_users"] == 6

    def test_master_dashboard_live_zoho_unchanged(self, tokens):
        d = requests.get(f"{BASE_URL}/api/admin/dashboard",
                         headers=auth_headers(tokens[MASTER])).json()
        assert d["connection_ready"] is True, d
        assert d["source"] == "zoho:Precios Actual", d
        assert d["last_error"] is None
        assert d["last_sync"] is not None
        # ~418 rows expected.
        assert d["product_count"] >= 400, d

    def test_master_sync_live(self, tokens):
        r = requests.post(f"{BASE_URL}/api/admin/sync",
                          headers=auth_headers(tokens[MASTER]), timeout=180)
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
                         headers=auth_headers(tokens[MASTER]))
        return [x["sku"] for x in r.json()["results"]]

    @pytest.mark.parametrize("u", list(SEED_USERS.keys()))
    def test_authorized_columns_only(self, tokens, u):
        role = SEED_USERS[u][1]
        skus = self._skus(tokens)
        assert skus
        expected = ROLE_ALLOWED_KEYS[role]
        for sku in skus:
            r = requests.get(f"{BASE_URL}/api/products/{sku}", headers=auth_headers(tokens[u]))
            assert r.status_code == 200, f"{u!r} {sku}"
            keys = {p["key"] for p in r.json()["prices"]}
            assert keys == expected, f"{u!r} sku={sku} got={keys} exp={expected}"
            # NEVER any cost key, EVER \u2014 including master.
            assert not (keys & COST_KEYS), f"{u!r} leaked cost columns: {keys & COST_KEYS}"

    def test_bf_goodrich_present_for_every_role(self, tokens):
        skus = self._skus(tokens)
        for u in SEED_USERS:
            r = requests.get(f"{BASE_URL}/api/products/{skus[0]}", headers=auth_headers(tokens[u]))
            prices = r.json()["prices"]
            bf = [p for p in prices if p["key"] == "BF_GOODRICH"]
            assert len(bf) == 1, f"{u!r} missing BF_GOODRICH"
            assert bf[0]["label"] == "Precio BF Goodrich"
            assert bf[0]["currency"] == "$"
            assert bf[0]["column"] == "AM"

    def test_master_never_sees_costs(self, tokens):
        skus = self._skus(tokens, limit=10)
        checked = 0
        for sku in skus:
            r = requests.get(f"{BASE_URL}/api/products/{sku}",
                             headers=auth_headers(tokens[MASTER]))
            # skip SKUs that briefly rotated during a parallel live re-sync
            if r.status_code != 200:
                continue
            keys = {p["key"] for p in r.json()["prices"]}
            assert not (keys & COST_KEYS), f"master leaked costs on {sku}: {keys & COST_KEYS}"
            checked += 1
        assert checked > 0, "no SKUs were verified"

    def test_tampering_url_never_leaks_unauthorized(self, tokens):
        skus = self._skus(tokens, limit=8)
        forbidden = (ROLE_ALLOWED_KEYS["master"] - ROLE_ALLOWED_KEYS["caracas"])
        for sku in skus:
            r = requests.get(f"{BASE_URL}/api/products/{sku}",
                             headers=auth_headers(tokens[CASANOVA]))
            keys = {p["key"] for p in r.json()["prices"]}
            assert not (keys & forbidden), f"leak on {sku}: {keys & forbidden}"

    def test_roilan_no_panofre(self, tokens):
        skus = self._skus(tokens, limit=6)
        for sku in skus:
            keys = {p["key"] for p in requests.get(
                f"{BASE_URL}/api/products/{sku}", headers=auth_headers(tokens[ROILAN])
            ).json()["prices"]}
            assert not (keys & {"PANOFRE_BS", "PANOFRE_CASH"}), keys

    def test_adriana_no_tirescenter(self, tokens):
        skus = self._skus(tokens, limit=6)
        for sku in skus:
            keys = {p["key"] for p in requests.get(
                f"{BASE_URL}/api/products/{sku}", headers=auth_headers(tokens[ADRIANA])
            ).json()["prices"]}
            assert not (keys & {"TCC_TTC_BS", "TCC_TTC_CASH", "TCC_TTC_ZELLE"}), keys

    def test_column_letters_match(self, tokens):
        skus = self._skus(tokens, limit=1)
        r = requests.get(f"{BASE_URL}/api/products/{skus[0]}",
                         headers=auth_headers(tokens[ROILAN]))
        for p in r.json()["prices"]:
            assert p["column"] == EXPECTED_LETTERS[p["key"]], p

    def test_prices_2_decimals(self, tokens):
        skus = self._skus(tokens, limit=5)
        for sku in skus:
            r = requests.get(f"{BASE_URL}/api/products/{sku}",
                             headers=auth_headers(tokens[MASTER]))
            for p in r.json()["prices"]:
                if p["value"] is not None:
                    assert round(p["value"], 2) == p["value"]

    def test_unknown_sku_404(self, tokens):
        r = requests.get(f"{BASE_URL}/api/products/NON-EXISTENT",
                         headers=auth_headers(tokens[CASANOVA]))
        assert r.status_code == 404


# -------------------- FACETS + SEARCH FILTERS --------------------
class TestFacetsAndSearch:
    def test_facets_real_rin_and_marca(self, tokens):
        r = requests.get(f"{BASE_URL}/api/products/facets", headers=auth_headers(tokens[ROILAN]))
        assert r.status_code == 200
        d = r.json()
        assert len(d["rins"]) > 0
        assert len(d["marcas"]) > 0
        assert d["marcas"] == sorted(d["marcas"])

    def test_search_never_returns_prices(self, tokens):
        r = requests.get(f"{BASE_URL}/api/products/search?q=firestone",
                         headers=auth_headers(tokens[CASANOVA]))
        for it in r.json()["results"]:
            assert "prices" not in it


# -------------------- HISTORY (last 5) --------------------
class TestHistory:
    def test_history_capped_at_5(self, tokens):
        skus = requests.get(f"{BASE_URL}/api/products/search?q=&limit=20",
                            headers=auth_headers(tokens[MASTER])).json()["results"]
        assert len(skus) >= 8
        for e in skus[:8]:
            requests.post(f"{BASE_URL}/api/history",
                          headers=auth_headers(tokens[MANRIQUE]),
                          json={"sku": e["sku"], "marca": e["marca"],
                                "descripcion": e["descripcion"]})
        items = requests.get(f"{BASE_URL}/api/history",
                             headers=auth_headers(tokens[MANRIQUE])).json()["items"]
        assert len(items) <= 5, f"expected <=5 got {len(items)}"
        assert items[0]["sku"] == skus[7]["sku"]

    def test_history_isolated_between_users(self, tokens):
        s = requests.get(f"{BASE_URL}/api/products/search?q=&limit=1",
                         headers=auth_headers(tokens[MASTER])).json()["results"][0]
        requests.post(f"{BASE_URL}/api/history", headers=auth_headers(tokens[ADRIANA]),
                      json={"sku": s["sku"], "marca": s["marca"], "descripcion": s["descripcion"]})
        other = requests.get(f"{BASE_URL}/api/history",
                             headers=auth_headers(tokens[MARIA])).json()["items"]
        assert s["sku"] not in [x["sku"] for x in other]


# -------------------- FAVORITES --------------------
class TestFavorites:
    def test_add_dedupe_delete(self, tokens):
        results = requests.get(f"{BASE_URL}/api/products/search?q=&limit=3",
                               headers=auth_headers(tokens[MASTER])).json()["results"]
        assert len(results) >= 2
        p1, p2 = results[0], results[1]
        for e in [p1, p2, p1]:
            r = requests.post(f"{BASE_URL}/api/favorites",
                              headers=auth_headers(tokens[CASANOVA]),
                              json={"sku": e["sku"], "marca": e["marca"],
                                    "descripcion": e["descripcion"]})
            assert r.status_code == 200
            assert r.json()["favorited"] is True
        items = requests.get(f"{BASE_URL}/api/favorites",
                             headers=auth_headers(tokens[CASANOVA])).json()["items"]
        skus = [i["sku"] for i in items]
        assert len(skus) == len(set(skus))
        assert items[0]["sku"] == p1["sku"]
        rd = requests.delete(f"{BASE_URL}/api/favorites/{p1['sku']}",
                             headers=auth_headers(tokens[CASANOVA]))
        assert rd.status_code == 200
        assert rd.json()["favorited"] is False
