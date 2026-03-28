import unittest

from backend.app.services.spotify_time_machine import group_songs_by_period


class GroupSongsByPeriodTests(unittest.TestCase):
    def test_monthly_grouping_respects_year_range_and_order(self):
        songs = [
            {"added_at": "2023-12-31T23:59:59Z", "track": {"id": "track-old"}},
            {"added_at": "2024-01-02T10:00:00Z", "track": {"id": "track-a"}},
            {"added_at": "2024-01-10T10:00:00Z", "track": {"id": "track-b"}},
            {"added_at": "2024-03-01T08:00:00Z", "track": {"id": "track-c"}},
        ]

        groups = group_songs_by_period(
            songs,
            period_type="monthly",
            start_year=2024,
            end_year=2024,
            order="asc",
        )

        self.assertEqual(
            groups,
            {
                "2024(01)": ["track-a", "track-b"],
                "2024(03)": ["track-c"],
            },
        )

    def test_yearly_grouping_can_sort_newest_first(self):
        songs = [
            {"added_at": "2024-01-10T10:00:00Z", "track": {"id": "track-a"}},
            {"added_at": "2024-06-10T10:00:00Z", "track": {"id": "track-b"}},
            {"added_at": "2025-02-10T10:00:00Z", "track": {"id": "track-c"}},
        ]

        groups = group_songs_by_period(songs, period_type="yearly", order="desc")

        self.assertEqual(groups["2024"], ["track-b", "track-a"])
        self.assertEqual(groups["2025"], ["track-c"])


if __name__ == "__main__":
    unittest.main()
