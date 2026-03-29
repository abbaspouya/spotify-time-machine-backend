export type AuthStatus = {
  authenticated: boolean
  expires_at?: number | null
  scope?: string | null
  token_type?: string | null
}

export type WhoAmI = {
  id: string
  display_name: string | null
  email: string | null
  country: string | null
  product: string | null
  image_url: string | null
  profile_url: string | null
}

export type GroupedSongsResponse = {
  groups: Record<string, string[]>
  total_songs: number
}

export type GroupFilters = {
  period: string
  order: string
  startYear?: number
  endYear?: number
}

export type CreatePlaylistPayload = {
  period: string
  order: string
  group_key: string
  start_year?: number
  end_year?: number
  playlist_name?: string
  playlist_description?: string
}

export type PlaylistMutationResponse = {
  message: string
  playlist_id: string
  playlist_name: string
  group_key?: string
  language?: string
  track_count: number
  playlist_url: string
}

export type LanguageGroupsResponse = {
  groups: Record<string, string[]>
}

export type CreateLanguagePlaylistPayload = {
  language_code: string
  playlist_name?: string
  min_songs: number
}

export type Artist = {
  id: string
  name: string
  popularity: number | null
  genres: string[]
  image_url: string | null
  spotify_url: string
}

export type SearchArtistsResponse = {
  query: string
  count: number
  artists: Artist[]
}

export type ExportSnapshotPayload = {
  cutoff_date?: string
  include_playlists: boolean
  include_liked_tracks: boolean
  include_saved_albums: boolean
  include_followed_artists: boolean
  write_to_file?: boolean
  output_file_name?: string
  return_snapshot?: boolean
}

export type SnapshotDocument = Record<string, unknown>

export type SnapshotCounts = {
  playlists: number
  playlist_tracks: number
  liked_tracks: number
  saved_albums: number
  followed_artists: number
}

export type ExportSnapshotResponse = {
  message: string
  file_path: string | null
  counts: SnapshotCounts
  source_user_id: string | null
  exported_at: string | null
  cutoff_date: string | null
  snapshot?: SnapshotDocument
}

export type ImportSnapshotPayload = {
  file_path?: string
  snapshot?: SnapshotDocument
  import_playlists: boolean
  import_liked_tracks: boolean
  import_saved_albums: boolean
  import_followed_artists: boolean
  clear_existing_before_import: boolean
  strict_liked_order: boolean
}

export type SnapshotImportRequestedActions = {
  import_playlists: boolean
  import_liked_tracks: boolean
  import_saved_albums: boolean
  import_followed_artists: boolean
  clear_existing_before_import: boolean
  strict_liked_order: boolean
}

export type ImportSnapshotSummary = {
  playlists_created: number
  playlist_tracks_added: number
  playlist_tracks_failed: number
  playlists_removed: number
  liked_tracks_added: number
  liked_tracks_failed: number
  liked_tracks_removed: number
  saved_albums_added: number
  saved_albums_failed: number
  saved_albums_removed: number
  followed_artists_added: number
  followed_artists_failed: number
  followed_artists_removed: number
}

export type ImportedPlaylistSummary = {
  id: string | null
  name: string
  external_url: string | null
}

export type ImportSnapshotResult = {
  imported_at: string
  target_user_id: string | null
  source_user_id: string | null
  summary: ImportSnapshotSummary
  created_playlists: ImportedPlaylistSummary[]
  warnings: string[]
}

export type ImportSnapshotResponse = {
  message: string
  result: ImportSnapshotResult
}

export type SnapshotImportPreview = {
  previewed_at: string
  target_user_id: string | null
  source_user_id: string | null
  snapshot_counts: SnapshotCounts
  summary: ImportSnapshotSummary
  requested_actions: SnapshotImportRequestedActions
  destructive_operations: string[]
  warnings: string[]
  requires_confirmation: boolean
}

export type SnapshotImportPreviewResponse = {
  message: string
  preview: SnapshotImportPreview
}

export type AsyncJobStatus = "queued" | "running" | "completed" | "failed"

export type AsyncJob<T = unknown> = {
  job_id: string
  kind: string
  status: AsyncJobStatus
  progress: number | null
  message: string | null
  error: string | null
  created_at: string
  updated_at: string
  finished_at: string | null
  result: T | null
}
