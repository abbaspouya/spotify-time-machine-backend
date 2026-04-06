from typing import Literal

from pydantic import BaseModel, Field


class CreatePlaylistRequest(BaseModel):
    period: str = "monthly"  # "monthly", "quarterly", "semi", "yearly"
    start_year: int | None = None
    end_year: int | None = None
    group_key: str
    playlist_name: str | None = None
    playlist_description: str | None = None
    order: str = "asc"  # "asc" or "desc"


class CreateLanguagePlaylistRequest(BaseModel):
    language_code: str  # e.g. "en", "it", "fa"
    playlist_name: str | None = None
    min_songs: int = 5  # only create if enough songs


class AppendPlaylistRequest(BaseModel):
    source_playlist_id: str
    target_type: Literal["liked_tracks", "playlist"]
    target_playlist_id: str | None = None


class PlaylistOwnerSummary(BaseModel):
    id: str | None = None
    display_name: str | None = None


class PlaylistSummary(BaseModel):
    id: str
    name: str
    description: str = ""
    public: bool | None = None
    collaborative: bool | None = None
    owner: PlaylistOwnerSummary | None = None
    image_url: str | None = None
    spotify_url: str | None = None
    track_count: int | None = None


class PlaylistTrackArtistSummary(BaseModel):
    id: str | None = None
    name: str | None = None


class PlaylistTrackAlbumSummary(BaseModel):
    id: str | None = None
    name: str | None = None
    image_url: str | None = None
    spotify_url: str | None = None


class PlaylistTrackSummary(BaseModel):
    position: int
    added_at: str | None = None
    added_by_id: str | None = None
    id: str | None = None
    uri: str | None = None
    name: str | None = None
    duration_ms: int | None = None
    explicit: bool | None = None
    is_local: bool = False
    artists: list[PlaylistTrackArtistSummary] = Field(default_factory=list)
    album: PlaylistTrackAlbumSummary | None = None
    spotify_url: str | None = None


class CurrentUserPlaylistsResponse(BaseModel):
    playlists: list[PlaylistSummary]
    total_playlists: int


class PlaylistTracksResponse(BaseModel):
    playlist: PlaylistSummary
    tracks: list[PlaylistTrackSummary]
    total_tracks: int


class PlaylistAppendTargetSummary(BaseModel):
    kind: Literal["liked_tracks", "playlist"]
    id: str | None = None
    name: str
    spotify_url: str | None = None


class AppendPlaylistResponse(BaseModel):
    message: str
    source_playlist: PlaylistSummary
    target: PlaylistAppendTargetSummary
    tracks_added: int
    skipped_tracks: int = 0
    warnings: list[str] = Field(default_factory=list)
