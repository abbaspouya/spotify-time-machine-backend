import os
import unittest

from fastapi.testclient import TestClient


os.environ.setdefault("SPOTIFY_CLIENT_ID", "test-client-id")
os.environ.setdefault("SPOTIFY_CLIENT_SECRET", "test-client-secret")
os.environ.setdefault("SPOTIFY_REDIRECT_URI", "http://127.0.0.1:8000/callback")
os.environ.setdefault("FRONTEND_URL", "http://127.0.0.1:5173")

from backend.app.main import app


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


if __name__ == "__main__":
    unittest.main()
