from fastapi import APIRouter, HTTPException, Query, Request

from ..core.auth import DEFAULT_ACCOUNT_ROLE, get_spotify_client, normalize_account_role
from ..core.observability import get_logger
from ..schemas.playlist import (
    AppendPlaylistRequest,
    AppendPlaylistResponse,
    CreateLanguagePlaylistRequest,
    CreatePlaylistRequest,
    CurrentUserPlaylistsResponse,
    PlaylistTracksResponse,
)
from ..services.spotify_playlists import (
    append_playlist_to_target,
    create_current_user_playlist,
    get_playlist_tracks,
    list_current_user_playlists,
)
from ..services.spotify_time_machine import (
    add_tracks_in_chunks,
    fetch_all_liked_songs,
    group_songs_by_language,
    group_songs_by_period,
)

router = APIRouter(tags=["Playlists"])
logger = get_logger("playlists")


@router.get(
    "/playlists",
    response_model=CurrentUserPlaylistsResponse,
    summary="List playlists for the connected Spotify account",
)
def get_current_user_playlists(
    request: Request,
    account_role: str = Query(DEFAULT_ACCOUNT_ROLE, description="Spotify account slot: source or target."),
):
    normalized_role = normalize_account_role(account_role)
    logger.info(
        "spotify_playlists_fetch_started",
        extra={"method": request.method, "path": request.url.path, "account_role": normalized_role},
    )
    sp = get_spotify_client(request, normalized_role)
    playlists = list_current_user_playlists(sp)
    logger.info(
        "spotify_playlists_fetch_completed",
        extra={
            "method": request.method,
            "path": request.url.path,
            "account_role": normalized_role,
            "playlist_count": len(playlists),
        },
    )
    return {
        "playlists": playlists,
        "total_playlists": len(playlists),
    }


@router.get(
    "/playlists/{playlist_id}/tracks",
    response_model=PlaylistTracksResponse,
    summary="List songs inside a selected playlist",
)
def get_tracks_for_playlist(
    playlist_id: str,
    request: Request,
    account_role: str = Query(DEFAULT_ACCOUNT_ROLE, description="Spotify account slot: source or target."),
):
    normalized_role = normalize_account_role(account_role)
    logger.info(
        "spotify_playlist_tracks_fetch_started",
        extra={
            "method": request.method,
            "path": request.url.path,
            "account_role": normalized_role,
            "playlist_id": playlist_id,
        },
    )
    sp = get_spotify_client(request, normalized_role)
    result = get_playlist_tracks(sp, playlist_id)
    logger.info(
        "spotify_playlist_tracks_fetch_completed",
        extra={
            "method": request.method,
            "path": request.url.path,
            "account_role": normalized_role,
            "playlist_id": playlist_id,
            "track_count": result["total_tracks"],
        },
    )
    return result


@router.post(
    "/playlists/append",
    response_model=AppendPlaylistResponse,
    summary="Add one playlist into liked songs or another playlist",
)
def append_playlist(
    payload: AppendPlaylistRequest,
    request: Request,
    account_role: str = Query(DEFAULT_ACCOUNT_ROLE, description="Spotify account slot: source or target."),
):
    normalized_role = normalize_account_role(account_role)
    logger.info(
        "spotify_playlist_append_started",
        extra={
            "method": request.method,
            "path": request.url.path,
            "account_role": normalized_role,
            "source_playlist_id": payload.source_playlist_id,
            "target_type": payload.target_type,
            "target_playlist_id": payload.target_playlist_id,
        },
    )
    sp = get_spotify_client(request, normalized_role)

    try:
        result = append_playlist_to_target(
            sp,
            source_playlist_id=payload.source_playlist_id,
            target_type=payload.target_type,
            target_playlist_id=payload.target_playlist_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    logger.info(
        "spotify_playlist_append_completed",
        extra={
            "method": request.method,
            "path": request.url.path,
            "account_role": normalized_role,
            "source_playlist_id": payload.source_playlist_id,
            "target_type": payload.target_type,
            "target_playlist_id": payload.target_playlist_id,
            "tracks_added": result["tracks_added"],
            "skipped_tracks": result["skipped_tracks"],
        },
    )
    return result


@router.get("/fetch_and_group", summary="Group liked songs by time period")
def fetch_and_group(
    request: Request,
    period: str = Query("monthly"),
    start_year: int | None = Query(None),
    end_year: int | None = Query(None),
    order: str = Query("asc"),
):
    sp = get_spotify_client(request)
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


@router.post("/create_playlist_for_group", summary="Create playlist from a time group")
def create_playlist_for_group(request: Request, payload: CreatePlaylistRequest):
    sp = get_spotify_client(request)

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

    name = payload.playlist_name or f"Liked Songs - {payload.group_key}"
    description = payload.playlist_description or f"Liked songs for period {payload.group_key}"

    playlist = create_current_user_playlist(
        sp=sp,
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


@router.get("/group_by_language", summary="Group liked songs by detected language (beta)")
def group_by_language(request: Request):
    sp = get_spotify_client(request)
    songs = fetch_all_liked_songs(sp)
    groups = group_songs_by_language(songs)
    return {"groups": groups}


@router.post("/create_playlist_by_language", summary="Create playlist from a language group (beta)")
def create_playlist_by_language(request: Request, payload: CreateLanguagePlaylistRequest):
    sp = get_spotify_client(request)
    songs = fetch_all_liked_songs(sp)
    groups = group_songs_by_language(songs)

    if payload.language_code not in groups:
        raise HTTPException(status_code=404, detail="No songs detected for this language")

    track_ids = groups[payload.language_code]
    if len(track_ids) < payload.min_songs:
        raise HTTPException(status_code=400, detail="Not enough songs to create a playlist")

    name = payload.playlist_name or f"Liked Songs - {payload.language_code.upper()}"
    description = f"Liked songs detected as {payload.language_code.upper()}"

    playlist = create_current_user_playlist(
        sp=sp,
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
