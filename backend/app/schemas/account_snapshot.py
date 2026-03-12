from pydantic import BaseModel


class ExportAccountSnapshotRequest(BaseModel):
    cutoff_date: str | None = None
    include_playlists: bool = True
    include_liked_tracks: bool = True
    include_saved_albums: bool = True
    include_followed_artists: bool = True
    write_to_file: bool = True
    output_file_name: str | None = None
    return_snapshot: bool = False


class ImportAccountSnapshotRequest(BaseModel):
    file_path: str | None = None
    snapshot: dict | None = None
    import_playlists: bool = True
    import_liked_tracks: bool = True
    import_saved_albums: bool = True
    import_followed_artists: bool = True
    clear_existing_before_import: bool = False
    strict_liked_order: bool = False
