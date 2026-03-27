from fastapi import APIRouter, Query

from ..core.auth import get_spotify_client
from ..services.spotify_time_machine import search_artists

router = APIRouter(tags=["Discovery"])


@router.get("/search_artists", summary="Search Spotify artists")
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
