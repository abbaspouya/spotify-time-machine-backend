from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
import json
import re
import time

import spotipy
from spotipy.exceptions import SpotifyException

from ..core.observability import get_logger
from .spotify_playlists import (
    add_items_to_playlist,
    create_current_user_playlist,
    get_playlist_items_page,
    get_playlist_track_object,
)


BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent
EXPORT_DIR = BACKEND_DIR / "exports"
ProgressCallback = Callable[[int | None, str], None]
logger = get_logger("snapshots")
LIBRARY_ITEMS_BATCH_SIZE = 40
STRICT_LIKED_ORDER_REQUEST_DELAY_SECONDS = 0.75
STRICT_LIKED_ORDER_COOLDOWN_EVERY = 25
STRICT_LIKED_ORDER_COOLDOWN_SECONDS = 20.0
STRICT_LIKED_ORDER_MAX_CONSECUTIVE_RATE_LIMITS = 2
STRICT_LIKED_ORDER_MAX_ATTEMPTS = 6
STRICT_LIKED_ORDER_BASE_BACKOFF_SECONDS = 2.0
STRICT_LIKED_ORDER_RETRY_BUFFER_SECONDS = 1.0


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


def _id_to_uri(entity_type: str, uri_or_id: str) -> str:
    if ":" in uri_or_id:
        return uri_or_id
    return f"spotify:{entity_type}:{uri_or_id}"


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


def _resolve_strict_liked_order_controls(
    delay_seconds: float | None = None,
    cooldown_every: int | None = None,
    cooldown_seconds: float | None = None,
    max_consecutive_rate_limits: int | None = None,
    resume_from_index: int = 0,
) -> dict[str, Any]:
    resolved_delay_seconds = STRICT_LIKED_ORDER_REQUEST_DELAY_SECONDS if delay_seconds is None else max(0.0, float(delay_seconds))

    if cooldown_every is None:
        resolved_cooldown_every: int | None = STRICT_LIKED_ORDER_COOLDOWN_EVERY
    else:
        resolved_cooldown_every = int(cooldown_every)
        if resolved_cooldown_every <= 0:
            resolved_cooldown_every = None

    if cooldown_seconds is None:
        resolved_cooldown_seconds = STRICT_LIKED_ORDER_COOLDOWN_SECONDS
    else:
        resolved_cooldown_seconds = max(0.0, float(cooldown_seconds))

    if resolved_cooldown_every is None or resolved_cooldown_seconds <= 0:
        resolved_cooldown_every = None
        resolved_cooldown_seconds = 0.0

    if max_consecutive_rate_limits is None:
        resolved_max_consecutive_rate_limits: int | None = STRICT_LIKED_ORDER_MAX_CONSECUTIVE_RATE_LIMITS
    else:
        resolved_max_consecutive_rate_limits = int(max_consecutive_rate_limits)
        if resolved_max_consecutive_rate_limits <= 0:
            resolved_max_consecutive_rate_limits = None

    return {
        "delay_seconds": resolved_delay_seconds,
        "cooldown_every": resolved_cooldown_every,
        "cooldown_seconds": resolved_cooldown_seconds,
        "max_consecutive_rate_limits": resolved_max_consecutive_rate_limits,
        "resume_from_index": max(0, int(resume_from_index)),
    }


def _build_strict_liked_order_warning(controls: dict[str, Any]) -> str:
    details = [f"a {controls['delay_seconds']:.2f}s delay between songs"]

    cooldown_every = controls.get("cooldown_every")
    cooldown_seconds = controls.get("cooldown_seconds", 0.0)
    if isinstance(cooldown_every, int) and cooldown_every > 0 and cooldown_seconds > 0:
        details.append(f"a {cooldown_seconds:.0f}s cooldown every {cooldown_every} songs")

    max_consecutive_rate_limits = controls.get("max_consecutive_rate_limits")
    if isinstance(max_consecutive_rate_limits, int) and max_consecutive_rate_limits > 0:
        details.append(f"an automatic stop after {max_consecutive_rate_limits} consecutive rate-limited songs so you can resume later")

    return "Strict liked order will import liked songs one by one with " + ", ".join(details) + "."


