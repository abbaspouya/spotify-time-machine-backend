from fastapi import APIRouter, HTTPException, Request
from ..core.auth import get_spotify_client
from ..schemas.account_snapshot import (
    ExportAccountSnapshotRequest,
    ImportAccountSnapshotRequest,
)
from ..services.account_snapshot import (
    export_account_snapshot,
    import_account_snapshot,
    load_snapshot_from_file,
    preview_account_snapshot_import,
    write_snapshot_to_file,
)

router = APIRouter(tags=["Snapshots"])


@router.post("/export_account_snapshot", summary="Export account snapshot")
def export_account_snapshot_endpoint(request: Request, payload: ExportAccountSnapshotRequest):
    sp = get_spotify_client(request)

    try:
        snapshot = export_account_snapshot(
            sp=sp,
            cutoff_date=payload.cutoff_date,
            include_playlists=payload.include_playlists,
            include_liked_tracks=payload.include_liked_tracks,
            include_saved_albums=payload.include_saved_albums,
            include_followed_artists=payload.include_followed_artists,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    file_path = None
    if payload.write_to_file:
        try:
            file_path = write_snapshot_to_file(snapshot, payload.output_file_name)
        except OSError as exc:
            raise HTTPException(status_code=500, detail=f"Failed to write snapshot file: {exc}")

    response = {
        "message": "Snapshot exported",
        "file_path": file_path,
        "counts": snapshot.get("counts", {}),
        "source_user_id": snapshot.get("source_user_id"),
        "exported_at": snapshot.get("exported_at"),
        "cutoff_date": snapshot.get("cutoff_date"),
    }

    if payload.return_snapshot:
        response["snapshot"] = snapshot

    return response


@router.post("/import_account_snapshot", summary="Import account snapshot")
def import_account_snapshot_endpoint(request: Request, payload: ImportAccountSnapshotRequest):
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
        snapshot = payload.snapshot or load_snapshot_from_file(payload.file_path or "")
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    sp = get_spotify_client(request)
    result = import_account_snapshot(
        sp=sp,
        snapshot=snapshot,
        import_playlists=payload.import_playlists,
        import_liked_tracks=payload.import_liked_tracks,
        import_saved_albums=payload.import_saved_albums,
        import_followed_artists=payload.import_followed_artists,
        clear_existing_before_import=payload.clear_existing_before_import,
        strict_liked_order=payload.strict_liked_order,
    )

    return {
        "message": "Snapshot import completed",
        "result": result,
    }


@router.post("/preview_account_snapshot_import", summary="Preview account snapshot import")
def preview_account_snapshot_import_endpoint(request: Request, payload: ImportAccountSnapshotRequest):
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
        snapshot = payload.snapshot or load_snapshot_from_file(payload.file_path or "")
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    sp = get_spotify_client(request)
    preview = preview_account_snapshot_import(
        sp=sp,
        snapshot=snapshot,
        import_playlists=payload.import_playlists,
        import_liked_tracks=payload.import_liked_tracks,
        import_saved_albums=payload.import_saved_albums,
        import_followed_artists=payload.import_followed_artists,
        clear_existing_before_import=payload.clear_existing_before_import,
        strict_liked_order=payload.strict_liked_order,
    )

    return {
        "message": "Snapshot import preview ready",
        "preview": preview,
    }
