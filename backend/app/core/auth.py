from fastapi import HTTPException, Request
import spotipy
from spotipy.cache_handler import CacheHandler
from spotipy.oauth2 import SpotifyOAuth

from .config import SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI, SPOTIFY_SCOPE
from .session_store import (
    DEFAULT_ACCOUNT_ROLE,
    get_session_id_from_request,
    get_token_info,
    normalize_account_role as normalize_session_account_role,
    save_token_info,
    touch_session,
)


class SessionCacheHandler(CacheHandler):
    def __init__(self, session_id: str, account_role: str = DEFAULT_ACCOUNT_ROLE):
        self.session_id = session_id
        self.account_role = normalize_session_account_role(account_role)

    def get_cached_token(self):
        return get_token_info(self.session_id, self.account_role)

    def save_token_to_cache(self, token_info):
        save_token_info(self.session_id, token_info, self.account_role)

    def delete_cache(self):
        save_token_info(self.session_id, None, self.account_role)


def normalize_account_role(account_role: str | None) -> str:
    try:
        return normalize_session_account_role(account_role)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def get_oauth_for_session(session_id: str, account_role: str = DEFAULT_ACCOUNT_ROLE) -> SpotifyOAuth:
    normalized_role = normalize_account_role(account_role)
    return SpotifyOAuth(
        client_id=SPOTIFY_CLIENT_ID,
        client_secret=SPOTIFY_CLIENT_SECRET,
        redirect_uri=SPOTIFY_REDIRECT_URI,
        cache_handler=SessionCacheHandler(session_id, normalized_role),
        scope=SPOTIFY_SCOPE,
    )


def get_oauth(request: Request, account_role: str = DEFAULT_ACCOUNT_ROLE):
    session_id = get_session_id_from_request(request)
    if not session_id:
        raise HTTPException(status_code=401, detail="No active session found. Go to /login first.")
    return get_oauth_for_session(session_id, account_role)


def get_token_info_for_session(
    session_id: str,
    account_role: str = DEFAULT_ACCOUNT_ROLE,
) -> dict[str, object] | None:
    normalized_role = normalize_account_role(account_role)
    oauth = get_oauth_for_session(session_id, normalized_role)
    token_info = oauth.validate_token(oauth.cache_handler.get_cached_token())
    if not token_info:
        return None

    touch_session(session_id)
    return token_info


def get_token_info_for_request(
    request: Request,
    account_role: str = DEFAULT_ACCOUNT_ROLE,
) -> dict[str, object] | None:
    session_id = get_session_id_from_request(request)
    if not session_id:
        return None

    return get_token_info_for_session(session_id, account_role)


def get_spotify_client_for_session(
    session_id: str,
    account_role: str = DEFAULT_ACCOUNT_ROLE,
) -> spotipy.Spotify:
    normalized_role = normalize_account_role(account_role)
    token_info = get_token_info_for_session(session_id, normalized_role)
    if not token_info:
        raise HTTPException(status_code=401, detail="No Spotify token found. Go to /login first.")

    access_token = token_info["access_token"]
    return spotipy.Spotify(auth=access_token)


def get_spotify_client(
    request: Request,
    account_role: str = DEFAULT_ACCOUNT_ROLE,
) -> spotipy.Spotify:
    session_id = get_session_id_from_request(request)
    if not session_id:
        raise HTTPException(status_code=401, detail="No active session found. Go to /login first.")

    return get_spotify_client_for_session(session_id, account_role)
