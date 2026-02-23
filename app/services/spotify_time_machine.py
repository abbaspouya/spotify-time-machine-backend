from datetime import datetime
from collections import defaultdict
from typing import Optional, List, Dict
import spotipy
from langdetect import detect, LangDetectException


def fetch_all_liked_songs(sp: spotipy.Spotify, limit: int = 50):
    """Fetch all liked songs (saved tracks) for the current user."""
    all_items = []
    offset = 0

    while True:
        results = sp.current_user_saved_tracks(limit=limit, offset=offset)
        items = results.get("items", [])
        if not items:
            break

        all_items.extend(items)
        offset += len(items)

        if len(items) < limit:
            break

    return all_items


def group_songs_by_period(
    songs,
    period_type: str = "monthly",  # "monthly", "quarterly", "semi", "yearly"
    start_year: Optional[int] = None,
    end_year: Optional[int] = None,
    order: str = "asc",            # "asc" (oldest→newest) or "desc"
) -> Dict[str, List[str]]:
    groups = defaultdict(list)

    for item in songs:
        added_at_raw = item["added_at"]  # e.g. "2025-01-05T10:32:45Z"
        added_at = datetime.fromisoformat(added_at_raw.replace("Z", "+00:00"))
        year = added_at.year
        month = added_at.month

        if start_year is not None and year < start_year:
            continue
        if end_year is not None and year > end_year:
            continue

        if period_type == "monthly":
            key = f"{year}({month:02d})"
        elif period_type == "quarterly":
            quarter = ((month - 1) // 3) + 1
            start_m = (quarter - 1) * 3 + 1
            end_m = quarter * 3
            key = f"{year}({start_m}-{end_m})"
        elif period_type == "semi":
            half = ((month - 1) // 6) + 1
            start_m = 1 if half == 1 else 7
            end_m = 6 if half == 1 else 12
            key = f"{year}({start_m}-{end_m})"
        else:  # yearly
            key = f"{year}"

        groups[key].append((added_at, item["track"]["id"]))

    reverse = (order == "desc")
    sorted_groups = {
        key: [track_id for (ts, track_id) in sorted(value, key=lambda x: x[0], reverse=reverse)]
        for key, value in groups.items()
    }

    return sorted_groups


def add_tracks_in_chunks(sp: spotipy.Spotify, playlist_id: str, track_ids: list[str], chunk_size: int = 100):
    for i in range(0, len(track_ids), chunk_size):
        chunk = track_ids[i:i + chunk_size]
        if chunk:
            sp.playlist_add_items(playlist_id, chunk)




def group_songs_by_language(songs) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = defaultdict(list)

    for item in songs:
        track = item["track"]
        text = track["name"] + " - " + ", ".join(a["name"] for a in track["artists"])

        try:
            lang = detect(text)
        except LangDetectException:
            continue  # skip if cannot detect

        groups[lang].append(track["id"])

    return dict(groups)


def search_artists(sp: spotipy.Spotify, query: str, limit: int = 20):
    """
    Search artists on Spotify by name.
    Returns a simplified list of artist objects.
    """
    if not query:
        return []

    # Spotify search API
    result = sp.search(q=query, type="artist", limit=limit)
    items = result.get("artists", {}).get("items", [])

    artists = []
    for a in items:
        artists.append({
            "id": a["id"],
            "name": a["name"],
            "popularity": a.get("popularity"),
            "genres": a.get("genres", []),
            "image_url": a["images"][0]["url"] if a.get("images") else None,
            "spotify_url": a["external_urls"]["spotify"],
        })

    return artists