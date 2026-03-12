from fastapi import HTTPException
import spotipy

from .config import sp_oauth


def get_spotify_client() -> spotipy.Spotify:
    token_info = sp_oauth.get_cached_token()
    if not token_info:
        raise HTTPException(status_code=401, detail="No Spotify token found. Go to /login first.")

    access_token = token_info["access_token"]
    return spotipy.Spotify(auth=access_token)


def get_oauth():
    return sp_oauth
