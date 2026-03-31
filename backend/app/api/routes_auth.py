import secrets
from urllib.parse import urlsplit

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse

from ..core.auth import DEFAULT_ACCOUNT_ROLE, get_oauth_for_session, get_spotify_client, normalize_account_role
from ..core.config import CORS_ALLOW_ORIGINS
from ..core.observability import get_logger
from ..core.session_store import (
    clear_session_cookie,
    delete_session,
    ensure_session_id,
    find_session_id_by_pending_auth_state,
    get_session_id_from_request,
    has_any_token_info,
    pop_pending_auth,
    save_token_info,
    set_pending_auth,
    set_session_cookie,
)
from ..schemas.auth import AuthStatusResponse, WhoAmIResponse
from .helpers import build_auth_status_response, build_frontend_redirect

router = APIRouter(tags=["Authentication"])
logger = get_logger("auth")


def _sanitize_return_to(value: str | None) -> str | None:
    if not value:
        return None

    candidate = value.strip()
    if not candidate or not candidate.startswith("/") or candidate.startswith("//"):
        return None

    return candidate


def _extract_origin(value: str | None) -> str | None:
    if not value:
        return None

    parsed = urlsplit(value.strip())
    if not parsed.scheme or not parsed.netloc:
        return None

    return f"{parsed.scheme}://{parsed.netloc}"


def _resolve_frontend_origin(request: Request) -> str | None:
    for header_name in ("origin", "referer"):
        origin = _extract_origin(request.headers.get(header_name))
        if origin and origin in CORS_ALLOW_ORIGINS:
            return origin

    return None


@router.get("/login", summary="Start Spotify OAuth login")
def login(
    request: Request,
    account_role: str = Query(DEFAULT_ACCOUNT_ROLE, description="Spotify account slot: source or target."),
    return_to: str | None = Query(
        None,
        description="Frontend path to return to after Spotify auth, for example /app/transfer-library",
    ),
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
    normalized_role = normalize_account_role(account_role)
    safe_return_to = _sanitize_return_to(return_to)
    session_id = ensure_session_id(request)
    auth_state = secrets.token_urlsafe(24)
    set_pending_auth(
        session_id,
        normalized_role,
        safe_return_to,
        frontend_origin=_resolve_frontend_origin(request),
        auth_state=auth_state,
    )
    sp_oauth = get_oauth_for_session(session_id, normalized_role)
    auth_url = sp_oauth.get_authorize_url(state=auth_state)
    if "show_dialog=" not in auth_url:
        separator = "&" if "?" in auth_url else "?"
        auth_url = f"{auth_url}{separator}show_dialog=true"

    if raw:
        response = JSONResponse({"auth_url": auth_url, "account_role": normalized_role})
        set_session_cookie(response, session_id)
        return response

    response = RedirectResponse(url=auth_url)
    set_session_cookie(response, session_id)
    return response


@router.get("/callback", summary="Handle Spotify OAuth callback", include_in_schema=False)
def callback(request: Request):
    state = request.query_params.get("state")
    session_id = find_session_id_by_pending_auth_state(state) or get_session_id_from_request(request) or ensure_session_id(request)
    pending_auth = pop_pending_auth(session_id) or {}
    pending_role = pending_auth.get("account_role") if isinstance(pending_auth.get("account_role"), str) else None
    account_role = normalize_account_role(pending_role or DEFAULT_ACCOUNT_ROLE)
    return_to = _sanitize_return_to(
        pending_auth.get("return_to") if isinstance(pending_auth.get("return_to"), str) else None
    )
    frontend_origin = _extract_origin(
        pending_auth.get("frontend_origin") if isinstance(pending_auth.get("frontend_origin"), str) else None
    )
    sp_oauth = get_oauth_for_session(session_id, account_role)
    error = request.query_params.get("error")
    code = request.query_params.get("code")

    if error:
        response = RedirectResponse(
            url=build_frontend_redirect(
                "error",
                error,
                account_role=account_role,
                return_to=return_to,
                frontend_origin=frontend_origin,
            ),
            status_code=303,
        )
        set_session_cookie(response, session_id)
        return response

    if not code:
        response = RedirectResponse(
            url=build_frontend_redirect(
                "error",
                "No code provided in callback",
                account_role=account_role,
                return_to=return_to,
                frontend_origin=frontend_origin,
            ),
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
            url=build_frontend_redirect(
                "error",
                "Authorization failed. Please try again.",
                account_role=account_role,
                return_to=return_to,
                frontend_origin=frontend_origin,
            ),
            status_code=303,
        )
        set_session_cookie(response, session_id)
        return response

    response = RedirectResponse(
        url=build_frontend_redirect(
            "success",
            account_role=account_role,
            return_to=return_to,
            frontend_origin=frontend_origin,
        ),
        status_code=303,
    )
    set_session_cookie(response, session_id)
    return response


@router.get(
    "/auth_status",
    response_model=AuthStatusResponse,
    response_model_exclude_none=True,
    summary="Check current auth state",
)
def auth_status(
    request: Request,
    account_role: str = Query(DEFAULT_ACCOUNT_ROLE, description="Spotify account slot: source or target."),
):
    return build_auth_status_response(request, normalize_account_role(account_role))


@router.post("/logout", summary="Clear current Spotify session")
def logout(
    request: Request,
    account_role: str = Query(DEFAULT_ACCOUNT_ROLE, description="Spotify account slot: source or target."),
):
    normalized_role = normalize_account_role(account_role)
    session_id = get_session_id_from_request(request)
    if session_id:
        save_token_info(session_id, None, normalized_role)

    response = JSONResponse({"authenticated": False})
    if session_id and has_any_token_info(session_id):
        set_session_cookie(response, session_id)
    else:
        if session_id:
            delete_session(session_id)
        clear_session_cookie(response)
    return response


@router.get(
    "/get_token",
    response_model=AuthStatusResponse,
    response_model_exclude_none=True,
    deprecated=True,
    summary="Check auth state (legacy)",
    include_in_schema=False,
)
def get_token(
    request: Request,
    account_role: str = Query(DEFAULT_ACCOUNT_ROLE, description="Spotify account slot: source or target."),
):
    # Legacy route kept for compatibility, but do not expose tokens to the browser.
    return build_auth_status_response(request, normalize_account_role(account_role))


@router.get(
    "/whoami",
    response_model=WhoAmIResponse,
    response_model_exclude_none=True,
    summary="Get current Spotify profile",
)
def whoami(
    request: Request,
    account_role: str = Query(DEFAULT_ACCOUNT_ROLE, description="Spotify account slot: source or target."),
):
    normalized_role = normalize_account_role(account_role)
    logger.info(
        "spotify_profile_fetch_started",
        extra={"method": request.method, "path": request.url.path, "account_role": normalized_role},
    )
    sp = get_spotify_client(request, normalized_role)
    me = sp.current_user()
    logger.info(
        "spotify_profile_fetch_completed",
        extra={"method": request.method, "path": request.url.path, "account_role": normalized_role},
    )

    return {
        "id": me.get("id"),
        "display_name": me.get("display_name"),
        "email": me.get("email"),
        "country": me.get("country"),
        "product": me.get("product"),
        "image_url": me.get("images", [{}])[0].get("url") if me.get("images") else None,
        "profile_url": me.get("external_urls", {}).get("spotify"),
    }
