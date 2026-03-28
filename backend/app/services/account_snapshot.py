from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import json
import re

import spotipy


BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent
EXPORT_DIR = BACKEND_DIR / "exports"
ProgressCallback = Callable[[int | None, str], None]


def _parse_iso_datetime(value: str) -> datetime:
    raw = value.strip()
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"

    parsed = datetime.fromisoformat(raw)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)


def _is_before_cutoff(added_at: str | None, cutoff: datetime | None) -> bool:
    if cutoff is None or not added_at:
        return True

    return _parse_iso_datetime(added_at) <= cutoff


def _chunk(items: list[str], size: int) -> list[list[str]]:
    return [items[i:i + size] for i in range(0, len(items), size)]


def _sanitize_filename(file_name: str) -> str:
    sanitized = re.sub(r"[<>:\"/\\|?*\x00-\x1F]+", "_", file_name.strip())
    sanitized = sanitized.replace(" ", "_")
    return sanitized or "spotify_snapshot.json"


def _normalize_uri_entries(entries: list[Any]) -> list[str]:
    uris: list[str] = []
    for entry in entries:
        if isinstance(entry, str) and entry:
            uris.append(entry)
        elif isinstance(entry, dict):
            uri = entry.get("uri")
            if isinstance(uri, str) and uri:
                uris.append(uri)
    return uris


def _order_entries_by_position(entries: list[Any]) -> list[Any]:
    indexed_entries = list(enumerate(entries))

    def _entry_sort_key(item: tuple[int, Any]) -> tuple[int, int]:
        idx, entry = item
        if isinstance(entry, dict):
            position = entry.get("position")
            if isinstance(position, int) and position >= 0:
                return (position, idx)
        return (idx, idx)

    indexed_entries.sort(key=_entry_sort_key)
    return [entry for _, entry in indexed_entries]


def _entries_look_newest_first(entries: list[Any]) -> bool:
    timestamps: list[datetime] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue

        added_at = entry.get("added_at")
        if not isinstance(added_at, str) or not added_at:
            continue

        try:
            timestamps.append(_parse_iso_datetime(added_at))
        except ValueError:
            continue

    if len(timestamps) < 2:
        return False

    return timestamps[0] >= timestamps[-1]


def _uri_to_id(uri_or_id: str) -> str:
    if ":" in uri_or_id:
        return uri_or_id.split(":")[-1]
    return uri_or_id


def _dedupe_preserve_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def _report_progress(callback: ProgressCallback | None, progress: int | None, message: str) -> None:
    if callback is None:
        return

    callback(progress, message)


def _build_empty_import_summary() -> dict[str, int]:
    return {
        "playlists_created": 0,
        "playlist_tracks_added": 0,
        "playlist_tracks_failed": 0,
        "playlists_removed": 0,
        "liked_tracks_added": 0,
        "liked_tracks_failed": 0,
        "liked_tracks_removed": 0,
        "saved_albums_added": 0,
        "saved_albums_failed": 0,
        "saved_albums_removed": 0,
        "followed_artists_added": 0,
        "followed_artists_failed": 0,
        "followed_artists_removed": 0,
    }


def summarize_snapshot(snapshot: dict[str, Any]) -> dict[str, int]:
    playlists = snapshot.get("playlists", [])
    liked_tracks = snapshot.get("liked_tracks", [])
    saved_albums = snapshot.get("saved_albums", [])
    followed_artists = snapshot.get("followed_artists", [])

    playlist_count = len(playlists) if isinstance(playlists, list) else 0
    liked_count = len(liked_tracks) if isinstance(liked_tracks, list) else 0
    album_count = len(saved_albums) if isinstance(saved_albums, list) else 0
    artist_count = len(followed_artists) if isinstance(followed_artists, list) else 0

    playlist_track_count = 0
    if isinstance(playlists, list):
        for playlist in playlists:
            if not isinstance(playlist, dict):
                continue
            tracks = playlist.get("tracks", [])
            if isinstance(tracks, list):
                playlist_track_count += len(tracks)

    return {
        "playlists": playlist_count,
        "playlist_tracks": playlist_track_count,
        "liked_tracks": liked_count,
        "saved_albums": album_count,
        "followed_artists": artist_count,
    }


