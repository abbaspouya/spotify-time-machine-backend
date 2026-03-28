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
    "user-library-read user-library-modify "
    "user-follow-read user-follow-modify"
)

SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "spotify_time_machine_session")
SESSION_COOKIE_DOMAIN = os.getenv("SESSION_COOKIE_DOMAIN") or None
SESSION_COOKIE_SECURE = _parse_bool_env("SESSION_COOKIE_SECURE", False)
SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "lax").strip().lower() or "lax"
SESSION_COOKIE_MAX_AGE_SECONDS = int(os.getenv("SESSION_COOKIE_MAX_AGE_SECONDS", "2592000"))
JOB_RETENTION_SECONDS = int(os.getenv("JOB_RETENTION_SECONDS", "21600"))
