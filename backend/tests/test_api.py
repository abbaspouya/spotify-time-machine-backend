import os
import unittest
from time import time

from fastapi.testclient import TestClient


os.environ.setdefault("SPOTIFY_CLIENT_ID", "test-client-id")
os.environ.setdefault("SPOTIFY_CLIENT_SECRET", "test-client-secret")
os.environ.setdefault("SPOTIFY_REDIRECT_URI", "http://127.0.0.1:8000/callback")
os.environ.setdefault("FRONTEND_URL", "http://127.0.0.1:5173")

from backend.app.main import app
from backend.app.core.config import SESSION_COOKIE_NAME, SPOTIFY_SCOPE
from backend.app.core.session_store import save_token_info


class ApiContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_ping_returns_status_ok(self):
        response = self.client.get("/ping")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertIn("X-Request-ID", response.headers)

    def test_auth_status_without_session_is_false(self):
        response = self.client.get("/auth_status")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"authenticated": False})
        self.assertIn("X-Request-ID", response.headers)

    def test_jobs_require_an_authenticated_session(self):
        response = self.client.post(
            "/jobs/fetch_and_group",
            json={"period": "monthly", "order": "asc"},
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "No active session found. Go to /login first.")
        self.assertIn("request_id", response.json())
        self.assertIn("X-Request-ID", response.headers)

    def test_internal_auth_routes_are_hidden_from_openapi(self):
        response = self.client.get("/openapi.json")

        self.assertEqual(response.status_code, 200)
        paths = response.json()["paths"]
        self.assertNotIn("/callback", paths)
        self.assertNotIn("/get_token", paths)

    def test_logout_clears_session_cookie(self):
        with TestClient(app) as client:
            login_response = client.get("/login", params={"raw": True})

            self.assertEqual(login_response.status_code, 200)
            self.assertIn(SESSION_COOKIE_NAME, client.cookies)

            logout_response = client.post("/logout")

            self.assertEqual(logout_response.status_code, 200)
            self.assertEqual(logout_response.json(), {"authenticated": False})
            self.assertNotIn(SESSION_COOKIE_NAME, client.cookies)

            auth_status_response = client.get("/auth_status")

            self.assertEqual(auth_status_response.status_code, 200)
            self.assertEqual(auth_status_response.json(), {"authenticated": False})

    def test_role_specific_auth_status_and_logout_preserve_other_account(self):
        with TestClient(app) as client:
            login_response = client.get("/login", params={"raw": True})

            self.assertEqual(login_response.status_code, 200)
            session_id = client.cookies.get(SESSION_COOKIE_NAME)
            self.assertIsNotNone(session_id)

            token_info = {
                "access_token": "test-access-token",
                "token_type": "Bearer",
                "scope": SPOTIFY_SCOPE,
                "expires_at": int(time()) + 3600,
            }
            save_token_info(session_id, token_info, "source")
            save_token_info(session_id, token_info, "target")

            source_status = client.get("/auth_status", params={"account_role": "source"})
            target_status = client.get("/auth_status", params={"account_role": "target"})

            self.assertEqual(source_status.status_code, 200)
            self.assertTrue(source_status.json()["authenticated"])
            self.assertEqual(target_status.status_code, 200)
            self.assertTrue(target_status.json()["authenticated"])

            logout_target = client.post("/logout", params={"account_role": "target"})

            self.assertEqual(logout_target.status_code, 200)
            self.assertEqual(logout_target.json(), {"authenticated": False})
            self.assertIn(SESSION_COOKIE_NAME, client.cookies)

            target_status_after_logout = client.get("/auth_status", params={"account_role": "target"})
            source_status_after_logout = client.get("/auth_status", params={"account_role": "source"})

            self.assertEqual(target_status_after_logout.status_code, 200)
            self.assertEqual(target_status_after_logout.json(), {"authenticated": False})
            self.assertEqual(source_status_after_logout.status_code, 200)
            self.assertTrue(source_status_after_logout.json()["authenticated"])


if __name__ == "__main__":
    unittest.main()
