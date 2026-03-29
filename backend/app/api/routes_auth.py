from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse

from ..core.auth import get_oauth_for_session, get_spotify_client
from ..core.observability import get_logger
from ..core.session_store import (
    clear_session_cookie,
    delete_session,
    ensure_session_id,
    get_session_id_from_request,
    set_session_cookie,
)
from .helpers import build_auth_status_response, build_frontend_redirect

router = APIRouter(tags=["Authentication"])
logger = get_logger("auth")


@router.get("/login", summary="Start Spotify OAuth login")
def login(
    request: Request,
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
    session_id = ensure_session_id(request)
    sp_oauth = get_oauth_for_session(session_id)
    auth_url = sp_oauth.get_authorize_url()
    if "show_dialog=" not in auth_url:
        separator = "&" if "?" in auth_url else "?"
        auth_url = f"{auth_url}{separator}show_dialog=true"

    if raw:
        response = JSONResponse({"auth_url": auth_url})
        set_session_cookie(response, session_id)
        return response

    response = RedirectResponse(url=auth_url)
    set_session_cookie(response, session_id)
    return response


@router.get("/callback", summary="Handle Spotify OAuth callback", include_in_schema=False)
def callback(request: Request):
    session_id = get_session_id_from_request(request) or ensure_session_id(request)
    sp_oauth = get_oauth_for_session(session_id)
    error = request.query_params.get("error")
    code = request.query_params.get("code")

    if error:
        response = RedirectResponse(url=build_frontend_redirect("error", error), status_code=303)
        set_session_cookie(response, session_id)
        return response

    if not code:
        response = RedirectResponse(
            url=build_frontend_redirect("error", "No code provided in callback"),
            status_code=303,
        )
        set_session_cookie(response, session_id)
        return response

    try:
        token_info = sp_oauth.get_access_token(code, as_dict=True)
        if isinstance(token_info, dict):
            sp_oauth.cache_handler.save_token_to_cache(token_info)
    except Exception:
        logger.exception("spotify_oauth_callback_failed")
        response = RedirectResponse(
            url=build_frontend_redirect("error", "Authorization failed. Please try again."),
            status_code=303,
        )
        set_session_cookie(response, session_id)
        return response

    response = RedirectResponse(url=build_frontend_redirect("success"), status_code=303)
    set_session_cookie(response, session_id)
    return response


@router.get("/auth_status", summary="Check current auth state")
def auth_status(request: Request):
    return build_auth_status_response(request)


@router.post("/logout", summary="Clear current Spotify session")
def logout(request: Request):
    session_id = get_session_id_from_request(request)
    if session_id:
        delete_session(session_id)

    response = JSONResponse({"authenticated": False})
    clear_session_cookie(response)
    return response


@router.get("/get_token", deprecated=True, summary="Check auth state (legacy)", include_in_schema=False)
def get_token(request: Request):
    # Legacy route kept for compatibility, but do not expose tokens to the browser.
    return build_auth_status_response(request)


@router.get("/whoami", summary="Get current Spotify profile")
def whoami(request: Request):
    sp = get_spotify_client(request)
    me = sp.current_user()

    return {
        "id": me.get("id"),
        "display_name": me.get("display_name"),
        "email": me.get("email"),
        "country": me.get("country"),
        "product": me.get("product"),
        "image_url": me.get("images", [{}])[0].get("url") if me.get("images") else None,
        "profile_url": me.get("external_urls", {}).get("spotify"),
    }
