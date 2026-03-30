from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Lock
from typing import Any
import json
import re
import secrets

from fastapi import Request, Response

from .config import (
    SESSION_COOKIE_DOMAIN,
    SESSION_COOKIE_MAX_AGE_SECONDS,
    SESSION_COOKIE_NAME,
    SESSION_COOKIE_SAMESITE,
    SESSION_COOKIE_SECURE,
    SESSION_DIR,
)


_SESSION_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{20,}$")
_SESSION_LOCK = Lock()
ACCOUNT_ROLES = ("source", "target")
DEFAULT_ACCOUNT_ROLE = "source"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _utc_now_iso() -> str:
    return _utc_now().isoformat().replace("+00:00", "Z")


def _session_file_path(session_id: str) -> Path:
    return SESSION_DIR / f"{session_id}.json"


def _is_valid_session_id(session_id: str | None) -> bool:
    return bool(session_id and _SESSION_ID_PATTERN.fullmatch(session_id))


def _ensure_session_dir() -> None:
    SESSION_DIR.mkdir(parents=True, exist_ok=True)


def normalize_account_role(account_role: str | None) -> str:
    normalized = (account_role or DEFAULT_ACCOUNT_ROLE).strip().lower()
    if normalized not in ACCOUNT_ROLES:
        allowed = ", ".join(ACCOUNT_ROLES)
        raise ValueError(f"Unsupported account role '{account_role}'. Use one of: {allowed}.")
    return normalized


def _write_session_file(path: Path, data: dict[str, Any]) -> None:
    temp_path = path.with_suffix(".tmp")
    temp_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    temp_path.replace(path)


def _load_session_data(session_id: str) -> dict[str, Any] | None:
    if not _is_valid_session_id(session_id):
        return None

    path = _session_file_path(session_id)
    if not path.exists():
        return None

    try:
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw)
    except (OSError, json.JSONDecodeError):
        return None

    if not isinstance(data, dict):
        return None

    return data


def _save_session_data(session_id: str, data: dict[str, Any]) -> None:
    if not _is_valid_session_id(session_id):
        raise ValueError("Invalid session id.")

    _ensure_session_dir()
    data["updated_at"] = _utc_now_iso()
    with _SESSION_LOCK:
        _write_session_file(_session_file_path(session_id), data)


def _parse_session_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None

    try:
        raw = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)


def cleanup_expired_sessions() -> None:
    _ensure_session_dir()
    expiration_cutoff = _utc_now() - timedelta(seconds=SESSION_COOKIE_MAX_AGE_SECONDS)

    with _SESSION_LOCK:
        for path in SESSION_DIR.glob("*.json"):
            try:
                raw = path.read_text(encoding="utf-8")
                data = json.loads(raw)
            except (OSError, json.JSONDecodeError):
                path.unlink(missing_ok=True)
                continue

            updated_at = _parse_session_timestamp(data.get("updated_at") if isinstance(data, dict) else None)
            if updated_at is None or updated_at < expiration_cutoff:
                path.unlink(missing_ok=True)


def create_session() -> str:
    cleanup_expired_sessions()
    session_id = secrets.token_urlsafe(32)
    now = _utc_now_iso()
    data = {
        "created_at": now,
        "updated_at": now,
        "account_tokens": {},
    }
    _save_session_data(session_id, data)
    return session_id


def get_session_id_from_request(request: Request) -> str | None:
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if not _is_valid_session_id(session_id):
        return None
    return session_id


def ensure_session_id(request: Request) -> str:
    existing_session_id = get_session_id_from_request(request)
    if existing_session_id:
        touch_session(existing_session_id)
        return existing_session_id

    return create_session()


def touch_session(session_id: str) -> None:
    data = _load_session_data(session_id)
    if data is None:
        return

    _save_session_data(session_id, data)


def _get_account_tokens(data: dict[str, Any]) -> dict[str, Any]:
    account_tokens = data.get("account_tokens")
    if isinstance(account_tokens, dict):
        return account_tokens

    legacy_token = data.get("token_info")
    if isinstance(legacy_token, dict):
        return {DEFAULT_ACCOUNT_ROLE: legacy_token}

    return {}


def _ensure_account_tokens(data: dict[str, Any]) -> dict[str, Any]:
    account_tokens = _get_account_tokens(data)
    data["account_tokens"] = account_tokens
    data.pop("token_info", None)
    return account_tokens


def get_token_info(session_id: str, account_role: str = DEFAULT_ACCOUNT_ROLE) -> dict[str, Any] | None:
    cleanup_expired_sessions()
    data = _load_session_data(session_id)
    if data is None:
        return None

    normalized_role = normalize_account_role(account_role)
    token_info = _get_account_tokens(data).get(normalized_role)
    return token_info if isinstance(token_info, dict) else None


def save_token_info(
    session_id: str,
    token_info: dict[str, Any] | None,
    account_role: str = DEFAULT_ACCOUNT_ROLE,
) -> None:
    data = _load_session_data(session_id) or {
        "created_at": _utc_now_iso(),
    }
    normalized_role = normalize_account_role(account_role)
    account_tokens = _ensure_account_tokens(data)
    account_tokens[normalized_role] = token_info
    _save_session_data(session_id, data)


def has_any_token_info(session_id: str) -> bool:
    cleanup_expired_sessions()
    data = _load_session_data(session_id)
    if data is None:
        return False

    return any(isinstance(token_info, dict) and token_info for token_info in _get_account_tokens(data).values())


def set_pending_auth(session_id: str, account_role: str, return_to: str | None = None) -> None:
    data = _load_session_data(session_id) or {
        "created_at": _utc_now_iso(),
    }
    data["pending_auth"] = {
        "account_role": normalize_account_role(account_role),
        "return_to": return_to,
    }
    _save_session_data(session_id, data)


def pop_pending_auth(session_id: str) -> dict[str, Any] | None:
    data = _load_session_data(session_id)
    if data is None:
        return None

    pending_auth = data.pop("pending_auth", None)
    _save_session_data(session_id, data)
    return pending_auth if isinstance(pending_auth, dict) else None


def delete_session(session_id: str) -> None:
    if not _is_valid_session_id(session_id):
        return

    with _SESSION_LOCK:
        _session_file_path(session_id).unlink(missing_ok=True)


def set_session_cookie(response: Response, session_id: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_id,
        max_age=SESSION_COOKIE_MAX_AGE_SECONDS,
        httponly=True,
        secure=SESSION_COOKIE_SECURE,
        samesite=SESSION_COOKIE_SAMESITE,
        path="/",
        domain=SESSION_COOKIE_DOMAIN,
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        domain=SESSION_COOKIE_DOMAIN,
        secure=SESSION_COOKIE_SECURE,
        samesite=SESSION_COOKIE_SAMESITE,
    )
