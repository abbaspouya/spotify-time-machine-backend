import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient


os.environ.setdefault("SPOTIFY_CLIENT_ID", "test-client-id")
os.environ.setdefault("SPOTIFY_CLIENT_SECRET", "test-client-secret")
os.environ.setdefault("SPOTIFY_REDIRECT_URI", "http://127.0.0.1:8000/callback")
os.environ.setdefault("FRONTEND_URL", "http://127.0.0.1:5173")

from backend.app.main import app


def _playlist(playlist_id: str, name: str, track_total: int, image_url: str | None = None) -> dict:
    images = [{"url": image_url}] if image_url else []
    return {
        "id": playlist_id,
        "name": name,
        "description": f"{name} description",
        "public": False,
        "collaborative": False,
        "owner": {"id": "user-1", "display_name": "Playlist Owner"},
        "images": images,
        "external_urls": {"spotify": f"https://open.spotify.com/playlist/{playlist_id}"},
        "tracks": {"total": track_total},
    }


def _track_item(
    track_id: str | None,
    name: str,
    *,
    added_at: str,
    position_suffix: str,
    is_local: bool = False,
    field_name: str = "track",
) -> dict:
    album_id = f"album-{position_suffix}"
    artist_id = f"artist-{position_suffix}"
    external_track_url = None if track_id is None else f"https://open.spotify.com/track/{track_id}"
    uri = None if track_id is None else f"spotify:track:{track_id}"

    return {
        "added_at": added_at,
        "added_by": {"id": "adder-1"},
        field_name: {
            "id": track_id,
            "uri": uri,
            "type": "track",
            "name": name,
            "duration_ms": 180000,
            "explicit": False,
            "is_local": is_local,
            "artists": [{"id": artist_id, "name": f"Artist {position_suffix}"}],
            "album": {
                "id": album_id,
                "name": f"Album {position_suffix}",
                "images": [{"url": f"https://img/{album_id}.jpg"}],
                "external_urls": {"spotify": f"https://open.spotify.com/album/{album_id}"},
            },
            "external_urls": {"spotify": external_track_url} if external_track_url else {},
        },
    }


class FakeSpotifyPlaylists:
    def __init__(self):
        self.current_user_playlists_calls: list[tuple[int, int]] = []
        self.playlist_calls: list[tuple[str, str | None]] = []
        self.playlist_items_calls: list[tuple[str, dict]] = []
        self.post_calls: list[tuple[str, dict | None]] = []
        self.put_calls: list[tuple[str, dict | None]] = []
        self.playlists_by_id = {
            "playlist-1": _playlist("playlist-1", "Road Trip", 2, image_url="https://img/playlist-1.jpg"),
            "playlist-2": _playlist("playlist-2", "Focus", 1),
            "playlist-transfer-source": _playlist("playlist-transfer-source", "Phone Draft", 3, image_url="https://img/source.jpg"),
            "playlist-transfer-target": _playlist("playlist-transfer-target", "Archive", 5, image_url="https://img/target.jpg"),
        }

    def current_user_playlists(self, limit: int = 50, offset: int = 0):
        self.current_user_playlists_calls.append((limit, offset))
        pages = {
            0: {
                "items": [self.playlists_by_id["playlist-1"]],
                "total": 2,
            },
            1: {
                "items": [self.playlists_by_id["playlist-2"]],
                "total": 2,
            },
        }
        return pages.get(offset, {"items": [], "total": 2})

    def playlist(self, playlist_id: str, fields: str | None = None):
        self.playlist_calls.append((playlist_id, fields))
        return self.playlists_by_id[playlist_id]

    def _get_id(self, item_type: str, item_id: str):
        if item_type != "playlist":
            raise AssertionError(f"Unexpected item_type: {item_type}")
        return item_id

    def _get_uri(self, item_type: str, item_id: str):
        if item_type != "track":
            raise AssertionError(f"Unexpected item_type: {item_type}")
        return item_id if item_id.startswith("spotify:") else f"spotify:track:{item_id}"

    def _get(self, url: str, **kwargs):
        self.playlist_items_calls.append((url, kwargs))
        offset = kwargs.get("offset", 0)
        playlist_id = url.split("/")[1]

        if playlist_id == "playlist-1":
            pages = {
                0: {
                    "items": [
                        _track_item(
                            "track-1",
                            "First Song",
                            added_at="2026-04-01T10:00:00Z",
                            position_suffix="1",
                        )
                    ],
                    "total": 2,
                },
                1: {
                    "items": [
                        _track_item(
                            None,
                            "Local File Song",
                            added_at="2026-04-02T11:00:00Z",
                            position_suffix="2",
                            is_local=True,
                            field_name="item",
                        )
                    ],
                    "total": 2,
                },
            }
            return pages.get(offset, {"items": [], "total": 2})

        if playlist_id == "playlist-transfer-source":
            pages = {
                0: {
                    "items": [
                        _track_item(
                            "track-a",
                            "Alpha Song",
                            added_at="2026-03-01T08:00:00Z",
                            position_suffix="transfer-a",
                        ),
                        _track_item(
                            None,
                            "Phone Local",
                            added_at="2026-03-02T08:00:00Z",
                            position_suffix="transfer-local",
                            is_local=True,
                            field_name="item",
                        ),
                        _track_item(
                            "track-b",
                            "Beta Song",
                            added_at="2026-03-03T08:00:00Z",
                            position_suffix="transfer-b",
                        ),
                    ],
                    "total": 3,
                },
            }
            return pages.get(offset, {"items": [], "total": 3})

        return {"items": [], "total": 0}

    def _post(self, url: str, payload=None, **kwargs):
        self.post_calls.append((url, payload))
        return {"snapshot_id": "snapshot-1"}

    def _put(self, url: str, args=None, payload=None, **kwargs):
        self.put_calls.append((url, args))
        return None


class PlaylistsApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_playlists_endpoint_returns_normalized_playlist_summaries(self):
        fake_sp = FakeSpotifyPlaylists()

        with patch("backend.app.api.routes_playlists.get_spotify_client", return_value=fake_sp):
            response = self.client.get("/playlists")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["total_playlists"], 2)
        self.assertEqual(payload["playlists"][0]["id"], "playlist-1")
        self.assertEqual(payload["playlists"][0]["name"], "Road Trip")
        self.assertEqual(payload["playlists"][0]["owner"]["display_name"], "Playlist Owner")
        self.assertEqual(payload["playlists"][0]["image_url"], "https://img/playlist-1.jpg")
        self.assertEqual(payload["playlists"][0]["track_count"], 2)
        self.assertEqual(payload["playlists"][1]["id"], "playlist-2")
        self.assertEqual(fake_sp.current_user_playlists_calls, [(50, 0), (50, 1)])
        self.assertIn("X-Request-ID", response.headers)

    def test_playlist_tracks_endpoint_returns_normalized_song_rows(self):
        fake_sp = FakeSpotifyPlaylists()

        with patch("backend.app.api.routes_playlists.get_spotify_client", return_value=fake_sp):
            response = self.client.get("/playlists/playlist-1/tracks")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["playlist"]["id"], "playlist-1")
        self.assertEqual(payload["playlist"]["name"], "Road Trip")
        self.assertEqual(payload["total_tracks"], 2)
        self.assertEqual(payload["tracks"][0]["position"], 0)
        self.assertEqual(payload["tracks"][0]["id"], "track-1")
        self.assertEqual(payload["tracks"][0]["artists"][0]["name"], "Artist 1")
        self.assertEqual(payload["tracks"][0]["album"]["image_url"], "https://img/album-1.jpg")
        self.assertEqual(payload["tracks"][1]["position"], 1)
        self.assertTrue(payload["tracks"][1]["is_local"])
        self.assertIsNone(payload["tracks"][1]["id"])
        self.assertEqual(
            fake_sp.playlist_items_calls,
            [
                (
                    "playlists/playlist-1/items",
                    {"limit": 100, "offset": 0, "fields": None, "market": None, "additional_types": "track"},
                ),
                (
                    "playlists/playlist-1/items",
                    {"limit": 100, "offset": 1, "fields": None, "market": None, "additional_types": "track"},
                ),
            ],
        )
        self.assertEqual(fake_sp.playlist_calls[0][0], "playlist-1")
        self.assertIn("X-Request-ID", response.headers)

    def test_append_playlist_endpoint_adds_tracks_to_another_playlist_at_the_top(self):
        fake_sp = FakeSpotifyPlaylists()

        with patch("backend.app.api.routes_playlists.get_spotify_client", return_value=fake_sp):
            response = self.client.post(
                "/playlists/append?account_role=target",
                json={
                    "source_playlist_id": "playlist-transfer-source",
                    "target_type": "playlist",
                    "target_playlist_id": "playlist-transfer-target",
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["tracks_added"], 2)
        self.assertEqual(payload["skipped_tracks"], 1)
        self.assertEqual(payload["target"]["kind"], "playlist")
        self.assertEqual(payload["target"]["id"], "playlist-transfer-target")
        self.assertEqual(
            fake_sp.post_calls,
            [
                (
                    "playlists/playlist-transfer-target/items",
                    {"uris": ["spotify:track:track-a", "spotify:track:track-b"], "position": 0},
                )
            ],
        )
        self.assertEqual(
            payload["warnings"],
            ["Skipped 1 local track because Spotify cannot move local files between collections."],
        )
        self.assertIn("X-Request-ID", response.headers)

    def test_append_playlist_endpoint_adds_tracks_to_liked_songs(self):
        fake_sp = FakeSpotifyPlaylists()

        with patch("backend.app.api.routes_playlists.get_spotify_client", return_value=fake_sp):
            response = self.client.post(
                "/playlists/append",
                json={
                    "source_playlist_id": "playlist-transfer-source",
                    "target_type": "liked_tracks",
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["tracks_added"], 2)
        self.assertEqual(payload["target"]["kind"], "liked_tracks")
        self.assertEqual(
            fake_sp.put_calls,
            [("me/library", {"uris": "spotify:track:track-a,spotify:track:track-b"})],
        )
        self.assertIn("X-Request-ID", response.headers)

    def test_append_playlist_endpoint_rejects_using_the_same_playlist_as_source_and_target(self):
        fake_sp = FakeSpotifyPlaylists()

        with patch("backend.app.api.routes_playlists.get_spotify_client", return_value=fake_sp):
            response = self.client.post(
                "/playlists/append",
                json={
                    "source_playlist_id": "playlist-transfer-source",
                    "target_type": "playlist",
                    "target_playlist_id": "playlist-transfer-source",
                },
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Choose a different target playlist.")
        self.assertIn("X-Request-ID", response.headers)


if __name__ == "__main__":
    unittest.main()
