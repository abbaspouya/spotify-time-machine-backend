from __future__ import annotations

from typing import Any

import spotipy
from spotipy.exceptions import SpotifyException

from ..core.observability import get_logger


logger = get_logger("playlists")


def create_current_user_playlist(
    sp: spotipy.Spotify,
    name: str,
    public: bool = True,
    collaborative: bool = False,
    description: str = "",
) -> dict[str, Any]:
    # Spotipy 2.23 still posts to deprecated playlist routes for creation.
    payload = {
        "name": name,
        "public": public,
        "collaborative": collaborative,
        "description": description,
    }
    return sp._post("me/playlists", payload=payload)


def add_items_to_playlist(
    sp: spotipy.Spotify,
    playlist_id: str,
    items: list[str],
    position: int | None = None,
) -> dict[str, Any] | None:
    if not items:
        return None

    # Spotipy 2.23 still adds items through the deprecated `/tracks` route.
    spotify_playlist_id = sp._get_id("playlist", playlist_id)
    uris = [sp._get_uri("track", item) for item in items]
    payload: dict[str, Any] = {"uris": uris}
    if position is not None:
        payload["position"] = position

    return sp._post(f"playlists/{spotify_playlist_id}/items", payload=payload)


def get_playlist_items_page(
    sp: spotipy.Spotify,
    playlist_id: str,
    *,
    fields: str | None = None,
    limit: int = 100,
    offset: int = 0,
    market: str | None = None,
    additional_types: tuple[str, ...] = ("track",),
) -> dict[str, Any]:
    # Spotify's February 2026 migration moved playlist item reads to `/items`.
    spotify_playlist_id = sp._get_id("playlist", playlist_id)
    return sp._get(
        f"playlists/{spotify_playlist_id}/items",
        limit=limit,
        offset=offset,
        fields=fields,
        market=market,
        additional_types=",".join(additional_types),
    )


def _first_image_url(images: Any) -> str | None:
    if not isinstance(images, list):
        return None

    for image in images:
        if not isinstance(image, dict):
            continue
        url = image.get("url")
        if isinstance(url, str) and url:
            return url

    return None


def _serialize_playlist_owner(owner: Any) -> dict[str, str | None] | None:
    if not isinstance(owner, dict):
        return None

    return {
        "id": owner.get("id"),
        "display_name": owner.get("display_name"),
    }


def get_playlist_track_object(entry: Any) -> dict[str, Any] | None:
    if not isinstance(entry, dict):
        return None

    for field_name in ("track", "item"):
        candidate = entry.get(field_name)
        if not isinstance(candidate, dict):
            continue

        candidate_type = candidate.get("type")
        if candidate_type and candidate_type != "track":
            return None

        return candidate

    return None


def serialize_playlist_summary(playlist: dict[str, Any]) -> dict[str, Any] | None:
    playlist_id = playlist.get("id")
    if not isinstance(playlist_id, str) or not playlist_id:
        return None

    tracks = playlist.get("tracks")
    track_count = tracks.get("total") if isinstance(tracks, dict) else None

    return {
        "id": playlist_id,
        "name": playlist.get("name") or "Untitled Playlist",
        "description": playlist.get("description") or "",
        "public": playlist.get("public"),
        "collaborative": playlist.get("collaborative"),
        "owner": _serialize_playlist_owner(playlist.get("owner")),
        "image_url": _first_image_url(playlist.get("images")),
        "spotify_url": (playlist.get("external_urls") or {}).get("spotify"),
        "track_count": track_count if isinstance(track_count, int) else None,
    }


def serialize_playlist_track(item: dict[str, Any], position: int) -> dict[str, Any] | None:
    track = get_playlist_track_object(item)
    if track is None:
        return None

    album = track.get("album")
    album_summary = None
    if isinstance(album, dict):
        album_summary = {
            "id": album.get("id"),
            "name": album.get("name"),
            "image_url": _first_image_url(album.get("images")),
            "spotify_url": (album.get("external_urls") or {}).get("spotify"),
        }

    artists = []
    for artist in track.get("artists", []):
        if not isinstance(artist, dict):
            continue
        artists.append(
            {
                "id": artist.get("id"),
                "name": artist.get("name"),
            }
        )

    added_by = item.get("added_by")

    return {
        "position": position,
        "added_at": item.get("added_at"),
        "added_by_id": added_by.get("id") if isinstance(added_by, dict) else None,
        "id": track.get("id"),
        "uri": track.get("uri"),
        "name": track.get("name"),
        "duration_ms": track.get("duration_ms"),
        "explicit": track.get("explicit"),
        "is_local": bool(track.get("is_local", False)),
        "artists": artists,
        "album": album_summary,
        "spotify_url": (track.get("external_urls") or {}).get("spotify"),
    }


def list_current_user_playlists(sp: spotipy.Spotify) -> list[dict[str, Any]]:
    playlists: list[dict[str, Any]] = []
    offset = 0

    while True:
        page = sp.current_user_playlists(limit=50, offset=offset)
        items = page.get("items", [])
        if not items:
            break

        for playlist in items:
            if not isinstance(playlist, dict):
                continue
            serialized = serialize_playlist_summary(playlist)
            if serialized is not None:
                playlists.append(serialized)

        offset += len(items)
        total = page.get("total")
        if isinstance(total, int) and offset >= total:
            break

    return playlists


def get_playlist_tracks(sp: spotipy.Spotify, playlist_id: str) -> dict[str, Any]:
    try:
        playlist = sp.playlist(
            playlist_id,
            fields="id,name,description,public,collaborative,owner(id,display_name),images,external_urls,tracks(total)",
        )
    except SpotifyException as exc:
        logger.warning(
            "spotify_playlist_metadata_fetch_failed",
            extra={
                "playlist_id": playlist_id,
                "spotify_error_code": getattr(exc, "code", None),
                "spotify_error_reason": getattr(exc, "reason", None),
                "spotify_error_message": getattr(exc, "msg", None),
            },
            exc_info=exc,
        )
        raise

    playlist_summary = serialize_playlist_summary(playlist)
    if playlist_summary is None:
        raise ValueError("Spotify playlist response did not include a valid playlist id.")

    tracks: list[dict[str, Any]] = []
    offset = 0

    while True:
        try:
            page = get_playlist_items_page(
                sp,
                playlist_id,
                limit=100,
                offset=offset,
                additional_types=("track",),
            )
        except SpotifyException as exc:
            logger.warning(
                "spotify_playlist_items_fetch_failed",
                extra={
                    "playlist_id": playlist_id,
                    "playlist_name": playlist_summary["name"],
                    "offset": offset,
                    "spotify_error_code": getattr(exc, "code", None),
                    "spotify_error_reason": getattr(exc, "reason", None),
                    "spotify_error_message": getattr(exc, "msg", None),
                },
                exc_info=exc,
            )
            raise

        items = page.get("items", [])
        if not items:
            break

        for item in items:
            if not isinstance(item, dict):
                continue
            serialized = serialize_playlist_track(item, position=len(tracks))
            if serialized is not None:
                tracks.append(serialized)

        offset += len(items)
        total = page.get("total")
        if isinstance(total, int) and offset >= total:
            break

    return {
        "playlist": playlist_summary,
        "tracks": tracks,
        "total_tracks": len(tracks),
    }
