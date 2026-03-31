from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from spotipy.exceptions import SpotifyException

from .api.docs import API_TAGS
from .api.routes_spotify import router as spotify_router
from .core.config import CORS_ALLOW_ORIGINS
from .core.observability import (
    get_logger,
    http_exception_handler,
    reset_request_id,
    set_request_id,
    spotify_network_exception_handler,
    spotify_exception_handler,
    unhandled_exception_handler,
)
from requests.exceptions import RequestException

app = FastAPI(
    title="Spotify API",
    openapi_tags=API_TAGS,
)
logger = get_logger("http")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or uuid4().hex
    request.state.request_id = request_id
    token = set_request_id(request_id)
    start = perf_counter()

    try:
        response = await call_next(request)
    finally:
        duration_ms = round((perf_counter() - start) * 1000, 2)
        logger.info(
            "request_completed",
            extra={
                "method": request.method,
                "path": request.url.path,
                "duration_ms": duration_ms,
                "status_code": getattr(locals().get("response"), "status_code", 500),
            },
        )
        reset_request_id(token)

    response.headers["X-Request-ID"] = request_id
    return response


app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(SpotifyException, spotify_exception_handler)
app.add_exception_handler(RequestException, spotify_network_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

# Mount all Spotify-related endpoints at root ("/")
app.include_router(spotify_router)