def _parse_retry_after_seconds(value: Any) -> float | None:
    if value is None:
        return None

    if isinstance(value, (int, float)):
        return max(0.0, float(value))

    if not isinstance(value, str):
        return None

    raw = value.strip()
    if not raw:
        return None

    try:
        return max(0.0, float(raw))
    except ValueError:
        pass

    try:
        retry_at = parsedate_to_datetime(raw)
    except (TypeError, ValueError, IndexError, OverflowError):
        return None

    if retry_at.tzinfo is None:
        retry_at = retry_at.replace(tzinfo=timezone.utc)

    return max(0.0, (retry_at.astimezone(timezone.utc) - datetime.now(timezone.utc)).total_seconds())


def _strict_liked_order_retry_delay(exc: SpotifyException, attempt: int) -> float:
    headers = getattr(exc, "headers", None)
    retry_after: float | None = None
    if isinstance(headers, dict):
        retry_after = _parse_retry_after_seconds(headers.get("Retry-After") or headers.get("retry-after"))

    if retry_after is not None:
        return retry_after + STRICT_LIKED_ORDER_RETRY_BUFFER_SECONDS

    return STRICT_LIKED_ORDER_BASE_BACKOFF_SECONDS * (2 ** max(0, attempt - 1))


def _save_items_to_library_with_retries(sp: spotipy.Spotify, uris: list[str]) -> None:
    if not uris:
        return

    attempt = 1
    while True:
        try:
            _save_items_to_library(sp, uris)
            return
        except SpotifyException as exc:
            status_code = getattr(exc, "http_status", None)
            if status_code not in {429, 500, 502, 503, 504} or attempt >= STRICT_LIKED_ORDER_MAX_ATTEMPTS:
                raise

            delay_seconds = _strict_liked_order_retry_delay(exc, attempt)
            logger.warning(
                f"strict_liked_order_retry_scheduled attempt={attempt} delay_seconds={delay_seconds:.2f}",
                extra={
                    "spotify_error_code": getattr(exc, "code", None),
                    "spotify_error_reason": getattr(exc, "reason", None),
                    "spotify_error_message": getattr(exc, "msg", str(exc)),
                },
            )
            time.sleep(delay_seconds)
            attempt += 1


def _save_items_to_library(sp: spotipy.Spotify, uris: list[str]) -> None:
    if not uris:
        return
    sp._put("me/library", args={"uris": ",".join(uris)})


def _remove_items_from_library(sp: spotipy.Spotify, uris: list[str]) -> None:
    if not uris:
        return
    sp._delete("me/library", args={"uris": ",".join(uris)})


def _build_account_identity(user: Any) -> dict[str, Any] | None:
    if not isinstance(user, dict):
        return None

    images = user.get("images")
    image_url = user.get("image_url") if isinstance(user.get("image_url"), str) else None
    if isinstance(images, list):
        for image in images:
            if not isinstance(image, dict):
                continue
            candidate = image.get("url")
            if isinstance(candidate, str) and candidate:
                image_url = candidate
                break

    external_urls = user.get("external_urls")
    profile_url = user.get("profile_url") if isinstance(user.get("profile_url"), str) else None
    if isinstance(external_urls, dict):
        spotify_url = external_urls.get("spotify")
        if isinstance(spotify_url, str) and spotify_url:
            profile_url = spotify_url

    return {
        "id": user.get("id") if isinstance(user.get("id"), str) else None,
        "display_name": user.get("display_name") if isinstance(user.get("display_name"), str) else None,
        "image_url": image_url,
        "profile_url": profile_url if isinstance(profile_url, str) else None,
        "country": user.get("country") if isinstance(user.get("country"), str) else None,
        "product": user.get("product") if isinstance(user.get("product"), str) else None,
    }


