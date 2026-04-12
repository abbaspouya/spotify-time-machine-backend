from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any

import spotipy


MAX_RECENTLY_PLAYED_REQUESTS = 60

PRESET_TIMEFRAMES: dict[str, dict[str, Any]] = {
    "1_week": {
        "key": "1_week",
        "label": "1 Week",
        "mode": "recent_window",
        "days": 7,
        "description": "Calculated from your recently played history over the last 7 days.",
        "disclaimer": "This view is based on recently played history, so very active accounts may be partial.",
    },
    "4_weeks": {
        "key": "4_weeks",
        "label": "4 Weeks",
        "mode": "spotify_top_items",
        "spotify_time_range": "short_term",
        "description": "Spotify's short-term top tracks view, which is closest to the last 4 weeks.",
        "disclaimer": None,
    },
    "6_months": {
        "key": "6_months",
        "label": "6 Months",
        "mode": "spotify_top_items",
        "spotify_time_range": "medium_term",
        "description": "Spotify's medium-term top tracks view, which is closest to the last 6 months.",
        "disclaimer": None,
    },
    "lifetime": {
        "key": "lifetime",
        "label": "Lifetime",
        "mode": "spotify_top_items",
        "spotify_time_range": "long_term",
        "description": "Spotify's longest top tracks window for this account.",
        "disclaimer": "Spotify does not expose true all-time listening history here, so lifetime uses the longest top-tracks window Spotify provides.",
    },
}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_spotify_datetime(value: str | None) -> datetime | None:
    if not value:
        return None

    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _format_iso_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None

    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def resolve_top_tracks_timeframe(timeframe: str) -> dict[str, Any]:
    normalized = timeframe.strip().lower()

    if normalized not in PRESET_TIMEFRAMES:
        allowed = ", ".join(sorted(PRESET_TIMEFRAMES.keys()))
        raise ValueError(f"Unsupported timeframe '{timeframe}'. Use one of: {allowed}.")

    return PRESET_TIMEFRAMES[normalized]


def _serialize_track(
    track: dict[str, Any],
    *,
    rank: int,
    play_count: int | None = None,
    last_played_at: datetime | None = None,
) -> dict[str, Any]:
    album = track.get("album", {}) or {}
    images = album.get("images") or []

    return {
        "rank": rank,
        "id": track.get("id"),
        "uri": track.get("uri"),
        "name": track.get("name"),
        "artist_names": [artist.get("name") for artist in track.get("artists", []) if artist.get("name")],
        "album_name": album.get("name"),
        "album_image_url": images[0].get("url") if images else None,
        "spotify_url": track.get("external_urls", {}).get("spotify"),
        "duration_ms": track.get("duration_ms"),
        "play_count": play_count,
        "last_played_at": _format_iso_datetime(last_played_at),
    }


def _fetch_recent_window_top_tracks(sp: spotipy.Spotify, *, days: int, limit: int) -> dict[str, Any]:
    now = _utc_now()
    cutoff = now - timedelta(days=days)
    before_cursor: int | None = None
    reached_cutoff = False
    page_budget_hit = False

    play_counts: Counter[str] = Counter()
    latest_play_by_track: dict[str, datetime] = {}
    tracks_by_id: dict[str, dict[str, Any]] = {}
    scanned_plays = 0
    requests_made = 0

    while True:
        if requests_made >= MAX_RECENTLY_PLAYED_REQUESTS:
            page_budget_hit = True
            break

        request_kwargs: dict[str, Any] = {"limit": 50}
        if before_cursor is not None:
            request_kwargs["before"] = before_cursor

        response = sp.current_user_recently_played(**request_kwargs)
        requests_made += 1

        items = response.get("items", [])
        if not items:
            break

        for item in items:
            played_at = _parse_spotify_datetime(item.get("played_at"))
            if played_at is None:
                continue

            if played_at < cutoff:
                reached_cutoff = True
                continue

            track = item.get("track") or {}
            track_id = track.get("id")
            if not track_id:
                continue

            play_counts[track_id] += 1
            scanned_plays += 1
            tracks_by_id.setdefault(track_id, track)

            previous_latest = latest_play_by_track.get(track_id)
            if previous_latest is None or played_at > previous_latest:
                latest_play_by_track[track_id] = played_at

        if reached_cutoff:
            break

        cursor_value = response.get("cursors", {}).get("before")
        if cursor_value is None:
            break

        try:
            next_before_cursor = int(cursor_value)
        except (TypeError, ValueError):
            break

        if before_cursor is not None and next_before_cursor == before_cursor:
            break

        before_cursor = next_before_cursor

    ordered_track_ids = sorted(
        play_counts,
        key=lambda track_id: (
            -play_counts[track_id],
            -(latest_play_by_track[track_id].timestamp() if track_id in latest_play_by_track else 0),
            (tracks_by_id[track_id].get("name") or "").lower(),
        ),
    )

    tracks = [
        _serialize_track(
            tracks_by_id[track_id],
            rank=index + 1,
            play_count=play_counts[track_id],
            last_played_at=latest_play_by_track.get(track_id),
        )
        for index, track_id in enumerate(ordered_track_ids[:limit])
    ]

    return {
        "tracks": tracks,
        "track_count": len(tracks),
        "total_unique_tracks": len(play_counts),
        "scanned_plays": scanned_plays,
        "window_start": _format_iso_datetime(cutoff),
        "window_end": _format_iso_datetime(now),
        "is_partial": page_budget_hit and not reached_cutoff,
        "source_note": "Ranked by play count inside the selected recent-play window.",
    }


def _fetch_spotify_top_items(sp: spotipy.Spotify, *, spotify_time_range: str, limit: int) -> dict[str, Any]:
    response = sp.current_user_top_tracks(time_range=spotify_time_range, limit=limit)
    items = response.get("items", [])

    tracks = [_serialize_track(track, rank=index + 1) for index, track in enumerate(items)]

    return {
        "tracks": tracks,
        "track_count": len(tracks),
        "total_unique_tracks": len(tracks),
        "scanned_plays": None,
        "window_start": None,
        "window_end": None,
        "is_partial": False,
        "source_note": "Ranked by Spotify's affinity model for the selected top-tracks window.",
    }


def get_top_tracks_summary(
    sp: spotipy.Spotify,
    *,
    timeframe: str = "4_weeks",
    limit: int = 50,
) -> dict[str, Any]:
    resolved = resolve_top_tracks_timeframe(timeframe)

    if limit < 1 or limit > 50:
        raise ValueError("limit must be between 1 and 50.")

    if resolved["mode"] == "recent_window":
        result = _fetch_recent_window_top_tracks(sp, days=resolved["days"], limit=limit)
    else:
        result = _fetch_spotify_top_items(sp, spotify_time_range=resolved["spotify_time_range"], limit=limit)

    return {
        "selected_timeframe": {
            "key": resolved["key"],
            "label": resolved["label"],
            "mode": resolved["mode"],
            "days": resolved.get("days"),
            "spotify_time_range": resolved.get("spotify_time_range"),
            "description": resolved["description"],
            "disclaimer": resolved.get("disclaimer"),
        },
        "tracks": result["tracks"],
        "track_count": result["track_count"],
        "total_unique_tracks": result["total_unique_tracks"],
        "scanned_plays": result["scanned_plays"],
        "window_start": result["window_start"],
        "window_end": result["window_end"],
        "is_partial": result["is_partial"],
        "source_note": result["source_note"],
        "retrieved_at": _format_iso_datetime(_utc_now()),
    }
