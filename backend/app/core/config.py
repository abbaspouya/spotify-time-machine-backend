import os
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv
from spotipy.oauth2 import SpotifyOAuth


BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_DIR / ".env"
CACHE_FILE = BACKEND_DIR / ".cache"

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


DEFAULT_FRONTEND_URL = "http://127.0.0.1:5173"
FRONTEND_URL = _strip_trailing_slash(os.getenv("FRONTEND_URL", DEFAULT_FRONTEND_URL))
FRONTEND_AUTH_CALLBACK_PATH = "/" + os.getenv("FRONTEND_AUTH_CALLBACK_PATH", "/auth/callback").strip("/")

_default_cors_origins = [
    _extract_origin(FRONTEND_URL),
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

CORS_ALLOW_ORIGINS = list(dict.fromkeys(_parse_csv_env("CORS_ALLOW_ORIGINS", _default_cors_origins)))

sp_oauth = SpotifyOAuth(
    client_id=SPOTIFY_CLIENT_ID,
    client_secret=SPOTIFY_CLIENT_SECRET,
    redirect_uri=SPOTIFY_REDIRECT_URI,
    cache_path=str(CACHE_FILE),
    scope=(
        "playlist-read-private playlist-read-collaborative "
        "playlist-modify-private playlist-modify-public "
        "user-library-read user-library-modify "
        "user-follow-read user-follow-modify"
    ),
)
