from fastapi import APIRouter, HTTPException, Query, Request

from ..core.auth import get_spotify_client
from ..services.spotify_time_machine import search_artists
from ..services.top_tracks import get_top_tracks_summary

router = APIRouter(tags=["Discovery"])


@router.get("/search_artists", summary="Search Spotify artists")
def search_artists_endpoint(
    request: Request,
    q: str = Query(..., min_length=1, description="Search text for artist name"),
    limit: int = Query(20, ge=1, le=50, description="Max number of artists to return"),
):
    """
    Search Spotify artists by name.
    Intended for use in search bars / autocomplete.
    """
    sp = get_spotify_client(request)
    artists = search_artists(sp, query=q, limit=limit)

    return {
        "query": q,
        "count": len(artists),
        "artists": artists,
    }


@router.get("/top_tracks", summary="Get top tracks recap")
def top_tracks_endpoint(
    request: Request,
    timeframe: str = Query("4_weeks", description="One of: 1_week, 4_weeks, 6_months, lifetime, custom"),
    days: int | None = Query(None, ge=1, le=365, description="Required when timeframe=custom"),
    limit: int = Query(50, ge=1, le=50, description="Max number of tracks to return"),
):
    sp = get_spotify_client(request)

    try:
        return get_top_tracks_summary(sp, timeframe=timeframe, days=days, limit=limit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
