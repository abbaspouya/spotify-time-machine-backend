from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.docs import API_TAGS
from .api.routes_spotify import router as spotify_router
from .core.config import CORS_ALLOW_ORIGINS

app = FastAPI(
    title="Spotify API",
    openapi_tags=API_TAGS,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all Spotify-related endpoints at root ("/")
app.include_router(spotify_router)
