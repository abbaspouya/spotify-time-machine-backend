from __future__ import annotations

from contextvars import ContextVar, Token
from typing import Any
import json
import logging

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from requests.exceptions import RequestException, Timeout
from spotipy.exceptions import SpotifyException

from .config import LOG_LEVEL

_REQUEST_ID: ContextVar[str] = ContextVar("request_id", default="-")
_LOGGER_PREFIX = "spotify"


class JsonLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", get_request_id()),
        }

        for key in ("method", "path", "status_code", "duration_ms", "job_id", "job_kind", "account_role", "timeframe", "days", "limit"):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=True)


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id()
        return True


def configure_logging() -> None:
    logger = logging.getLogger(_LOGGER_PREFIX)
    if logger.handlers:
        return

    handler = logging.StreamHandler()
    handler.setFormatter(JsonLogFormatter())
    handler.addFilter(RequestIdFilter())

    logger.addHandler(handler)
    logger.setLevel(LOG_LEVEL)
    logger.propagate = False


def get_logger(name: str) -> logging.Logger:
    configure_logging()
    qualified_name = name if name.startswith(f"{_LOGGER_PREFIX}.") else f"{_LOGGER_PREFIX}.{name}"
    logger = logging.getLogger(qualified_name)
    logger.setLevel(logging.getLogger(_LOGGER_PREFIX).level)
    return logger


def set_request_id(request_id: str) -> Token[str]:
    return _REQUEST_ID.set(request_id)


def reset_request_id(token: Token[str]) -> None:
    _REQUEST_ID.reset(token)


def get_request_id() -> str:
    return _REQUEST_ID.get()


def _error_body(detail: str) -> dict[str, str]:
    return {
        "detail": detail,
        "request_id": get_request_id(),
    }


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    logger = get_logger("http")
    log_method = logger.warning if exc.status_code >= 500 else logger.info
    log_method(
        "http_exception",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": exc.status_code,
        },
    )

    response = JSONResponse(status_code=exc.status_code, content=_error_body(str(exc.detail)))
    response.headers["X-Request-ID"] = get_request_id()
    return response


async def spotify_exception_handler(request: Request, exc: SpotifyException) -> JSONResponse:
    status_code = getattr(exc, "http_status", None) or 502
    retry_after = None
    if status_code == 429:
        headers = getattr(exc, "headers", {}) or {}
        retry_after = headers.get("Retry-After") or headers.get("retry-after")

    logger = get_logger("spotify_api")
    logger.warning(
        "spotify_api_error",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": status_code,
        },
        exc_info=exc,
    )

    detail = "Spotify request failed. Refresh your connection and try again."
    if status_code == 429:
        detail = "Spotify is rate-limiting requests right now. Wait a moment and try again."
        if retry_after:
            detail = f"Spotify is rate-limiting requests right now. Try again in about {retry_after} seconds."

    response = JSONResponse(
        status_code=status_code,
        content=_error_body(detail),
    )
    if retry_after:
        response.headers["Retry-After"] = str(retry_after)
    response.headers["X-Request-ID"] = get_request_id()
    return response


async def spotify_network_exception_handler(request: Request, exc: RequestException) -> JSONResponse:
    status_code = 504 if isinstance(exc, Timeout) else 502
    detail = (
        "Spotify did not respond in time. Refresh your connection and try again."
        if isinstance(exc, Timeout)
        else "Spotify could not be reached. Try again in a moment."
    )
    logger = get_logger("spotify_api")
    logger.warning(
        "spotify_network_error",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": status_code,
        },
        exc_info=exc,
    )

    response = JSONResponse(
        status_code=status_code,
        content=_error_body(detail),
    )
    response.headers["X-Request-ID"] = get_request_id()
    return response


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger = get_logger("http")
    logger.exception(
        "unhandled_exception",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": 500,
        },
    )

    response = JSONResponse(
        status_code=500,
        content=_error_body("Unexpected server error. Try again later."),
    )
    response.headers["X-Request-ID"] = get_request_id()
    return response
