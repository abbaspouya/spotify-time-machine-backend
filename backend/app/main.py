from fastapi import FastAPI
from .api.routes_spotify import router as spotify_router

app = FastAPI()

# Mount all Spotify-related endpoints at root ("/")
app.include_router(spotify_router)
