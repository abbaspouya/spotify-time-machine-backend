from __future__ import annotations

from datetime import datetime, timedelta, timezone
from threading import Lock, Thread
from typing import Any, Callable
import secrets

from fastapi import HTTPException

from .config import JOB_RETENTION_SECONDS
from .observability import get_logger


JobWorker = Callable[[Callable[[int | None, str], None]], Any]
_JOB_LOCK = Lock()
_JOBS: dict[str, dict[str, Any]] = {}
logger = get_logger("jobs")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _utc_now_iso() -> str:
    return _utc_now().isoformat().replace("+00:00", "Z")


def _serialize_job(job: dict[str, Any]) -> dict[str, Any]:
    return {
        "job_id": job["job_id"],
        "kind": job["kind"],
        "status": job["status"],
        "progress": job["progress"],
        "message": job["message"],
        "error": job["error"],
        "created_at": job["created_at"],
        "updated_at": job["updated_at"],
        "finished_at": job["finished_at"],
        "result": job["result"] if job["status"] == "completed" else None,
    }


def _cleanup_jobs() -> None:
    cutoff = _utc_now() - timedelta(seconds=JOB_RETENTION_SECONDS)
    with _JOB_LOCK:
        expired_job_ids = [
            job_id
            for job_id, job in _JOBS.items()
            if job["status"] in {"completed", "failed"} and datetime.fromisoformat(job["updated_at"].replace("Z", "+00:00")) < cutoff
        ]
        for job_id in expired_job_ids:
            _JOBS.pop(job_id, None)


def _update_job(job_id: str, **changes: Any) -> None:
    with _JOB_LOCK:
        job = _JOBS.get(job_id)
        if job is None:
            return

        job.update(changes)
        job["updated_at"] = _utc_now_iso()


def _run_job(job_id: str, worker: JobWorker) -> None:
    _update_job(job_id, status="running", message="Job started")
    logger.info("job_started", extra={"job_id": job_id, "job_kind": _JOBS.get(job_id, {}).get("kind")})

    def progress(progress_value: int | None, message: str) -> None:
        _update_job(job_id, progress=progress_value, message=message)

    try:
        result = worker(progress)
    except HTTPException as exc:
        _update_job(
            job_id,
            status="failed",
            error=str(exc.detail),
            message="Job failed",
            finished_at=_utc_now_iso(),
        )
        logger.warning(
            "job_failed",
            extra={"job_id": job_id, "job_kind": _JOBS.get(job_id, {}).get("kind")},
        )
        return
    except Exception as exc:
        _update_job(
            job_id,
            status="failed",
            error=str(exc) or exc.__class__.__name__,
            message="Job failed",
            finished_at=_utc_now_iso(),
        )
        logger.exception(
            "job_failed",
            extra={"job_id": job_id, "job_kind": _JOBS.get(job_id, {}).get("kind")},
        )
        return

    _update_job(
        job_id,
        status="completed",
        progress=100,
        message="Job completed",
        result=result,
        finished_at=_utc_now_iso(),
    )
    logger.info("job_completed", extra={"job_id": job_id, "job_kind": _JOBS.get(job_id, {}).get("kind")})


def create_job(kind: str, session_id: str, worker: JobWorker) -> dict[str, Any]:
    _cleanup_jobs()
    job_id = secrets.token_urlsafe(16)
    now = _utc_now_iso()
    job = {
        "job_id": job_id,
        "kind": kind,
        "session_id": session_id,
        "status": "queued",
        "progress": 0,
        "message": "Job queued",
        "error": None,
        "created_at": now,
        "updated_at": now,
        "finished_at": None,
        "result": None,
    }

    with _JOB_LOCK:
        _JOBS[job_id] = job

    Thread(target=_run_job, args=(job_id, worker), daemon=True).start()
    return _serialize_job(job)


def get_job(job_id: str, session_id: str) -> dict[str, Any] | None:
    _cleanup_jobs()
    with _JOB_LOCK:
        job = _JOBS.get(job_id)
        if job is None or job.get("session_id") != session_id:
            return None

        return _serialize_job(job)
