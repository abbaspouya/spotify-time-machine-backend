from pydantic import BaseModel, Field


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
    strict_liked_order_delay_seconds: float | None = Field(default=None, ge=0.0)
    strict_liked_order_cooldown_every: int | None = Field(default=None, ge=0)
    strict_liked_order_cooldown_seconds: float | None = Field(default=None, ge=0.0)
    strict_liked_order_max_consecutive_rate_limits: int | None = Field(default=None, ge=0)
    strict_liked_order_resume_from_index: int = Field(default=0, ge=0)
