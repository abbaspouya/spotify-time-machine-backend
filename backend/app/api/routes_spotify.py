from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from spotipy.exceptions import SpotifyException

from ..core.auth import get_oauth, get_spotify_client
from ..core.config import FRONTEND_AUTH_CALLBACK_PATH, FRONTEND_URL
from ..schemas.account_snapshot import (
    ExportAccountSnapshotRequest,
    ImportAccountSnapshotRequest,
)
from ..schemas.playlist import CreateLanguagePlaylistRequest, CreatePlaylistRequest
from ..services.account_snapshot import (
    export_account_snapshot,
    import_account_snapshot,
    load_snapshot_from_file,
    write_snapshot_to_file,
)
from ..services.spotify_time_machine import (
    add_tracks_in_chunks,
    fetch_all_liked_songs,
    group_songs_by_language,
    group_songs_by_period,
    search_artists,
)

router = APIRouter()


def _build_frontend_redirect(status: str, detail: str | None = None) -> str:
    target = f"{FRONTEND_URL}{FRONTEND_AUTH_CALLBACK_PATH}"
    params = {"status": status}
    if detail:
        params["detail"] = detail
    return f"{target}?{urlencode(params)}"


def _build_auth_status_response() -> dict[str, object]:
    token = get_oauth().get_cached_token()
    if not token:
        return {"authenticated": False}

    return {
        "authenticated": True,
        "expires_at": token.get("expires_at"),
        "scope": token.get("scope"),
        "token_type": token.get("token_type"),
    }


@router.get("/ping")
def ping():
    return {"status": "ok"}


@router.get("/login")
def login(
    raw: bool = Query(
        False,
        description="If true, return the Spotify auth URL as JSON instead of redirecting",
    )
):
    """
    Start Spotify OAuth flow.

    - Default behaviour: redirect the browser to Spotify's authorization page.
    - If `raw=true` is provided, return the full Spotify authorization URL as JSON
      (useful for testing from Swagger / fetch clients).
    """
    sp_oauth = get_oauth()
    auth_url = sp_oauth.get_authorize_url()
    if "show_dialog=" not in auth_url:
        separator = "&" if "?" in auth_url else "?"
        auth_url = f"{auth_url}{separator}show_dialog=true"

    if raw:
        return {"auth_url": auth_url}

    return RedirectResponse(url=auth_url)


@router.get("/callback")
def callback(request: Request):
    sp_oauth = get_oauth()
    error = request.query_params.get("error")
    code = request.query_params.get("code")

    if error:
        return RedirectResponse(url=_build_frontend_redirect("error", error), status_code=303)

    if not code:
        return RedirectResponse(
            url=_build_frontend_redirect("error", "No code provided in callback"),
            status_code=303,
        )

    try:
        sp_oauth.get_access_token(code, as_dict=True)
    except Exception as exc:
        return RedirectResponse(
            url=_build_frontend_redirect("error", f"Authorization failed: {exc}"),
            status_code=303,
        )

    return RedirectResponse(url=_build_frontend_redirect("success"), status_code=303)


@router.get("/auth_status")
def auth_status():
    return _build_auth_status_response()


@router.get("/get_token")
def get_token():
    # Legacy route kept for compatibility, but do not expose tokens to the browser.
    return _build_auth_status_response()


@router.get("/whoami")
def whoami():
    sp = get_spotify_client()
    me = sp.current_user()

    return {
        "id": me.get("id"),
        "display_name": me.get("display_name"),
        "email": me.get("email"),
        "country": me.get("country"),
        "product": me.get("product"),
        "profile_url": me.get("external_urls", {}).get("spotify"),
    }


@router.get("/fetch_and_group")
def fetch_and_group(
    period: str = Query("monthly"),
    start_year: int | None = Query(None),
    end_year: int | None = Query(None),
    order: str = Query("asc"),
):
    sp = get_spotify_client()
    songs = fetch_all_liked_songs(sp)

    groups = group_songs_by_period(
        songs,
        period_type=period,
        start_year=start_year,
        end_year=end_year,
        order=order,
    )

    return {
        "groups": groups,
        "total_songs": len(songs),
    }


@router.post("/create_playlist_for_group")
def create_playlist_for_group(payload: CreatePlaylistRequest):
    sp = get_spotify_client()

    songs = fetch_all_liked_songs(sp)

    groups = group_songs_by_period(
        songs,
        period_type=payload.period,
        start_year=payload.start_year,
        end_year=payload.end_year,
        order=payload.order,
    )

    if payload.group_key not in groups:
        raise HTTPException(status_code=404, detail=f"Group '{payload.group_key}' not found.")

    track_ids = groups[payload.group_key]
    if not track_ids:
        raise HTTPException(status_code=400, detail="No tracks in this group.")

    me = sp.current_user()
    user_id = me["id"]

    name = payload.playlist_name or f"Liked Songs - {payload.group_key}"
    description = payload.playlist_description or f"Liked songs for period {payload.group_key}"

    playlist = sp.user_playlist_create(
        user=user_id,
        name=name,
        public=False,
        description=description,
    )

    playlist_id = playlist["id"]

    add_tracks_in_chunks(sp, playlist_id, track_ids)

    return {
        "message": "Playlist created",
        "playlist_id": playlist_id,
        "playlist_name": name,
        "group_key": payload.group_key,
        "track_count": len(track_ids),
        "playlist_url": playlist["external_urls"]["spotify"],
    }


