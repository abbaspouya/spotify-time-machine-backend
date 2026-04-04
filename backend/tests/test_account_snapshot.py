import unittest
from unittest.mock import patch

from spotipy.exceptions import SpotifyException

from backend.app.services.account_snapshot import (
    export_account_snapshot,
    import_account_snapshot,
    preview_account_snapshot_import,
    summarize_snapshot,
)


class FakeSpotify:
    def __init__(self):
        self._current_user = {
            "id": "target-user",
            "display_name": "Target User",
            "country": "IT",
            "product": "premium",
            "images": [{"url": "https://images.example/target-user.jpg"}],
            "external_urls": {"spotify": "https://open.spotify.com/user/target-user"},
        }
        self._playlists = [
            {"id": "existing-playlist-1", "owner": {"id": "target-user"}},
            {"id": "existing-playlist-2", "owner": {"id": "target-user"}},
        ]
        self._saved_tracks = [
            {"track": {"id": "liked-1"}},
            {"track": {"id": "liked-2"}},
            {"track": {"id": "liked-3"}},
        ]
        self._saved_albums = [
            {"album": {"id": "album-1"}},
            {"album": {"id": "album-2"}},
        ]
        self._followed_artists = [
            {"id": "artist-1"},
            {"id": "artist-2"},
            {"id": "artist-3"},
        ]

    def current_user(self):
        return self._current_user

    def current_user_playlists(self, limit=50, offset=0):
        return {"items": self._playlists[offset:offset + limit]}

    def current_user_saved_tracks(self, limit=50, offset=0):
        return {"items": self._saved_tracks[offset:offset + limit]}

    def current_user_saved_albums(self, limit=50, offset=0):
        return {"items": self._saved_albums[offset:offset + limit]}

    def current_user_followed_artists(self, limit=50, after=None):
        if after:
            return {"artists": {"items": [], "cursors": {}}}

        return {
            "artists": {
                "items": self._followed_artists[:limit],
                "cursors": {"after": None},
            }
        }


class ExportFakeSpotify:
    def __init__(self):
        self._current_user = {
            "id": "source-user",
            "display_name": "Source User",
        }
        self._playlists = [
            {"id": "good-playlist", "name": "Good Playlist", "description": "", "public": False, "collaborative": False},
            {"id": "locked-playlist", "name": "Locked Playlist", "description": "", "public": False, "collaborative": False},
        ]
        self.additional_types_seen: list[str] = []

    def current_user(self):
        return self._current_user

    def current_user_playlists(self, limit=50, offset=0):
        return {"items": self._playlists[offset:offset + limit]}

    def _get_id(self, item_type, item_id):
        if item_type != "playlist":
            raise AssertionError(f"Unexpected item_type: {item_type}")
        return item_id

    def _get(self, url, args=None, payload=None, **kwargs):
        self.additional_types_seen.append(kwargs.get("additional_types"))
        if kwargs.get("additional_types") != "track":
            raise AssertionError(f"Unexpected additional_types: {kwargs.get('additional_types')}")

        playlist_id = url.split("/")[1]
        offset = kwargs.get("offset", 0)

        if playlist_id == "locked-playlist":
            raise SpotifyException(403, -1, "Forbidden")

        if offset > 0:
            return {"items": []}

        return {
            "items": [
                {
                    "added_at": "2024-01-01T00:00:00Z",
                    "item": {"uri": "spotify:track:good-track", "is_local": False, "type": "track"},
                }
            ]
        }


