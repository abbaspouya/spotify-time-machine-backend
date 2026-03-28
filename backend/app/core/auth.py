from fastapi import HTTPException, Request
import spotipy
from spotipy.cache_handler import CacheHandler
from spotipy.oauth2 import SpotifyOAuth

from .config import SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI, SPOTIFY_SCOPE
from .session_store import get_session_id_from_request, get_token_info, save_token_info, touch_session


class SessionCacheHandler(CacheHandler):
    def __init__(self, session_id: str):
        self.session_id = session_id

    def get_cached_token(self):
        return get_token_info(self.session_id)

    def save_token_to_cache(self, token_info):
        save_token_info(self.session_id, token_info)

    def delete_cache(self):
        save_token_info(self.session_id, None)


def get_oauth_for_session(session_id: str) -> SpotifyOAuth:
    return SpotifyOAuth(
        client_id=SPOTIFY_CLIENT_ID,
        client_secret=SPOTIFY_CLIENT_SECRET,
        redirect_uri=SPOTIFY_REDIRECT_URI,
        cache_handler=SessionCacheHandler(session_id),
        scope=SPOTIFY_SCOPE,
    )


def get_oauth(request: Request):
    session_id = get_session_id_from_request(request)
    if not session_id:
        raise HTTPException(status_code=401, detail="No active session found. Go to /login first.")
    return get_oauth_for_session(session_id)


def get_token_info_for_session(session_id: str) -> dict[str, object] | None:
    oauth = get_oauth_for_session(session_id)
    token_info = oauth.validate_token(oauth.cache_handler.get_cached_token())
    if not token_info:
        return None

    touch_session(session_id)
    return token_info


def get_token_info_for_request(request: Request) -> dict[str, object] | None:
    session_id = get_session_id_from_request(request)
    if not session_id:
        return None

    return get_token_info_for_session(session_id)


def get_spotify_client_for_session(session_id: str) -> spotipy.Spotify:
    token_info = get_token_info_for_session(session_id)
    if not token_info:
        raise HTTPException(status_code=401, detail="No Spotify token found. Go to /login first.")

    access_token = token_info["access_token"]
    return spotipy.Spotify(auth=access_token)


def get_spotify_client(request: Request) -> spotipy.Spotify:
    session_id = get_session_id_from_request(request)
    if not session_id:
        raise HTTPException(status_code=401, detail="No active session found. Go to /login first.")

    return get_spotify_client_for_session(session_id)
