from fastapi import APIRouter, HTTPException, Query, Request
from spotipy.exceptions import SpotifyException

from ..core.auth import DEFAULT_ACCOUNT_ROLE, get_spotify_client_for_session, normalize_account_role
from ..core.jobs import create_job, get_job
from ..core.session_store import get_session_id_from_request
from ..schemas.account_snapshot import ExportAccountSnapshotRequest, ImportAccountSnapshotRequest
from ..schemas.job import GroupSongsJobRequest
from ..services.account_snapshot import (
    export_account_snapshot,
    import_account_snapshot,
    load_snapshot_from_file,
    write_snapshot_to_file,
)
from ..services.spotify_time_machine import (
    fetch_all_liked_songs,
    group_songs_by_language,
    group_songs_by_period,
)

router = APIRouter(tags=["Jobs"])


def _require_session_id(request: Request) -> str:
    session_id = get_session_id_from_request(request)
    if not session_id:
        raise HTTPException(status_code=401, detail="No active session found. Go to /login first.")
    return session_id


def _load_snapshot_from_payload(payload: ImportAccountSnapshotRequest) -> dict:
    if not payload.file_path and payload.snapshot is None:
        raise HTTPException(
            status_code=400,
            detail="Provide either 'file_path' or 'snapshot' in the request body.",
        )

    if payload.file_path and payload.snapshot is not None:
        raise HTTPException(
            status_code=400,
            detail="Provide only one source: either 'file_path' or 'snapshot'.",
        )

    if payload.snapshot is not None and not isinstance(payload.snapshot, dict):
        raise HTTPException(status_code=400, detail="'snapshot' must be a JSON object.")

    try:
        return payload.snapshot or load_snapshot_from_file(payload.file_path or "")
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


def _spotify_error_message(exc: SpotifyException) -> str:
    status = getattr(exc, "http_status", None) or 502
    message = getattr(exc, "msg", str(exc))
    return f"Spotify API error ({status}): {message}"


@router.get("/jobs/{job_id}", summary="Get async job status")
def get_job_status(job_id: str, request: Request):
    session_id = _require_session_id(request)
    job = get_job(job_id, session_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


@router.post("/jobs/fetch_and_group", summary="Start grouped songs job")
def start_fetch_and_group_job(
    request: Request,
    payload: GroupSongsJobRequest,
    account_role: str = Query(DEFAULT_ACCOUNT_ROLE, description="Spotify account slot: source or target."),
):
    session_id = _require_session_id(request)
    normalized_role = normalize_account_role(account_role)

    def worker(progress):
        try:
            progress(10, "Loading liked songs from Spotify")
            sp = get_spotify_client_for_session(session_id, normalized_role)
            songs = fetch_all_liked_songs(sp)
            progress(80, f"Grouping {len(songs)} liked songs by time period")
            groups = group_songs_by_period(
                songs,
                period_type=payload.period,
                start_year=payload.start_year,
                end_year=payload.end_year,
                order=payload.order,
            )
        except SpotifyException as exc:
            raise RuntimeError(_spotify_error_message(exc)) from exc

        return {
            "groups": groups,
            "total_songs": len(songs),
        }

    return create_job("fetch_and_group", session_id, worker)


@router.post("/jobs/group_by_language", summary="Start language grouping job (beta)")
def start_group_by_language_job(
    request: Request,
    account_role: str = Query(DEFAULT_ACCOUNT_ROLE, description="Spotify account slot: source or target."),
):
    session_id = _require_session_id(request)
    normalized_role = normalize_account_role(account_role)

    def worker(progress):
        try:
            progress(10, "Loading liked songs from Spotify")
            sp = get_spotify_client_for_session(session_id, normalized_role)
            songs = fetch_all_liked_songs(sp)
            progress(75, f"Detecting languages across {len(songs)} liked songs")
            groups = group_songs_by_language(songs)
        except SpotifyException as exc:
            raise RuntimeError(_spotify_error_message(exc)) from exc

        return {"groups": groups}

    return create_job("group_by_language", session_id, worker)


@router.post("/jobs/export_account_snapshot", summary="Start snapshot export job")
def start_export_account_snapshot_job(
    request: Request,
    payload: ExportAccountSnapshotRequest,
    account_role: str = Query(DEFAULT_ACCOUNT_ROLE, description="Spotify account slot: source or target."),
):
    session_id = _require_session_id(request)
    normalized_role = normalize_account_role(account_role)

    def worker(progress):
        sp = get_spotify_client_for_session(session_id, normalized_role)

        try:
            snapshot = export_account_snapshot(
                sp=sp,
                cutoff_date=payload.cutoff_date,
                include_playlists=payload.include_playlists,
                include_liked_tracks=payload.include_liked_tracks,
                include_saved_albums=payload.include_saved_albums,
                include_followed_artists=payload.include_followed_artists,
                progress_callback=progress,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except SpotifyException as exc:
            raise RuntimeError(_spotify_error_message(exc)) from exc

        file_path = None
        if payload.write_to_file:
            progress(96, "Saving snapshot file")
            try:
                file_path = write_snapshot_to_file(snapshot, payload.output_file_name)
            except OSError as exc:
                raise RuntimeError(f"Failed to write snapshot file: {exc}") from exc

        response = {
            "message": "Snapshot exported",
            "file_path": file_path,
            "counts": snapshot.get("counts", {}),
            "source_user_id": snapshot.get("source_user_id"),
            "source_account": snapshot.get("source_account"),
            "warnings": snapshot.get("warnings", []),
            "exported_at": snapshot.get("exported_at"),
            "cutoff_date": snapshot.get("cutoff_date"),
        }

        if payload.return_snapshot:
            response["snapshot"] = snapshot

        return response

    return create_job("export_account_snapshot", session_id, worker)


@router.post("/jobs/import_account_snapshot", summary="Start snapshot import job")
def start_import_account_snapshot_job(
    request: Request,
    payload: ImportAccountSnapshotRequest,
    account_role: str = Query(DEFAULT_ACCOUNT_ROLE, description="Spotify account slot: source or target."),
):
    session_id = _require_session_id(request)
    snapshot = _load_snapshot_from_payload(payload)
    normalized_role = normalize_account_role(account_role)

    def worker(progress):
        sp = get_spotify_client_for_session(session_id, normalized_role)
        try:
            result = import_account_snapshot(
                sp=sp,
                snapshot=snapshot,
                import_playlists=payload.import_playlists,
                import_liked_tracks=payload.import_liked_tracks,
                import_saved_albums=payload.import_saved_albums,
                import_followed_artists=payload.import_followed_artists,
                clear_existing_before_import=payload.clear_existing_before_import,
                strict_liked_order=payload.strict_liked_order,
                strict_liked_order_delay_seconds=payload.strict_liked_order_delay_seconds,
                strict_liked_order_cooldown_every=payload.strict_liked_order_cooldown_every,
                strict_liked_order_cooldown_seconds=payload.strict_liked_order_cooldown_seconds,
                strict_liked_order_max_consecutive_rate_limits=payload.strict_liked_order_max_consecutive_rate_limits,
                strict_liked_order_resume_from_index=payload.strict_liked_order_resume_from_index,
                progress_callback=progress,
            )
        except SpotifyException as exc:
            raise RuntimeError(_spotify_error_message(exc)) from exc

        return {
            "message": "Snapshot import completed",
            "result": result,
        }

    return create_job("import_account_snapshot", session_id, worker)
