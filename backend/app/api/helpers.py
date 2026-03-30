from urllib.parse import urlencode

from fastapi import Request

from ..core.auth import get_token_info_for_request
from ..core.config import FRONTEND_AUTH_CALLBACK_PATH, FRONTEND_URL


def build_frontend_redirect(
    status: str,
    detail: str | None = None,
    account_role: str | None = None,
    return_to: str | None = None,
) -> str:
    target = f"{FRONTEND_URL}{FRONTEND_AUTH_CALLBACK_PATH}"
    params = {"status": status}
    if detail:
        params["detail"] = detail
    if account_role:
        params["account_role"] = account_role
    if return_to:
        params["return_to"] = return_to
    return f"{target}?{urlencode(params)}"


def build_auth_status_response(request: Request, account_role: str) -> dict[str, object]:
    token = get_token_info_for_request(request, account_role)
    if not token:
        return {"authenticated": False}

    return {
        "authenticated": True,
        "expires_at": token.get("expires_at"),
        "scope": token.get("scope"),
        "token_type": token.get("token_type"),
    }
