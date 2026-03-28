from urllib.parse import urlencode

from fastapi import Request

from ..core.auth import get_token_info_for_request
from ..core.config import FRONTEND_AUTH_CALLBACK_PATH, FRONTEND_URL


def build_frontend_redirect(status: str, detail: str | None = None) -> str:
    target = f"{FRONTEND_URL}{FRONTEND_AUTH_CALLBACK_PATH}"
    params = {"status": status}
    if detail:
        params["detail"] = detail
    return f"{target}?{urlencode(params)}"


def build_auth_status_response(request: Request) -> dict[str, object]:
    token = get_token_info_for_request(request)
    if not token:
        return {"authenticated": False}

    return {
        "authenticated": True,
        "expires_at": token.get("expires_at"),
        "scope": token.get("scope"),
        "token_type": token.get("token_type"),
    }
