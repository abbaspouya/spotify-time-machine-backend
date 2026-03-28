import unittest

from backend.app.services.account_snapshot import preview_account_snapshot_import, summarize_snapshot


class FakeSpotify:
    def __init__(self):
        self._current_user = {"id": "target-user"}
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
        self.assertIn("Selected areas of the target account will be cleared before the snapshot is applied.", preview["warnings"])
        self.assertIn(
            "Strict liked order will import liked songs one by one, which is slower but better for visible ordering.",
            preview["warnings"],
        )
        self.assertGreaterEqual(len(preview["destructive_operations"]), 4)


if __name__ == "__main__":
    unittest.main()
