import os
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient


os.environ.setdefault("SPOTIFY_CLIENT_ID", "test-client-id")
os.environ.setdefault("SPOTIFY_CLIENT_SECRET", "test-client-secret")
os.environ.setdefault("SPOTIFY_REDIRECT_URI", "http://127.0.0.1:8000/callback")
os.environ.setdefault("FRONTEND_URL", "http://127.0.0.1:5173")

from backend.app.main import app
from backend.app.services.top_tracks import get_top_tracks_summary, resolve_top_tracks_timeframe


FIXED_NOW = datetime(2026, 3, 30, 12, 0, tzinfo=timezone.utc)


def _track(track_id: str, name: str, artist_name: str, album_name: str, image_url: str) -> dict:
    return {
        "id": track_id,
        "uri": f"spotify:track:{track_id}",
        "name": name,
        "artists": [{"id": f"artist-{track_id}", "name": artist_name}],
        "album": {
            "name": album_name,
            "images": [{"url": image_url}],
        },
        "external_urls": {"spotify": f"https://open.spotify.com/track/{track_id}"},
        "duration_ms": 180000,
    }


class FakeSpotifyTopTracks:
    def current_user_top_tracks(self, time_range: str, limit: int = 50):
        items = {
            "short_term": [
                _track("track-short-1", "Short One", "Alpha", "Short Album", "https://img/short-1.jpg"),
                _track("track-short-2", "Short Two", "Beta", "Short Album", "https://img/short-2.jpg"),
            ],
            "medium_term": [
                _track("track-medium-1", "Medium One", "Gamma", "Medium Album", "https://img/medium-1.jpg"),
            ],
            "long_term": [
                _track("track-long-1", "Long One", "Delta", "Long Album", "https://img/long-1.jpg"),
            ],
        }[time_range]

        return {"items": items[:limit]}


class FakeSpotifyRecentTracks:
    def current_user_recently_played(self, limit: int = 50, before: int | None = None):
        first_page = {
            "items": [
                {"played_at": "2026-03-30T11:45:00Z", "track": _track("track-a", "Track A", "Alpha", "Signals", "https://img/a.jpg")},
                {"played_at": "2026-03-29T09:30:00Z", "track": _track("track-b", "Track B", "Beta", "Signals", "https://img/b.jpg")},
                {"played_at": "2026-03-28T19:15:00Z", "track": _track("track-a", "Track A", "Alpha", "Signals", "https://img/a.jpg")},
            ],
            "cursors": {"before": 111},
        }
        second_page = {
            "items": [
                {"played_at": "2026-03-24T10:00:00Z", "track": _track("track-c", "Track C", "Gamma", "Signals", "https://img/c.jpg")},
                {"played_at": "2026-03-20T08:00:00Z", "track": _track("track-d", "Track D", "Delta", "Old", "https://img/d.jpg")},
            ],
            "cursors": {},
        }

        if before is None:
            return first_page
        if before == 111:
            return second_page
        return {"items": [], "cursors": {}}


class TopTracksServiceTests(unittest.TestCase):
    def test_resolve_top_tracks_timeframe_rejects_custom(self):
        with self.assertRaisesRegex(ValueError, "Unsupported timeframe 'custom'"):
            resolve_top_tracks_timeframe("custom")

    @patch("backend.app.services.top_tracks._utc_now", return_value=FIXED_NOW)
    def test_recent_window_tracks_are_ranked_by_play_count_then_recency(self, _mock_now):
        summary = get_top_tracks_summary(FakeSpotifyRecentTracks(), timeframe="1_week")

        self.assertEqual(summary["selected_timeframe"]["key"], "1_week")
        self.assertEqual(summary["tracks"][0]["id"], "track-a")
        self.assertEqual(summary["tracks"][0]["play_count"], 2)
        self.assertEqual(summary["tracks"][1]["id"], "track-b")
        self.assertEqual(summary["tracks"][2]["id"], "track-c")
        self.assertEqual(summary["scanned_plays"], 4)
        self.assertFalse(summary["is_partial"])

    def test_spotify_top_items_use_requested_time_range(self):
        summary = get_top_tracks_summary(FakeSpotifyTopTracks(), timeframe="4_weeks", limit=2)

        self.assertEqual(summary["selected_timeframe"]["spotify_time_range"], "short_term")
        self.assertEqual(summary["track_count"], 2)
        self.assertIsNone(summary["tracks"][0]["play_count"])
        self.assertEqual(summary["tracks"][0]["name"], "Short One")


class TopTracksApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_top_tracks_endpoint_returns_selected_timeframe(self):
        fake_sp = FakeSpotifyTopTracks()

        with patch("backend.app.api.routes_discovery.get_spotify_client", return_value=fake_sp):
            response = self.client.get("/top_tracks", params={"timeframe": "4_weeks", "limit": 2})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["selected_timeframe"]["key"], "4_weeks")
        self.assertEqual(payload["track_count"], 2)
        self.assertEqual(payload["tracks"][0]["name"], "Short One")
        self.assertIn("X-Request-ID", response.headers)

    def test_top_tracks_endpoint_rejects_custom_timeframe(self):
        fake_sp = FakeSpotifyTopTracks()

        with patch("backend.app.api.routes_discovery.get_spotify_client", return_value=fake_sp):
            response = self.client.get("/top_tracks", params={"timeframe": "custom"})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["detail"],
            "Unsupported timeframe 'custom'. Use one of: 1_week, 4_weeks, 6_months, lifetime.",
        )


if __name__ == "__main__":
    unittest.main()
