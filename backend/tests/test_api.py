import os
import unittest
from time import time
from urllib.parse import parse_qs, urlsplit
from unittest.mock import patch

from fastapi.testclient import TestClient
from requests.exceptions import Timeout
from spotipy.exceptions import SpotifyException


os.environ.setdefault("SPOTIFY_CLIENT_ID", "test-client-id")
os.environ.setdefault("SPOTIFY_CLIENT_SECRET", "test-client-secret")
os.environ.setdefault("SPOTIFY_REDIRECT_URI", "http://127.0.0.1:8000/callback")
os.environ.setdefault("FRONTEND_URL", "http://127.0.0.1:5173")

from backend.app.main import app
from backend.app.core.auth import get_spotify_client_for_session
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

    def test_whoami_uses_profile_schema_in_openapi(self):
        response = self.client.get("/openapi.json")

        self.assertEqual(response.status_code, 200)
        whoami_schema = response.json()["paths"]["/whoami"]["get"]["responses"]["200"]["content"]["application/json"]["schema"]
        self.assertEqual(whoami_schema["$ref"], "#/components/schemas/WhoAmIResponse")

    def test_whoami_returns_gateway_timeout_when_spotify_does_not_respond(self):
        class TimeoutSpotify:
            def current_user(self):
                raise Timeout("spotify timed out")

        with patch("backend.app.api.routes_auth.get_spotify_client", return_value=TimeoutSpotify()):
            response = self.client.get("/whoami")

        self.assertEqual(response.status_code, 504)
        self.assertEqual(
            response.json()["detail"],
            "Spotify did not respond in time. Refresh your connection and try again.",
        )

    def test_whoami_returns_retry_after_when_spotify_rate_limits(self):
        class RateLimitedSpotify:
            def current_user(self):
                raise SpotifyException(
                    429,
                    -1,
                    "Too Many Requests",
                    reason="rate limited",
                    headers={"Retry-After": "17"},
                )

        with patch("backend.app.api.routes_auth.get_spotify_client", return_value=RateLimitedSpotify()):
            response = self.client.get("/whoami")

        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.headers.get("Retry-After"), "17")
        self.assertEqual(
            response.json()["detail"],
            "Spotify is rate-limiting requests right now. Try again in about 17 seconds.",
        )

    def test_spotify_client_disables_status_forcelist_retries(self):
        with patch(
            "backend.app.core.auth.get_token_info_for_session",
            return_value={"access_token": "test-access-token"},
        ), patch("backend.app.core.auth.spotipy.Spotify") as spotify_class:
            get_spotify_client_for_session("test-session", "source")

        kwargs = spotify_class.call_args.kwargs
        self.assertEqual(kwargs["retries"], 0)
        self.assertEqual(kwargs["status_retries"], 0)
        self.assertEqual(kwargs["status_forcelist"], ())

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

    def test_callback_recovers_session_from_oauth_state_when_cookie_is_missing(self):
        with TestClient(app) as original_client:
            login_response = original_client.get(
                "/login",
                params={"raw": True, "return_to": "/app/transfer-library"},
                headers={"referer": "http://localhost:5173/app/transfer-library"},
            )

            self.assertEqual(login_response.status_code, 200)
            session_id = original_client.cookies.get(SESSION_COOKIE_NAME)
            self.assertIsNotNone(session_id)

            auth_url = login_response.json()["auth_url"]
            state = parse_qs(urlsplit(auth_url).query)["state"][0]

            token_info = {
                "access_token": "test-access-token",
                "token_type": "Bearer",
                "scope": SPOTIFY_SCOPE,
                "expires_at": int(time()) + 3600,
            }

            def fake_get_oauth_for_session(callback_session_id: str, account_role: str):
                class FakeCacheHandler:
                    def save_token_to_cache(self, value):
                        save_token_info(callback_session_id, value, account_role)

                class FakeOAuth:
                    cache_handler = FakeCacheHandler()

                    def get_access_token(self, code, as_dict=True):
                        self.last_code = code
                        self.last_as_dict = as_dict
                        return token_info

                return FakeOAuth()

            with patch("backend.app.api.routes_auth.get_oauth_for_session", side_effect=fake_get_oauth_for_session):
                with TestClient(app) as callback_client:
                    callback_response = callback_client.get(
                        "/callback",
                        params={"code": "test-code", "state": state},
                        follow_redirects=False,
                    )

            self.assertEqual(callback_response.status_code, 303)
            self.assertTrue(
                callback_response.headers["location"].startswith(
                    "http://localhost:5173/auth/callback?status=success"
                )
            )

            auth_status_response = original_client.get("/auth_status")

            self.assertEqual(auth_status_response.status_code, 200)
            self.assertTrue(auth_status_response.json()["authenticated"])


if __name__ == "__main__":
    unittest.main()