def _collect_saved_track_ids(sp: spotipy.Spotify) -> list[str]:
    track_ids: list[str] = []
    offset = 0
    while True:
        page = sp.current_user_saved_tracks(limit=50, offset=offset)
        items = page.get("items", [])
        if not items:
            break

        for item in items:
            track = item.get("track")
            if not isinstance(track, dict):
                continue

            track_id = track.get("id")
            if isinstance(track_id, str) and track_id:
                track_ids.append(track_id)

        offset += len(items)
        if len(items) < 50:
            break

    return _dedupe_preserve_order(track_ids)


def _collect_saved_album_ids(sp: spotipy.Spotify) -> list[str]:
    album_ids: list[str] = []
    offset = 0
    while True:
        page = sp.current_user_saved_albums(limit=50, offset=offset)
        items = page.get("items", [])
        if not items:
            break

        for item in items:
            album = item.get("album")
            if not isinstance(album, dict):
                continue

            album_id = album.get("id")
            if isinstance(album_id, str) and album_id:
                album_ids.append(album_id)

        offset += len(items)
        if len(items) < 50:
            break

    return _dedupe_preserve_order(album_ids)


def _collect_followed_artist_ids(sp: spotipy.Spotify) -> list[str]:
    artist_ids: list[str] = []
    after: str | None = None

    while True:
        page = sp.current_user_followed_artists(limit=50, after=after)
        artist_block = page.get("artists", {})
        artists = artist_block.get("items", [])
        if not artists:
            break

        for artist in artists:
            artist_id = artist.get("id")
            if isinstance(artist_id, str) and artist_id:
                artist_ids.append(artist_id)

        after = artist_block.get("cursors", {}).get("after")
        if not after:
            break

    return _dedupe_preserve_order(artist_ids)


def _collect_owned_playlist_ids(sp: spotipy.Spotify, user_id: str) -> list[str]:
    playlist_ids: list[str] = []
    offset = 0
    while True:
        page = sp.current_user_playlists(limit=50, offset=offset)
        items = page.get("items", [])
        if not items:
            break

        for playlist in items:
            owner = playlist.get("owner")
            owner_id = owner.get("id") if isinstance(owner, dict) else None
            playlist_id = playlist.get("id")
            if owner_id == user_id and isinstance(playlist_id, str) and playlist_id:
                playlist_ids.append(playlist_id)

        offset += len(items)
        if len(items) < 50:
            break

    return _dedupe_preserve_order(playlist_ids)