def _extract_snapshot_source_account(snapshot: dict[str, Any]) -> dict[str, Any] | None:
    source_account = snapshot.get("source_account")
    if isinstance(source_account, dict):
        identity = _build_account_identity(source_account)
        if identity is not None:
            fallback_id = snapshot.get("source_user_id")
            if not identity.get("id") and isinstance(fallback_id, str):
                identity["id"] = fallback_id
            return identity

    source_user_id = snapshot.get("source_user_id")
    if isinstance(source_user_id, str) and source_user_id:
        return {
            "id": source_user_id,
            "display_name": None,
            "image_url": None,
            "profile_url": None,
            "country": None,
            "product": None,
        }

    return None


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
    source_account = _build_account_identity(me)
    source_user_id = source_account.get("id") if isinstance(source_account, dict) else None

    snapshot: dict[str, Any] = {
        "exported_at": now_utc.isoformat().replace("+00:00", "Z"),
        "cutoff_date": cutoff_dt.isoformat().replace("+00:00", "Z") if cutoff_dt else None,
        "source_user_id": source_user_id,
        "source_account": source_account,
        "warnings": [],
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
                logger.info(
                    "snapshot_playlist_export_started",
                    extra={
                        "playlist_id": playlist_id,
                        "playlist_name": exported_playlist["name"],
                    },
                )

                playlist_offset = 0
                skip_playlist = False
                fetched_item_count = 0
                skipped_cutoff_count = 0
                skipped_local_count = 0
                skipped_missing_uri_count = 0
                skipped_missing_track_count = 0
                while True:
                    try:
                        # Snapshot imports only support tracks, so request tracks explicitly.
                        tracks_page = get_playlist_items_page(
                            sp,
                            playlist_id,
                            limit=100,
                            offset=playlist_offset,
                            additional_types=("track",),
                        )
                    except SpotifyException as exc:
                        if getattr(exc, "http_status", None) == 403:
                            playlist_name = exported_playlist["name"] or playlist_id
                            logger.warning(
                                "snapshot_playlist_export_skipped_forbidden",
                                extra={
                                    "playlist_id": playlist_id,
                                    "playlist_name": playlist_name,
                                    "offset": playlist_offset,
                                    "spotify_error_code": getattr(exc, "code", None),
                                    "spotify_error_reason": getattr(exc, "reason", None),
                                    "spotify_error_message": getattr(exc, "msg", None),
                                },
                                exc_info=exc,
                            )
                            snapshot["warnings"].append(
                                f"Skipped playlist '{playlist_name}' ({playlist_id}) because Spotify denied access to its tracks."
                            )
                            skip_playlist = True
                            break
                        raise

                    track_items = tracks_page.get("items", [])
                    if not track_items:
                        break

                    fetched_item_count += len(track_items)
                    for track_item in track_items:
                        added_at = track_item.get("added_at")
                        if not _is_before_cutoff(added_at, cutoff_dt):
                            skipped_cutoff_count += 1
                            continue

                        track = get_playlist_track_object(track_item)
                        if track is None or track.get("is_local"):
                            if track is None:
                                skipped_missing_track_count += 1
                            else:
                                skipped_local_count += 1
                            continue

                        uri = track.get("uri")
                        if not isinstance(uri, str) or not uri:
                            skipped_missing_uri_count += 1
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

                if skip_playlist:
                    continue

                logger.info(
                    "snapshot_playlist_export_completed",
                    extra={
                        "playlist_id": playlist_id,
                        "playlist_name": exported_playlist["name"],
                        "fetched_item_count": fetched_item_count,
                        "exported_track_count": len(exported_playlist["tracks"]),
                        "skipped_cutoff_count": skipped_cutoff_count,
                        "skipped_local_count": skipped_local_count,
                        "skipped_missing_uri_count": skipped_missing_uri_count,
                        "skipped_missing_track_count": skipped_missing_track_count,
                    },
                )
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
    strict_liked_order_delay_seconds: float | None = None,
    strict_liked_order_cooldown_every: int | None = None,
    strict_liked_order_cooldown_seconds: float | None = None,
    strict_liked_order_max_consecutive_rate_limits: int | None = None,
    strict_liked_order_resume_from_index: int = 0,
    progress_callback: ProgressCallback | None = None,
) -> dict[str, Any]:
    _report_progress(progress_callback, 5, "Preparing snapshot import")
    me = sp.current_user()
    target_account = _build_account_identity(me)
    user_id = target_account.get("id") if isinstance(target_account, dict) else None
    source_account = _extract_snapshot_source_account(snapshot)
    strict_liked_order_controls = _resolve_strict_liked_order_controls(
        delay_seconds=strict_liked_order_delay_seconds,
        cooldown_every=strict_liked_order_cooldown_every,
        cooldown_seconds=strict_liked_order_cooldown_seconds,
        max_consecutive_rate_limits=strict_liked_order_max_consecutive_rate_limits,
        resume_from_index=strict_liked_order_resume_from_index,
    )
    resume_liked_tracks_import = (
        import_liked_tracks
        and strict_liked_order
        and strict_liked_order_controls["resume_from_index"] > 0
    )

    result: dict[str, Any] = {
        "imported_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "target_user_id": user_id,
        "target_account": target_account,
        "source_user_id": source_account.get("id") if isinstance(source_account, dict) else snapshot.get("source_user_id"),
        "source_account": source_account,
        "summary": _build_empty_import_summary(),
        "created_playlists": [],
        "warnings": [],
        "strict_liked_order": {
            "enabled": strict_liked_order,
            "delay_seconds": strict_liked_order_controls["delay_seconds"],
            "cooldown_every": strict_liked_order_controls["cooldown_every"],
            "cooldown_seconds": strict_liked_order_controls["cooldown_seconds"],
            "max_consecutive_rate_limits": strict_liked_order_controls["max_consecutive_rate_limits"],
            "resume_from_index": strict_liked_order_controls["resume_from_index"],
            "requested_total": 0,
            "remaining_total": 0,
            "processed_count": 0,
            "completed": not strict_liked_order,
            "stopped_early": False,
            "stopped_reason": None,
            "next_resume_index": None,
        },
        "next_resume_index": None,
    }

    if import_liked_tracks and strict_liked_order_controls["resume_from_index"] > 0 and not strict_liked_order:
        result["warnings"].append(
            "strict_liked_order_resume_from_index was ignored because strict_liked_order is disabled."
        )

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
            if resume_liked_tracks_import:
                result["warnings"].append(
                    "Skipped clearing currently liked songs because strict liked-order resume needs already imported songs to remain in place."
                )
            else:
                existing_track_ids = _collect_saved_track_ids(sp)
                existing_track_uris = [_id_to_uri("track", track_id) for track_id in existing_track_ids]
                for track_chunk in _chunk(existing_track_uris, LIBRARY_ITEMS_BATCH_SIZE):
                    try:
                        _remove_items_from_library(sp, track_chunk)
                        result["summary"]["liked_tracks_removed"] += len(track_chunk)
                    except Exception:
                        for track_uri in track_chunk:
                            try:
                                _remove_items_from_library(sp, [track_uri])
                                result["summary"]["liked_tracks_removed"] += 1
                            except Exception:
                                result["warnings"].append(
                                    f"Failed to remove liked track before import: {_uri_to_id(track_uri)}"
                                )

        if import_saved_albums:
            existing_album_ids = _collect_saved_album_ids(sp)
            existing_album_uris = [_id_to_uri("album", album_id) for album_id in existing_album_ids]
            for album_chunk in _chunk(existing_album_uris, LIBRARY_ITEMS_BATCH_SIZE):
                try:
                    _remove_items_from_library(sp, album_chunk)
                    result["summary"]["saved_albums_removed"] += len(album_chunk)
                except Exception:
                    for album_uri in album_chunk:
                        try:
                            _remove_items_from_library(sp, [album_uri])
                            result["summary"]["saved_albums_removed"] += 1
                        except Exception:
                            result["warnings"].append(
                                f"Failed to remove saved album before import: {_uri_to_id(album_uri)}"
                            )

        if import_followed_artists:
            existing_artist_ids = _collect_followed_artist_ids(sp)
            existing_artist_uris = [_id_to_uri("artist", artist_id) for artist_id in existing_artist_ids]
            for artist_chunk in _chunk(existing_artist_uris, LIBRARY_ITEMS_BATCH_SIZE):
                try:
                    _remove_items_from_library(sp, artist_chunk)
                    result["summary"]["followed_artists_removed"] += len(artist_chunk)
                except Exception:
                    for artist_uri in artist_chunk:
                        try:
                            _remove_items_from_library(sp, [artist_uri])
                            result["summary"]["followed_artists_removed"] += 1
                        except Exception:
                            result["warnings"].append(
                                f"Failed to unfollow artist before import: {_uri_to_id(artist_uri)}"
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
                    created = create_current_user_playlist(
                        sp=sp,
                        name=name,
                        public=public,
                        description=description,
                    )
                except Exception:
                    # Retry as private if public creation is not permitted.
                    created = create_current_user_playlist(
                        sp=sp,
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
                        add_items_to_playlist(sp, playlist_id, uri_chunk)
                        result["summary"]["playlist_tracks_added"] += len(uri_chunk)
                    except Exception:
                        # Fall back to single inserts to salvage valid tracks.
                        for uri in uri_chunk:
                            try:
                                add_items_to_playlist(sp, playlist_id, [uri])
                                result["summary"]["playlist_tracks_added"] += 1
                            except Exception:
                                result["summary"]["playlist_tracks_failed"] += 1

    if import_liked_tracks:
        _report_progress(progress_callback, 65, "Restoring liked songs")
        liked_entries = snapshot.get("liked_tracks", [])
        if isinstance(liked_entries, list):
            ordered_liked_entries = _order_entries_by_position(liked_entries)
            liked_uris = _normalize_uri_entries(ordered_liked_entries)
            liked_track_uris = _dedupe_preserve_order([_id_to_uri("track", uri) for uri in liked_uris if uri])
            if _entries_look_newest_first(ordered_liked_entries):
                # Spotify "Liked Songs" is shown newest-first, so we add oldest-first
                # to preserve the original visible order after import.
                liked_track_uris = list(reversed(liked_track_uris))

            if strict_liked_order:
                total_liked_tracks = len(liked_track_uris)
                resume_from_index = min(strict_liked_order_controls["resume_from_index"], total_liked_tracks)
                result["strict_liked_order"]["requested_total"] = total_liked_tracks
                result["strict_liked_order"]["remaining_total"] = max(0, total_liked_tracks - resume_from_index)
                result["strict_liked_order"]["resume_from_index"] = resume_from_index
                result["warnings"].append(_build_strict_liked_order_warning(strict_liked_order_controls))
                if strict_liked_order_controls["resume_from_index"] > total_liked_tracks and total_liked_tracks > 0:
                    result["warnings"].append(
                        f"Strict liked-order resume index {strict_liked_order_controls['resume_from_index']} exceeded the available liked songs; nothing remained to restore."
                    )
                elif resume_from_index > 0 and total_liked_tracks > 0:
                    result["warnings"].append(
                        f"Resuming strict liked-song import from position {resume_from_index + 1} of {total_liked_tracks}."
                    )

                consecutive_rate_limit_failures = 0
                remaining_track_uris = liked_track_uris[resume_from_index:]
                for offset, track_uri in enumerate(remaining_track_uris):
                    absolute_index = resume_from_index + offset
                    has_more_tracks = absolute_index + 1 < total_liked_tracks
                    try:
                        _save_items_to_library_with_retries(sp, [track_uri])
                        result["summary"]["liked_tracks_added"] += 1
                        consecutive_rate_limit_failures = 0
                    except SpotifyException as exc:
                        result["summary"]["liked_tracks_failed"] += 1
                        if getattr(exc, "http_status", None) == 429:
                            consecutive_rate_limit_failures += 1
                            max_consecutive_rate_limits = strict_liked_order_controls["max_consecutive_rate_limits"]
                            if (
                                isinstance(max_consecutive_rate_limits, int)
                                and max_consecutive_rate_limits > 0
                                and consecutive_rate_limit_failures >= max_consecutive_rate_limits
                            ):
                                result["strict_liked_order"]["processed_count"] = offset + 1
                                result["strict_liked_order"]["completed"] = False
                                result["strict_liked_order"]["stopped_early"] = True
                                result["strict_liked_order"]["stopped_reason"] = "rate_limited"
                                result["strict_liked_order"]["next_resume_index"] = absolute_index
                                result["next_resume_index"] = absolute_index
                                result["warnings"].append(
                                    f"Paused strict liked-song import after repeated Spotify rate limits. Resume from position {absolute_index + 1}."
                                )
                                break
                        else:
                            consecutive_rate_limit_failures = 0
                    except Exception:
                        result["summary"]["liked_tracks_failed"] += 1
                        consecutive_rate_limit_failures = 0

                    result["strict_liked_order"]["processed_count"] = offset + 1
                    result["strict_liked_order"]["next_resume_index"] = absolute_index + 1 if has_more_tracks else None
                    result["next_resume_index"] = absolute_index + 1 if has_more_tracks else None
                    liked_progress = 65 + int(((absolute_index + 1) / total_liked_tracks) * 16) if total_liked_tracks else 65

                    if total_liked_tracks and (
                        absolute_index + 1 == resume_from_index + 1
                        or absolute_index + 1 == total_liked_tracks
                        or (absolute_index + 1 - resume_from_index) % 10 == 0
                    ):
                        _report_progress(
                            progress_callback,
                            liked_progress,
                            f"Restoring liked songs in strict order ({absolute_index + 1}/{total_liked_tracks})",
                        )

                    cooldown_every = strict_liked_order_controls["cooldown_every"]
                    cooldown_seconds = strict_liked_order_controls["cooldown_seconds"]
                    if (
                        has_more_tracks
                        and isinstance(cooldown_every, int)
                        and cooldown_every > 0
                        and cooldown_seconds > 0
                        and (offset + 1) % cooldown_every == 0
                    ):
                        _report_progress(
                            progress_callback,
                            liked_progress if total_liked_tracks else 65,
                            f"Cooling down strict liked-song import after {absolute_index + 1} songs",
                        )
                        time.sleep(cooldown_seconds)

                    if has_more_tracks:
                        time.sleep(strict_liked_order_controls["delay_seconds"])

                if not result["strict_liked_order"]["stopped_early"]:
                    result["strict_liked_order"]["completed"] = True
                    result["strict_liked_order"]["next_resume_index"] = None
                    result["next_resume_index"] = None
                if result["summary"]["liked_tracks_failed"] > 0:
                    result["warnings"].append(
                        "Some liked songs could not be restored in strict order. Spotify rate limits or unavailable tracks may require retrying later."
                    )
            else:
                for chunk_uris in _chunk(liked_track_uris, LIBRARY_ITEMS_BATCH_SIZE):
                    try:
                        _save_items_to_library(sp, chunk_uris)
                        result["summary"]["liked_tracks_added"] += len(chunk_uris)
                    except Exception:
                        for track_uri in chunk_uris:
                            try:
                                _save_items_to_library(sp, [track_uri])
                                result["summary"]["liked_tracks_added"] += 1
                            except Exception:
                                result["summary"]["liked_tracks_failed"] += 1

    if import_saved_albums:
        _report_progress(progress_callback, 82, "Restoring saved albums")
        album_entries = snapshot.get("saved_albums", [])
        if isinstance(album_entries, list):
            ordered_album_entries = _order_entries_by_position(album_entries)
            album_uris = _normalize_uri_entries(ordered_album_entries)
            normalized_album_uris = _dedupe_preserve_order([_id_to_uri("album", uri) for uri in album_uris if uri])
            if _entries_look_newest_first(ordered_album_entries):
                # Saved albums are typically displayed newest-first as well.
                normalized_album_uris = list(reversed(normalized_album_uris))

            for chunk_uris in _chunk(normalized_album_uris, LIBRARY_ITEMS_BATCH_SIZE):
                try:
                    _save_items_to_library(sp, chunk_uris)
                    result["summary"]["saved_albums_added"] += len(chunk_uris)
                except Exception:
                    for album_uri in chunk_uris:
                        try:
                            _save_items_to_library(sp, [album_uri])
                            result["summary"]["saved_albums_added"] += 1
                        except Exception:
                            result["summary"]["saved_albums_failed"] += 1

    if import_followed_artists:
        _report_progress(progress_callback, 92, "Restoring followed artists")
        artist_entries = snapshot.get("followed_artists", [])
        if isinstance(artist_entries, list):
            artist_uris: list[str] = []
            for entry in artist_entries:
                if isinstance(entry, dict):
                    artist_id = entry.get("id")
                    artist_uri = entry.get("uri")
                    if isinstance(artist_id, str) and artist_id:
                        artist_uris.append(_id_to_uri("artist", artist_id))
                    elif isinstance(artist_uri, str) and artist_uri:
                        artist_uris.append(_id_to_uri("artist", artist_uri))
                elif isinstance(entry, str) and entry:
                    artist_uris.append(_id_to_uri("artist", entry))

            artist_uris = _dedupe_preserve_order(artist_uris)

            for chunk_uris in _chunk(artist_uris, LIBRARY_ITEMS_BATCH_SIZE):
                try:
                    _save_items_to_library(sp, chunk_uris)
                    result["summary"]["followed_artists_added"] += len(chunk_uris)
                except Exception:
                    for artist_uri in chunk_uris:
                        try:
                            _save_items_to_library(sp, [artist_uri])
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
    strict_liked_order_delay_seconds: float | None = None,
    strict_liked_order_cooldown_every: int | None = None,
    strict_liked_order_cooldown_seconds: float | None = None,
    strict_liked_order_max_consecutive_rate_limits: int | None = None,
    strict_liked_order_resume_from_index: int = 0,
) -> dict[str, Any]:
    me = sp.current_user()
    target_account = _build_account_identity(me)
    user_id = target_account.get("id") if isinstance(target_account, dict) else None
    source_account = _extract_snapshot_source_account(snapshot)
    source_user_id = source_account.get("id") if isinstance(source_account, dict) else snapshot.get("source_user_id")
    strict_liked_order_controls = _resolve_strict_liked_order_controls(
        delay_seconds=strict_liked_order_delay_seconds,
        cooldown_every=strict_liked_order_cooldown_every,
        cooldown_seconds=strict_liked_order_cooldown_seconds,
        max_consecutive_rate_limits=strict_liked_order_max_consecutive_rate_limits,
        resume_from_index=strict_liked_order_resume_from_index,
    )
    resume_liked_tracks_import = (
        import_liked_tracks
        and strict_liked_order
        and strict_liked_order_controls["resume_from_index"] > 0
    )

    warnings: list[str] = []
    destructive_operations: list[str] = []
    summary = _build_empty_import_summary()
    snapshot_counts = summarize_snapshot(snapshot)

    if source_user_id == user_id and user_id:
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
            resume_from_index = min(strict_liked_order_controls["resume_from_index"], len(liked_ids))
            summary["liked_tracks_added"] = len(liked_ids) - resume_from_index if strict_liked_order else len(liked_ids)
            if strict_liked_order and liked_ids:
                warnings.append(
                    _build_strict_liked_order_warning(strict_liked_order_controls)
                )
                if strict_liked_order_controls["resume_from_index"] > len(liked_ids):
                    warnings.append(
                        f"Strict liked-order resume index {strict_liked_order_controls['resume_from_index']} exceeds the available liked songs; no liked songs remain to restore."
                    )
                elif resume_from_index > 0:
                    warnings.append(
                        f"Strict liked-song import will resume from position {resume_from_index + 1} of {len(liked_ids)}."
                    )
            elif strict_liked_order_controls["resume_from_index"] > 0:
                warnings.append(
                    "strict_liked_order_resume_from_index will be ignored because strict_liked_order is disabled."
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
            if resume_liked_tracks_import:
                warnings.append(
                    "Liked-song cleanup will be skipped because strict liked-order resume must preserve songs that were already imported."
                )
            else:
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
        "source_user_id": source_user_id,
        "source_account": source_account,
        "target_user_id": user_id,
        "target_account": target_account,
        "snapshot_counts": snapshot_counts,
        "summary": summary,
        "requested_actions": {
            "import_playlists": import_playlists,
            "import_liked_tracks": import_liked_tracks,
            "import_saved_albums": import_saved_albums,
            "import_followed_artists": import_followed_artists,
            "clear_existing_before_import": clear_existing_before_import,
            "strict_liked_order": strict_liked_order,
            "strict_liked_order_delay_seconds": strict_liked_order_controls["delay_seconds"],
            "strict_liked_order_cooldown_every": strict_liked_order_controls["cooldown_every"],
            "strict_liked_order_cooldown_seconds": strict_liked_order_controls["cooldown_seconds"],
            "strict_liked_order_max_consecutive_rate_limits": strict_liked_order_controls["max_consecutive_rate_limits"],
            "strict_liked_order_resume_from_index": strict_liked_order_controls["resume_from_index"],
        },
        "destructive_operations": destructive_operations,
        "warnings": warnings,
        "requires_confirmation": clear_existing_before_import,
    }
