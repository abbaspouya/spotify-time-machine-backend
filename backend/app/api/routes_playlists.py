from fastapi import APIRouter, HTTPException, Query

from ..core.auth import get_spotify_client
from ..schemas.playlist import CreateLanguagePlaylistRequest, CreatePlaylistRequest
from ..services.spotify_time_machine import (
    add_tracks_in_chunks,
    fetch_all_liked_songs,
    group_songs_by_language,
    group_songs_by_period,
)

router = APIRouter(tags=["Playlists"])


@router.get("/fetch_and_group", summary="Group liked songs by time period")
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


@router.post("/create_playlist_for_group", summary="Create playlist from a time group")
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


@router.get("/group_by_language", summary="Group liked songs by detected language")
def group_by_language():
    sp = get_spotify_client()
    songs = fetch_all_liked_songs(sp)
    groups = group_songs_by_language(songs)
    return {"groups": groups}


@router.post("/create_playlist_by_language", summary="Create playlist from a language group")
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