def export_account_snapshot(
    sp: spotipy.Spotify,
    cutoff_date: str | None = None,
    include_playlists: bool = True,
    include_liked_tracks: bool = True,
    include_saved_albums: bool = True,
    include_followed_artists: bool = True,
    progress_callback: ProgressCallback | None = None,
) -> dict[str, Any]:
    _report_progress(progress_callback, 5, "Preparing snapshot export")
    cutoff_dt = _parse_iso_datetime(cutoff_date) if cutoff_date else None
    now_utc = datetime.now(timezone.utc)
    me = sp.current_user()

    snapshot: dict[str, Any] = {
        "exported_at": now_utc.isoformat().replace("+00:00", "Z"),
        "cutoff_date": cutoff_dt.isoformat().replace("+00:00", "Z") if cutoff_dt else None,
        "source_user_id": me.get("id"),
        "notes": {
            "followed_artists_cutoff_supported": False,
            "followed_artists_reason": "Spotify API does not return follow date, so cutoff cannot be applied.",
        },
        "playlists": [],
        "liked_tracks": [],
        "saved_albums": [],
        "followed_artists": [],
        "counts": {
            "playlists": 0,
            "playlist_tracks": 0,
            "liked_tracks": 0,
            "saved_albums": 0,
            "followed_artists": 0,
        },
    }

    if include_playlists:
        _report_progress(progress_callback, 15, "Exporting playlists")
        offset = 0
        while True:
            page = sp.current_user_playlists(limit=50, offset=offset)
            items = page.get("items", [])
            if not items:
                break

            for playlist in items:
                playlist_id = playlist.get("id")
                if not playlist_id:
                    continue

                exported_playlist = {
                    "id": playlist_id,
                    "name": playlist.get("name") or "Imported Playlist",
                    "description": playlist.get("description") or "",
                    "public": bool(playlist.get("public", False)),
                    "collaborative": bool(playlist.get("collaborative", False)),
                    "position": len(snapshot["playlists"]),
                    "tracks": [],
                }

                playlist_offset = 0
                while True:
                    tracks_page = sp.playlist_items(playlist_id, limit=100, offset=playlist_offset)
                    track_items = tracks_page.get("items", [])
                    if not track_items:
                        break

                    for track_item in track_items:
                        added_at = track_item.get("added_at")
                        if not _is_before_cutoff(added_at, cutoff_dt):
                            continue

                        track = track_item.get("track")
                        if not isinstance(track, dict) or track.get("is_local"):
                            continue

                        uri = track.get("uri")
                        if not isinstance(uri, str) or not uri:
                            continue

                        exported_playlist["tracks"].append(
                            {
                                "uri": uri,
                                "added_at": added_at,
                                "position": len(exported_playlist["tracks"]),
                            }
                        )

                    playlist_offset += len(track_items)
                    if len(track_items) < 100:
                        break

                snapshot["playlists"].append(exported_playlist)

            offset += len(items)
            if len(items) < 50:
                break

        snapshot["counts"]["playlists"] = len(snapshot["playlists"])
        snapshot["counts"]["playlist_tracks"] = sum(len(p["tracks"]) for p in snapshot["playlists"])

    if include_liked_tracks:
        _report_progress(progress_callback, 45, "Exporting liked songs")
        offset = 0
        while True:
            page = sp.current_user_saved_tracks(limit=50, offset=offset)
            items = page.get("items", [])
            if not items:
                break

            for item in items:
                added_at = item.get("added_at")
                if not _is_before_cutoff(added_at, cutoff_dt):
                    continue

                track = item.get("track")
                if not isinstance(track, dict):
                    continue

                uri = track.get("uri")
                if not isinstance(uri, str) or not uri:
                    continue

                snapshot["liked_tracks"].append(
                    {
                        "uri": uri,
                        "added_at": added_at,
                        "position": len(snapshot["liked_tracks"]),
                    }
                )

            offset += len(items)
            if len(items) < 50:
                break

        snapshot["counts"]["liked_tracks"] = len(snapshot["liked_tracks"])

    if include_saved_albums:
        _report_progress(progress_callback, 70, "Exporting saved albums")
        offset = 0
        while True:
            page = sp.current_user_saved_albums(limit=50, offset=offset)
            items = page.get("items", [])
            if not items:
                break

            for item in items:
                added_at = item.get("added_at")
                if not _is_before_cutoff(added_at, cutoff_dt):
                    continue

                album = item.get("album")
                if not isinstance(album, dict):
                    continue

                uri = album.get("uri")
                if not isinstance(uri, str) or not uri:
                    continue

                snapshot["saved_albums"].append(
                    {
                        "uri": uri,
                        "added_at": added_at,
                        "position": len(snapshot["saved_albums"]),
                    }
                )

            offset += len(items)
            if len(items) < 50:
                break

        snapshot["counts"]["saved_albums"] = len(snapshot["saved_albums"])

    if include_followed_artists:
        _report_progress(progress_callback, 85, "Exporting followed artists")
        after: str | None = None
        while True:
            page = sp.current_user_followed_artists(limit=50, after=after)
            artist_block = page.get("artists", {})
            artists = artist_block.get("items", [])
            if not artists:
                break

            for artist in artists:
                artist_id = artist.get("id")
                artist_uri = artist.get("uri")
                if isinstance(artist_id, str) and artist_id:
                    snapshot["followed_artists"].append(
                        {
                            "id": artist_id,
                            "uri": artist_uri,
                            "name": artist.get("name"),
                        }
                    )

            after = artist_block.get("cursors", {}).get("after")
            if not after:
                break

        snapshot["counts"]["followed_artists"] = len(snapshot["followed_artists"])

    _report_progress(progress_callback, 100, "Snapshot export ready")
    return snapshot


