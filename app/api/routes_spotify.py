from fastapi import APIRouter, Request, Query, HTTPException
from fastapi.responses import RedirectResponse

from ..core.auth import get_spotify_client, get_oauth
from ..services.spotify_time_machine import (
    fetch_all_liked_songs,
    group_songs_by_period,
    add_tracks_in_chunks,
    group_songs_by_language,
    search_artists,
)
from ..schemas.playlist import (CreatePlaylistRequest, CreateLanguagePlaylistRequest)

router = APIRouter()


@router.get("/ping")
def ping():
    return {"status": "ok"}


@router.get("/login")
def login():
    sp_oauth = get_oauth()
    auth_url = sp_oauth.get_authorize_url()
    return RedirectResponse(url=auth_url)


@router.get("/callback")
def callback(request: Request):
    sp_oauth = get_oauth()
    code = request.query_params.get("code")
    if not code:
        return {"error": "No code provided in callback"}

    token_info = sp_oauth.get_access_token(code, as_dict=True)

    return {
        "message": "Authorized!",
        "token_info": token_info,
    }


@router.get("/get_token")
def get_token():
    sp_oauth = get_oauth()
    token = sp_oauth.get_cached_token()
    return token or {"error": "No cached token"}


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

    name = payload.playlist_name or f"Liked Songs – {payload.language_code.upper()}"
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

