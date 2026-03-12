import os
from pathlib import Path

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