def write_snapshot_to_file(snapshot: dict[str, Any], output_file_name: str | None = None) -> str:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)

    if output_file_name:
        file_name = _sanitize_filename(output_file_name)
        if not file_name.lower().endswith(".json"):
            file_name += ".json"
    else:
        user_id = str(snapshot.get("source_user_id") or "unknown-user")
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        file_name = f"spotify-snapshot-{user_id}-{ts}.json"

    output_path = EXPORT_DIR / file_name
    output_path.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
    return output_path.relative_to(PROJECT_ROOT).as_posix()


def load_snapshot_from_file(file_path: str) -> dict[str, Any]:
    path = Path(file_path)

    if not path.is_absolute():
        candidates = [
            Path.cwd() / path,
            PROJECT_ROOT / path,
            BACKEND_DIR / path,
            EXPORT_DIR / path,
        ]

        for candidate in candidates:
            if candidate.exists():
                path = candidate
                break

    if not path.exists():
        raise FileNotFoundError(f"Snapshot file not found: {path}")

    raw = path.read_text(encoding="utf-8")
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("Snapshot JSON must be an object.")

    return data


def import_account_snapshot(
    sp: spotipy.Spotify,
    snapshot: dict[str, Any],
    import_playlists: bool = True,
    import_liked_tracks: bool = True,
    import_saved_albums: bool = True,
    import_followed_artists: bool = True,
    clear_existing_before_import: bool = False,
    strict_liked_order: bool = False,
    progress_callback: ProgressCallback | None = None,
) -> dict[str, Any]:
    _report_progress(progress_callback, 5, "Preparing snapshot import")
    me = sp.current_user()
    user_id = me.get("id")

    result: dict[str, Any] = {
        "imported_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "target_user_id": user_id,
        "source_user_id": snapshot.get("source_user_id"),
        "summary": _build_empty_import_summary(),
        "created_playlists": [],
        "warnings": [],
    }

    if clear_existing_before_import:
        _report_progress(progress_callback, 15, "Clearing selected content before import")
        if import_playlists:
            if isinstance(user_id, str) and user_id:
                owned_playlist_ids = _collect_owned_playlist_ids(sp, user_id)
                for playlist_id in owned_playlist_ids:
                    try:
                        sp.current_user_unfollow_playlist(playlist_id)
                        result["summary"]["playlists_removed"] += 1
                    except Exception:
                        result["warnings"].append(
                            f"Failed to remove existing playlist before import: {playlist_id}"
                        )
            else:
                result["warnings"].append(
                    "Could not remove existing playlists because current user id is unavailable."
                )

        if import_liked_tracks:
            existing_track_ids = _collect_saved_track_ids(sp)
            for track_chunk in _chunk(existing_track_ids, 50):
                try:
                    sp.current_user_saved_tracks_delete(track_chunk)
                    result["summary"]["liked_tracks_removed"] += len(track_chunk)
                except Exception:
                    for track_id in track_chunk:
                        try:
                            sp.current_user_saved_tracks_delete([track_id])
                            result["summary"]["liked_tracks_removed"] += 1
                        except Exception:
                            result["warnings"].append(
                                f"Failed to remove liked track before import: {track_id}"
                            )

        if import_saved_albums:
            existing_album_ids = _collect_saved_album_ids(sp)
            for album_chunk in _chunk(existing_album_ids, 20):
                try:
                    sp.current_user_saved_albums_delete(album_chunk)
                    result["summary"]["saved_albums_removed"] += len(album_chunk)
                except Exception:
                    for album_id in album_chunk:
                        try:
                            sp.current_user_saved_albums_delete([album_id])
                            result["summary"]["saved_albums_removed"] += 1
                        except Exception:
                            result["warnings"].append(
                                f"Failed to remove saved album before import: {album_id}"
                            )

        if import_followed_artists:
            existing_artist_ids = _collect_followed_artist_ids(sp)
            for artist_chunk in _chunk(existing_artist_ids, 50):
                try:
                    sp.user_unfollow_artists(artist_chunk)
                    result["summary"]["followed_artists_removed"] += len(artist_chunk)
                except Exception:
                    for artist_id in artist_chunk:
                        try:
                            sp.user_unfollow_artists([artist_id])
                            result["summary"]["followed_artists_removed"] += 1
                        except Exception:
                            result["warnings"].append(
                                f"Failed to unfollow artist before import: {artist_id}"
                            )

    if import_playlists:
        _report_progress(progress_callback, 35, "Recreating playlists from the snapshot")
        playlists = snapshot.get("playlists", [])
        if isinstance(playlists, list):
            playlists = _order_entries_by_position(playlists)
            if len(playlists) > 1:
                result["warnings"].append(
                    "Spotify API cannot set custom sidebar playlist order; playlist order in your account may differ."
                )
            for playlist in playlists:
                if not isinstance(playlist, dict):
                    continue

                name = playlist.get("name") or "Imported Playlist"
                description = playlist.get("description") or ""
                public = bool(playlist.get("public", False))

                try:
                    created = sp.user_playlist_create(
                        user=user_id,
                        name=name,
                        public=public,
                        description=description,
                    )
                except Exception:
                    # Retry as private if public creation is not permitted.
                    created = sp.user_playlist_create(
                        user=user_id,
                        name=name,
                        public=False,
                        description=description,
                    )
                    result["warnings"].append(
                        f"Playlist '{name}' created as private because public creation failed."
                    )

                playlist_id = created.get("id")
                created_name = created.get("name", name)
                result["summary"]["playlists_created"] += 1
                result["created_playlists"].append(
                    {
                        "id": playlist_id,
                        "name": created_name,
                        "external_url": created.get("external_urls", {}).get("spotify"),
                    }
                )

                track_entries = playlist.get("tracks", [])
                if not isinstance(track_entries, list):
                    continue

                ordered_track_entries = _order_entries_by_position(track_entries)
                uris = _normalize_uri_entries(ordered_track_entries)
                for uri_chunk in _chunk(uris, 100):
                    try:
                        sp.playlist_add_items(playlist_id, uri_chunk)
                        result["summary"]["playlist_tracks_added"] += len(uri_chunk)
                    except Exception:
                        # Fall back to single inserts to salvage valid tracks.
                        for uri in uri_chunk:
                            try:
                                sp.playlist_add_items(playlist_id, [uri])
                                result["summary"]["playlist_tracks_added"] += 1
                            except Exception:
                                result["summary"]["playlist_tracks_failed"] += 1

    if import_liked_tracks:
        _report_progress(progress_callback, 65, "Restoring liked songs")
        liked_entries = snapshot.get("liked_tracks", [])
        if isinstance(liked_entries, list):
            ordered_liked_entries = _order_entries_by_position(liked_entries)
            liked_uris = _normalize_uri_entries(ordered_liked_entries)
            liked_ids = _dedupe_preserve_order([_uri_to_id(uri) for uri in liked_uris if uri])
            if _entries_look_newest_first(ordered_liked_entries):
                # Spotify "Liked Songs" is shown newest-first, so we add oldest-first
                # to preserve the original visible order after import.
                liked_ids = list(reversed(liked_ids))

            if strict_liked_order:
                result["warnings"].append(
                    "strict_liked_order is enabled: importing liked songs one-by-one for better ordering; this is slower."
                )
                for track_id in liked_ids:
                    try:
                        sp.current_user_saved_tracks_add([track_id])
                        result["summary"]["liked_tracks_added"] += 1
                    except Exception:
                        result["summary"]["liked_tracks_failed"] += 1
            else:
                for chunk_ids in _chunk(liked_ids, 50):
                    try:
                        sp.current_user_saved_tracks_add(chunk_ids)
                        result["summary"]["liked_tracks_added"] += len(chunk_ids)
                    except Exception:
                        for track_id in chunk_ids:
                            try:
                                sp.current_user_saved_tracks_add([track_id])
                                result["summary"]["liked_tracks_added"] += 1
                            except Exception:
                                result["summary"]["liked_tracks_failed"] += 1

    if import_saved_albums:
        _report_progress(progress_callback, 82, "Restoring saved albums")
        album_entries = snapshot.get("saved_albums", [])
        if isinstance(album_entries, list):
            ordered_album_entries = _order_entries_by_position(album_entries)
            album_uris = _normalize_uri_entries(ordered_album_entries)
            album_ids = _dedupe_preserve_order([_uri_to_id(uri) for uri in album_uris if uri])
            if _entries_look_newest_first(ordered_album_entries):
                # Saved albums are typically displayed newest-first as well.
                album_ids = list(reversed(album_ids))

            for chunk_ids in _chunk(album_ids, 20):
                try:
                    sp.current_user_saved_albums_add(chunk_ids)
                    result["summary"]["saved_albums_added"] += len(chunk_ids)
                except Exception:
                    for album_id in chunk_ids:
                        try:
                            sp.current_user_saved_albums_add([album_id])
                            result["summary"]["saved_albums_added"] += 1
                        except Exception:
                            result["summary"]["saved_albums_failed"] += 1

    if import_followed_artists:
        _report_progress(progress_callback, 92, "Restoring followed artists")
        artist_entries = snapshot.get("followed_artists", [])
        if isinstance(artist_entries, list):
            artist_ids: list[str] = []
            for entry in artist_entries:
                if isinstance(entry, dict):
                    artist_id = entry.get("id")
                    artist_uri = entry.get("uri")
                    if isinstance(artist_id, str) and artist_id:
                        artist_ids.append(artist_id)
                    elif isinstance(artist_uri, str) and artist_uri:
                        artist_ids.append(_uri_to_id(artist_uri))
                elif isinstance(entry, str) and entry:
                    artist_ids.append(_uri_to_id(entry))

            artist_ids = _dedupe_preserve_order(artist_ids)

            for chunk_ids in _chunk(artist_ids, 50):
                try:
                    sp.user_follow_artists(chunk_ids)
                    result["summary"]["followed_artists_added"] += len(chunk_ids)
                except Exception:
                    for artist_id in chunk_ids:
                        try:
                            sp.user_follow_artists([artist_id])
                            result["summary"]["followed_artists_added"] += 1
                        except Exception:
                            result["summary"]["followed_artists_failed"] += 1

    _report_progress(progress_callback, 100, "Snapshot import completed")
    return result