@router.get("/group_by_language")
def group_by_language():
    sp = get_spotify_client()
    songs = fetch_all_liked_songs(sp)
    groups = group_songs_by_language(songs)
    return {"groups": groups}


@router.post("/create_playlist_by_language")
def create_playlist_by_language(payload: CreateLanguagePlaylistRequest):
    sp = get_spotify_client()
    songs = fetch_all_liked_songs(sp)
    groups = group_songs_by_language(songs)

    if payload.language_code not in groups:
        raise HTTPException(status_code=404, detail="No songs detected for this language")

    track_ids = groups[payload.language_code]
    if len(track_ids) < payload.min_songs:
        raise HTTPException(status_code=400, detail="Not enough songs to create a playlist")

    me = sp.current_user()
    user_id = me["id"]

    name = payload.playlist_name or f"Liked Songs - {payload.language_code.upper()}"
    description = f"Liked songs detected as {payload.language_code.upper()}"

    playlist = sp.user_playlist_create(
        user=user_id,
        name=name,
        public=False,
        description=description,
    )

    playlist_id = playlist["id"]
    add_tracks_in_chunks(sp, playlist_id, track_ids)

    return {
        "message": "Playlist created",
        "playlist_id": playlist_id,
        "playlist_name": name,
        "language": payload.language_code,
        "track_count": len(track_ids),
        "playlist_url": playlist["external_urls"]["spotify"],
    }


@router.get("/search_artists")
def search_artists_endpoint(
    q: str = Query(..., min_length=1, description="Search text for artist name"),
    limit: int = Query(20, ge=1, le=50, description="Max number of artists to return"),
):
    """
    Search Spotify artists by name.
    Intended for use in search bars / autocomplete.
    """
    sp = get_spotify_client()
    artists = search_artists(sp, query=q, limit=limit)

    return {
        "query": q,
        "count": len(artists),
        "artists": artists,
    }


@router.post("/export_account_snapshot")
def export_account_snapshot_endpoint(payload: ExportAccountSnapshotRequest):
    sp = get_spotify_client()

    try:
        snapshot = export_account_snapshot(
            sp=sp,
            cutoff_date=payload.cutoff_date,
            include_playlists=payload.include_playlists,
            include_liked_tracks=payload.include_liked_tracks,
            include_saved_albums=payload.include_saved_albums,
            include_followed_artists=payload.include_followed_artists,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except SpotifyException as exc:
        status = getattr(exc, "http_status", None) or 502
        message = getattr(exc, "msg", str(exc))
        raise HTTPException(status_code=status, detail=f"Spotify API error: {message}")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unexpected export error: {exc}")

    file_path = None
    if payload.write_to_file:
        try:
            file_path = write_snapshot_to_file(snapshot, payload.output_file_name)
        except OSError as exc:
            raise HTTPException(status_code=500, detail=f"Failed to write snapshot file: {exc}")

    response = {
        "message": "Snapshot exported",
        "file_path": file_path,
        "counts": snapshot.get("counts", {}),
        "source_user_id": snapshot.get("source_user_id"),
        "exported_at": snapshot.get("exported_at"),
        "cutoff_date": snapshot.get("cutoff_date"),
    }

    if payload.return_snapshot:
        response["snapshot"] = snapshot

    return response


@router.post("/import_account_snapshot")
def import_account_snapshot_endpoint(payload: ImportAccountSnapshotRequest):
    if not payload.file_path and payload.snapshot is None:
        raise HTTPException(
            status_code=400,
            detail="Provide either 'file_path' or 'snapshot' in the request body.",
        )

    if payload.file_path and payload.snapshot is not None:
        raise HTTPException(
            status_code=400,
            detail="Provide only one source: either 'file_path' or 'snapshot'.",
        )

    if payload.snapshot is not None and not isinstance(payload.snapshot, dict):
        raise HTTPException(status_code=400, detail="'snapshot' must be a JSON object.")

    try:
        snapshot = payload.snapshot or load_snapshot_from_file(payload.file_path or "")
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    sp = get_spotify_client()
    result = import_account_snapshot(
        sp=sp,
        snapshot=snapshot,
        import_playlists=payload.import_playlists,
        import_liked_tracks=payload.import_liked_tracks,
        import_saved_albums=payload.import_saved_albums,
        import_followed_artists=payload.import_followed_artists,
        clear_existing_before_import=payload.clear_existing_before_import,
        strict_liked_order=payload.strict_liked_order,
    )

    return {
        "message": "Snapshot import completed",
        "result": result,
    }
