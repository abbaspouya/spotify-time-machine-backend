from fastapi import APIRouter, Query, Request
from fastapi.responses import RedirectResponse

from ..core.auth import get_oauth, get_spotify_client
from .helpers import build_auth_status_response, build_frontend_redirect

router = APIRouter(tags=["Authentication"])


@router.get("/login", summary="Start Spotify OAuth login")
def login(
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
    sp_oauth = get_oauth()
    auth_url = sp_oauth.get_authorize_url()
    if "show_dialog=" not in auth_url:
        separator = "&" if "?" in auth_url else "?"
        auth_url = f"{auth_url}{separator}show_dialog=true"

    if raw:
        return {"auth_url": auth_url}

    return RedirectResponse(url=auth_url)


@router.get("/callback", summary="Handle Spotify OAuth callback")
def callback(request: Request):
    sp_oauth = get_oauth()
    error = request.query_params.get("error")
    code = request.query_params.get("code")

    if error:
        return RedirectResponse(url=build_frontend_redirect("error", error), status_code=303)

    if not code:
        return RedirectResponse(
            url=build_frontend_redirect("error", "No code provided in callback"),
            status_code=303,
        )

    try:
        sp_oauth.get_access_token(code, as_dict=True)
    except Exception as exc:
        return RedirectResponse(
            url=build_frontend_redirect("error", f"Authorization failed: {exc}"),
            status_code=303,
        )

    return RedirectResponse(url=build_frontend_redirect("success"), status_code=303)


@router.get("/auth_status", summary="Check current auth state")
def auth_status():
    return build_auth_status_response()


@router.get("/get_token", deprecated=True, summary="Check auth state (legacy)")
def get_token():
    # Legacy route kept for compatibility, but do not expose tokens to the browser.
    return build_auth_status_response()


@router.get("/whoami", summary="Get current Spotify profile")
def whoami():
    sp = get_spotify_client()
    me = sp.current_user()

    return {
        "id": me.get("id"),
        "display_name": me.get("display_name"),
        "email": me.get("email"),
        "country": me.get("country"),
        "product": me.get("product"),
        "profile_url": me.get("external_urls", {}).get("spotify"),
    }