def preview_account_snapshot_import(
    sp: spotipy.Spotify,
    snapshot: dict[str, Any],
    import_playlists: bool = True,
    import_liked_tracks: bool = True,
    import_saved_albums: bool = True,
    import_followed_artists: bool = True,
    clear_existing_before_import: bool = False,
    strict_liked_order: bool = False,
) -> dict[str, Any]:
    me = sp.current_user()
    user_id = me.get("id")

    warnings: list[str] = []
    destructive_operations: list[str] = []
    summary = _build_empty_import_summary()
    snapshot_counts = summarize_snapshot(snapshot)

    if snapshot.get("source_user_id") == user_id and user_id:
        warnings.append(
            "The snapshot was exported from the same Spotify account that is currently connected."
        )

    if not any([import_playlists, import_liked_tracks, import_saved_albums, import_followed_artists]):
        warnings.append("No import options are selected, so nothing will be applied.")

    if import_playlists:
        playlists = snapshot.get("playlists", [])
        if isinstance(playlists, list):
            valid_playlists = [playlist for playlist in playlists if isinstance(playlist, dict)]
            summary["playlists_created"] = len(valid_playlists)
            summary["playlist_tracks_added"] = sum(
                len(_normalize_uri_entries(_order_entries_by_position(playlist.get("tracks", []))))
                for playlist in valid_playlists
                if isinstance(playlist.get("tracks", []), list)
            )
            if len(valid_playlists) > 1:
                warnings.append(
                    "Spotify cannot preserve custom sidebar playlist ordering, so imported playlist order may differ."
                )

    if import_liked_tracks:
        liked_entries = snapshot.get("liked_tracks", [])
        if isinstance(liked_entries, list):
            ordered_liked_entries = _order_entries_by_position(liked_entries)
            liked_uris = _normalize_uri_entries(ordered_liked_entries)
            liked_ids = _dedupe_preserve_order([_uri_to_id(uri) for uri in liked_uris if uri])
            summary["liked_tracks_added"] = len(liked_ids)
            if strict_liked_order and liked_ids:
                warnings.append(
                    "Strict liked order will import liked songs one by one, which is slower but better for visible ordering."
                )

    if import_saved_albums:
        album_entries = snapshot.get("saved_albums", [])
        if isinstance(album_entries, list):
            ordered_album_entries = _order_entries_by_position(album_entries)
            album_uris = _normalize_uri_entries(ordered_album_entries)
            album_ids = _dedupe_preserve_order([_uri_to_id(uri) for uri in album_uris if uri])
            summary["saved_albums_added"] = len(album_ids)

    if import_followed_artists:
        artist_entries = snapshot.get("followed_artists", [])
        if isinstance(artist_entries, list):
            artist_ids: list[str] = []
            for entry in artist_entries:
                if isinstance(entry, dict):
                    artist_id = entry.get("id")
                    artist_uri = entry.get("uri")
                    if isinstance(artist_id, str) and artist_id:
                        artist_ids.append(artist_id)
                    elif isinstance(artist_uri, str) and artist_uri:
                        artist_ids.append(_uri_to_id(artist_uri))
                elif isinstance(entry, str) and entry:
                    artist_ids.append(_uri_to_id(entry))

            summary["followed_artists_added"] = len(_dedupe_preserve_order(artist_ids))

    if clear_existing_before_import:
        warnings.append("Selected areas of the target account will be cleared before the snapshot is applied.")

        if import_playlists:
            if isinstance(user_id, str) and user_id:
                summary["playlists_removed"] = len(_collect_owned_playlist_ids(sp, user_id))
            destructive_operations.append(
                f"Remove {summary['playlists_removed']} existing playlists from the connected account."
            )

        if import_liked_tracks:
            summary["liked_tracks_removed"] = len(_collect_saved_track_ids(sp))
            destructive_operations.append(
                f"Remove {summary['liked_tracks_removed']} currently liked songs before restoring the snapshot."
            )

        if import_saved_albums:
            summary["saved_albums_removed"] = len(_collect_saved_album_ids(sp))
            destructive_operations.append(
                f"Remove {summary['saved_albums_removed']} currently saved albums before restoring the snapshot."
            )

        if import_followed_artists:
            summary["followed_artists_removed"] = len(_collect_followed_artist_ids(sp))
            destructive_operations.append(
                f"Unfollow {summary['followed_artists_removed']} currently followed artists before restoring the snapshot."
            )

    return {
        "previewed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source_user_id": snapshot.get("source_user_id"),
        "target_user_id": user_id,
        "snapshot_counts": snapshot_counts,
        "summary": summary,
        "requested_actions": {
            "import_playlists": import_playlists,
            "import_liked_tracks": import_liked_tracks,
            "import_saved_albums": import_saved_albums,
            "import_followed_artists": import_followed_artists,
            "clear_existing_before_import": clear_existing_before_import,
            "strict_liked_order": strict_liked_order,
        },
        "destructive_operations": destructive_operations,
        "warnings": warnings,
        "requires_confirmation": clear_existing_before_import,
    }