class AccountSnapshotTests(unittest.TestCase):
    def test_summarize_snapshot_counts_playlist_and_library_content(self):
        snapshot = {
            "playlists": [
                {"tracks": [{"uri": "spotify:track:1"}, {"uri": "spotify:track:2"}]},
                {"tracks": [{"uri": "spotify:track:3"}]},
            ],
            "liked_tracks": [{"uri": "spotify:track:4"}],
            "saved_albums": [{"uri": "spotify:album:1"}, {"uri": "spotify:album:2"}],
            "followed_artists": [{"id": "artist-1"}],
        }

        self.assertEqual(
            summarize_snapshot(snapshot),
            {
                "playlists": 2,
                "playlist_tracks": 3,
                "liked_tracks": 1,
                "saved_albums": 2,
                "followed_artists": 1,
            },
        )

    def test_preview_import_reports_additions_removals_and_warnings(self):
        snapshot = {
            "source_user_id": "source-user",
            "source_account": {
                "id": "source-user",
                "display_name": "Source User",
                "image_url": "https://images.example/source-user.jpg",
                "profile_url": "https://open.spotify.com/user/source-user",
                "country": "US",
                "product": "premium",
            },
            "playlists": [
                {
                    "name": "Imported Mix",
                    "tracks": [
                        {"uri": "spotify:track:new-1", "position": 0},
                        {"uri": "spotify:track:new-2", "position": 1},
                    ],
                }
            ],
            "liked_tracks": [
                {"uri": "spotify:track:liked-new", "added_at": "2024-01-05T00:00:00Z", "position": 0}
            ],
            "saved_albums": [
                {"uri": "spotify:album:new-album", "position": 0}
            ],
            "followed_artists": [
                {"id": "artist-new"}
            ],
        }

        preview = preview_account_snapshot_import(
            sp=FakeSpotify(),
            snapshot=snapshot,
            clear_existing_before_import=True,
            strict_liked_order=True,
        )

        self.assertEqual(preview["summary"]["playlists_created"], 1)
        self.assertEqual(preview["summary"]["playlist_tracks_added"], 2)
        self.assertEqual(preview["summary"]["liked_tracks_added"], 1)
        self.assertEqual(preview["summary"]["saved_albums_added"], 1)
        self.assertEqual(preview["summary"]["followed_artists_added"], 1)
        self.assertEqual(preview["summary"]["playlists_removed"], 2)
        self.assertEqual(preview["summary"]["liked_tracks_removed"], 3)
        self.assertEqual(preview["summary"]["saved_albums_removed"], 2)
        self.assertEqual(preview["summary"]["followed_artists_removed"], 3)
        self.assertTrue(preview["requires_confirmation"])
        self.assertEqual(preview["source_account"]["display_name"], "Source User")
        self.assertEqual(preview["target_account"]["display_name"], "Target User")
        self.assertEqual(preview["target_account"]["image_url"], "https://images.example/target-user.jpg")
        self.assertIn("Selected areas of the target account will be cleared before the snapshot is applied.", preview["warnings"])
        self.assertIn(
            "Strict liked order will import liked songs one by one with a 0.75s delay between songs, a 20s cooldown every 25 songs, an automatic stop after 2 consecutive rate-limited songs so you can resume later.",
            preview["warnings"],
        )
        self.assertGreaterEqual(len(preview["destructive_operations"]), 4)

    def test_preview_import_strict_resume_skips_liked_cleanup(self):
        snapshot = {
            "liked_tracks": [
                {"uri": "spotify:track:liked-new-1", "added_at": "2024-01-05T00:00:00Z", "position": 0},
                {"uri": "spotify:track:liked-new-2", "added_at": "2024-01-06T00:00:00Z", "position": 1},
            ],
        }

        preview = preview_account_snapshot_import(
            sp=FakeSpotify(),
            snapshot=snapshot,
            import_playlists=False,
            import_saved_albums=False,
            import_followed_artists=False,
            clear_existing_before_import=True,
            strict_liked_order=True,
            strict_liked_order_resume_from_index=1,
        )

        self.assertEqual(preview["summary"]["liked_tracks_added"], 1)
        self.assertEqual(preview["summary"]["liked_tracks_removed"], 0)
        self.assertIn(
            "Liked-song cleanup will be skipped because strict liked-order resume must preserve songs that were already imported.",
            preview["warnings"],
        )
        self.assertIn(
            "Strict liked-song import will resume from position 2 of 2.",
            preview["warnings"],
        )

    def test_export_snapshot_skips_forbidden_playlist_and_keeps_other_playlists(self):
        fake_spotify = ExportFakeSpotify()
        snapshot = export_account_snapshot(
            sp=fake_spotify,
            include_playlists=True,
            include_liked_tracks=False,
            include_saved_albums=False,
            include_followed_artists=False,
        )

        self.assertEqual(fake_spotify.additional_types_seen, ["track", "track"])
        self.assertEqual(snapshot["counts"]["playlists"], 1)
        self.assertEqual(snapshot["counts"]["playlist_tracks"], 1)
        self.assertEqual(snapshot["playlists"][0]["id"], "good-playlist")
        self.assertEqual(
            snapshot["warnings"],
            ["Skipped playlist 'Locked Playlist' (locked-playlist) because Spotify denied access to its tracks."],
        )

    def test_import_snapshot_uses_generic_library_endpoints_for_library_content(self):
        class LibraryImportFakeSpotify:
            def __init__(self):
                self._current_user = {"id": "target-user", "display_name": "Target User"}
                self._saved_tracks = [{"track": {"id": "existing-track"}}]
                self._saved_albums = [{"album": {"id": "existing-album"}}]
                self._followed_artists = [{"id": "existing-artist"}]
                self.put_calls: list[tuple[str, dict]] = []
                self.delete_calls: list[tuple[str, dict]] = []

            def current_user(self):
                return self._current_user

            def current_user_saved_tracks(self, limit=50, offset=0):
                return {"items": self._saved_tracks[offset:offset + limit]}

            def current_user_saved_albums(self, limit=50, offset=0):
                return {"items": self._saved_albums[offset:offset + limit]}

            def current_user_followed_artists(self, limit=50, after=None):
                if after:
                    return {"artists": {"items": [], "cursors": {}}}
                return {"artists": {"items": self._followed_artists[:limit], "cursors": {"after": None}}}

            def _put(self, url, args=None, payload=None, **kwargs):
                self.put_calls.append((url, args or {}))
                return None

            def _delete(self, url, args=None, payload=None, **kwargs):
                self.delete_calls.append((url, args or {}))
                return None

        snapshot = {
            "liked_tracks": [{"uri": "spotify:track:new-track", "position": 0}],
            "saved_albums": [{"uri": "spotify:album:new-album", "position": 0}],
            "followed_artists": [{"id": "new-artist"}],
        }
        fake_spotify = LibraryImportFakeSpotify()

        result = import_account_snapshot(
            sp=fake_spotify,
            snapshot=snapshot,
            import_playlists=False,
            clear_existing_before_import=True,
        )

        self.assertEqual(result["summary"]["liked_tracks_removed"], 1)
        self.assertEqual(result["summary"]["saved_albums_removed"], 1)
        self.assertEqual(result["summary"]["followed_artists_removed"], 1)
        self.assertEqual(result["summary"]["liked_tracks_added"], 1)
        self.assertEqual(result["summary"]["saved_albums_added"], 1)
        self.assertEqual(result["summary"]["followed_artists_added"], 1)
        self.assertEqual(
            fake_spotify.delete_calls,
            [
                ("me/library", {"uris": "spotify:track:existing-track"}),
                ("me/library", {"uris": "spotify:album:existing-album"}),
                ("me/library", {"uris": "spotify:artist:existing-artist"}),
            ],
        )
        self.assertEqual(
            fake_spotify.put_calls,
            [
                ("me/library", {"uris": "spotify:track:new-track"}),
                ("me/library", {"uris": "spotify:album:new-album"}),
                ("me/library", {"uris": "spotify:artist:new-artist"}),
            ],
        )

    def test_import_snapshot_batches_library_writes_in_groups_of_40(self):
        class LibraryBatchingFakeSpotify:
            def __init__(self):
                self._current_user = {"id": "target-user", "display_name": "Target User"}
                self.put_calls: list[tuple[str, dict]] = []

            def current_user(self):
                return self._current_user

            def _put(self, url, args=None, payload=None, **kwargs):
                self.put_calls.append((url, args or {}))
                return None

        liked_tracks = [
            {"uri": f"spotify:track:track-{index}", "position": index}
            for index in range(41)
        ]
        fake_spotify = LibraryBatchingFakeSpotify()

        result = import_account_snapshot(
            sp=fake_spotify,
            snapshot={"liked_tracks": liked_tracks},
            import_playlists=False,
            import_saved_albums=False,
            import_followed_artists=False,
            clear_existing_before_import=False,
        )

        self.assertEqual(result["summary"]["liked_tracks_added"], 41)
        self.assertEqual(len(fake_spotify.put_calls), 2)
        self.assertEqual(fake_spotify.put_calls[0][0], "me/library")
        self.assertEqual(len(fake_spotify.put_calls[0][1]["uris"].split(",")), 40)
        self.assertEqual(fake_spotify.put_calls[1], ("me/library", {"uris": "spotify:track:track-40"}))

    def test_import_snapshot_strict_liked_order_retries_rate_limited_tracks(self):
        class StrictOrderRetryFakeSpotify:
            def __init__(self):
                self._current_user = {"id": "target-user", "display_name": "Target User"}
                self.put_attempts = 0

            def current_user(self):
                return self._current_user

            def _put(self, url, args=None, payload=None, **kwargs):
                self.put_attempts += 1
                if self.put_attempts < 3:
                    raise SpotifyException(
                        429,
                        -1,
                        "Too Many Requests",
                        reason="rate limited",
                        headers={"Retry-After": "0"},
                    )
                return None

        fake_spotify = StrictOrderRetryFakeSpotify()

        with patch("backend.app.services.account_snapshot.time.sleep") as sleep_mock:
            result = import_account_snapshot(
                sp=fake_spotify,
                snapshot={"liked_tracks": [{"uri": "spotify:track:new-track", "position": 0}]},
                import_playlists=False,
                import_saved_albums=False,
                import_followed_artists=False,
                clear_existing_before_import=False,
                strict_liked_order=True,
            )

        self.assertEqual(fake_spotify.put_attempts, 3)
        self.assertEqual(result["summary"]["liked_tracks_added"], 1)
        self.assertEqual(result["summary"]["liked_tracks_failed"], 0)
        self.assertIsNone(result["next_resume_index"])
        self.assertIn(
            "Strict liked order will import liked songs one by one with a 0.75s delay between songs, a 20s cooldown every 25 songs, an automatic stop after 2 consecutive rate-limited songs so you can resume later.",
            result["warnings"],
        )
        self.assertEqual(sleep_mock.call_count, 2)

    def test_import_snapshot_strict_liked_order_stops_after_repeated_rate_limits(self):
        class StrictOrderAlwaysRateLimitedSpotify:
            def __init__(self):
                self._current_user = {"id": "target-user", "display_name": "Target User"}
                self.put_attempts = 0

            def current_user(self):
                return self._current_user

            def _put(self, url, args=None, payload=None, **kwargs):
                self.put_attempts += 1
                raise SpotifyException(
                    429,
                    -1,
                    "Too Many Requests",
                    reason="rate limited",
                    headers={"Retry-After": "0"},
                )

        fake_spotify = StrictOrderAlwaysRateLimitedSpotify()

        with patch("backend.app.services.account_snapshot.time.sleep"):
            result = import_account_snapshot(
                sp=fake_spotify,
                snapshot={
                    "liked_tracks": [
                        {"uri": "spotify:track:first", "position": 0},
                        {"uri": "spotify:track:second", "position": 1},
                        {"uri": "spotify:track:third", "position": 2},
                    ]
                },
                import_playlists=False,
                import_saved_albums=False,
                import_followed_artists=False,
                clear_existing_before_import=False,
                strict_liked_order=True,
                strict_liked_order_max_consecutive_rate_limits=2,
            )

        self.assertEqual(result["summary"]["liked_tracks_added"], 0)
        self.assertEqual(result["summary"]["liked_tracks_failed"], 2)
        self.assertTrue(result["strict_liked_order"]["stopped_early"])
        self.assertFalse(result["strict_liked_order"]["completed"])
        self.assertEqual(result["next_resume_index"], 1)
        self.assertEqual(result["strict_liked_order"]["next_resume_index"], 1)
        self.assertIn(
            "Paused strict liked-song import after repeated Spotify rate limits. Resume from position 2.",
            result["warnings"],
        )


if __name__ == "__main__":
    unittest.main()
