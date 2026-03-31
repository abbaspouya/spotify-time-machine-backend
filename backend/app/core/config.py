import os
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_DIR / ".env"
SESSION_DIR = BACKEND_DIR / ".sessions"

# Load environment variables from backend/.env regardless of the launch directory.
load_dotenv(dotenv_path=ENV_FILE)

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
SPOTIFY_REDIRECT_URI = os.getenv("SPOTIFY_REDIRECT_URI")

if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET or not SPOTIFY_REDIRECT_URI:
    raise RuntimeError("Spotify env variables are missing. Check your .env file.")


def _strip_trailing_slash(value: str) -> str:
    return value.rstrip("/")


def _extract_origin(url: str) -> str:
    parsed = urlsplit(url)
    if not parsed.scheme or not parsed.netloc:
        raise RuntimeError("FRONTEND_URL must include a scheme and host, for example http://127.0.0.1:5173")
    return f"{parsed.scheme}://{parsed.netloc}"


def _validate_absolute_url(name: str, url: str) -> None:
    parsed = urlsplit(url)
    if not parsed.scheme or not parsed.netloc:
        raise RuntimeError(f"{name} must include a scheme and host, for example http://127.0.0.1:8000/callback")


_validate_absolute_url("SPOTIFY_REDIRECT_URI", SPOTIFY_REDIRECT_URI)


def _parse_csv_env(name: str, defaults: list[str]) -> list[str]:
    raw_value = os.getenv(name, "")
    if not raw_value.strip():
        return defaults

    values = [value.strip().rstrip("/") for value in raw_value.split(",") if value.strip()]
    return values or defaults


def _parse_bool_env(name: str, default: bool) -> bool:
    raw_value = os.getenv(name, "")
    if not raw_value.strip():
        return default

    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_float_env(name: str, default: float) -> float:
    raw_value = os.getenv(name, "")
    if not raw_value.strip():
        return default

    try:
        return float(raw_value.strip())
    except ValueError as exc:
        raise RuntimeError(f"{name} must be a number.") from exc


DEFAULT_FRONTEND_URL = "http://127.0.0.1:5173"
FRONTEND_URL = _strip_trailing_slash(os.getenv("FRONTEND_URL", DEFAULT_FRONTEND_URL))
FRONTEND_AUTH_CALLBACK_PATH = "/" + os.getenv("FRONTEND_AUTH_CALLBACK_PATH", "/auth/callback").strip("/")

_default_cors_origins = [
    _extract_origin(FRONTEND_URL),
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

CORS_ALLOW_ORIGINS = list(dict.fromkeys(_parse_csv_env("CORS_ALLOW_ORIGINS", _default_cors_origins)))
SPOTIFY_SCOPE = (
    "playlist-read-private playlist-read-collaborative "
    "playlist-modify-private playlist-modify-public "
    "user-read-private user-read-email "
    "user-library-read user-library-modify "
    "user-follow-read user-follow-modify "
    "user-top-read user-read-recently-played"
)

SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "spotify_time_machine_session")
SESSION_COOKIE_DOMAIN = os.getenv("SESSION_COOKIE_DOMAIN") or None
SESSION_COOKIE_SECURE = _parse_bool_env("SESSION_COOKIE_SECURE", False)
SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "lax").strip().lower() or "lax"
SESSION_COOKIE_MAX_AGE_SECONDS = int(os.getenv("SESSION_COOKIE_MAX_AGE_SECONDS", "2592000"))
JOB_RETENTION_SECONDS = int(os.getenv("JOB_RETENTION_SECONDS", "21600"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").strip().upper() or "INFO"
SPOTIFY_REQUEST_TIMEOUT_SECONDS = _parse_float_env("SPOTIFY_REQUEST_TIMEOUT_SECONDS", 5.0)

if SESSION_COOKIE_SAMESITE not in {"lax", "strict", "none"}:
    raise RuntimeError("SESSION_COOKIE_SAMESITE must be one of: lax, strict, none.")

if SESSION_COOKIE_SAMESITE == "none" and not SESSION_COOKIE_SECURE:
    raise RuntimeError("SESSION_COOKIE_SECURE must be true when SESSION_COOKIE_SAMESITE is 'none'.")

if SESSION_COOKIE_MAX_AGE_SECONDS <= 0:
    raise RuntimeError("SESSION_COOKIE_MAX_AGE_SECONDS must be greater than zero.")

if JOB_RETENTION_SECONDS <= 0:
    raise RuntimeError("JOB_RETENTION_SECONDS must be greater than zero.")

if SPOTIFY_REQUEST_TIMEOUT_SECONDS <= 0:
    raise RuntimeError("SPOTIFY_REQUEST_TIMEOUT_SECONDS must be greater than zero.")
