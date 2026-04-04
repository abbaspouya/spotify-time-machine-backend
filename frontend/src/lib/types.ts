export type SpotifyAccountRole = "source" | "target"

export type AuthStatus = {
  authenticated: boolean
  expires_at?: number | null
  scope?: string | null
  token_type?: string | null
}

export type SpotifyAccountIdentity = {
  id: string | null
  display_name: string | null
  image_url: string | null
  profile_url: string | null
  country: string | null
  product: string | null
}

export type TopTracksTimeframeKey = "1_week" | "4_weeks" | "6_months" | "lifetime" | "custom"

export type TopTracksRequest = {
  timeframe: TopTracksTimeframeKey
  days?: number
  limit?: number
}

export type TopTrack = {
  rank: number
  id: string | null
  uri: string | null
  name: string | null
  artist_names: string[]
  album_name: string | null
  album_image_url: string | null
  spotify_url: string | null
  duration_ms: number | null
  play_count: number | null
  last_played_at: string | null
}

export type TopTracksTimeframe = {
  key: TopTracksTimeframeKey
  label: string
  mode: "recent_window" | "spotify_top_items"
  days?: number | null
  spotify_time_range?: string | null
  description: string
  disclaimer?: string | null
}

export type TopTracksResponse = {
  selected_timeframe: TopTracksTimeframe
  tracks: TopTrack[]
  track_count: number
  total_unique_tracks: number
  scanned_plays: number | null
  window_start: string | null
  window_end: string | null
  is_partial: boolean
  source_note: string
  retrieved_at: string | null
}

export type WhoAmI = SpotifyAccountIdentity & {
  email: string | null
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

export type SnapshotDocument = {
  exported_at?: string | null
  cutoff_date?: string | null
  source_user_id?: string | null
  source_account?: SpotifyAccountIdentity | null
  counts?: Partial<SnapshotCounts>
  warnings?: string[]
  [key: string]: unknown
}

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
  source_account: SpotifyAccountIdentity | null
  warnings: string[]
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
  strict_liked_order_delay_seconds?: number
  strict_liked_order_cooldown_every?: number
  strict_liked_order_cooldown_seconds?: number
  strict_liked_order_max_consecutive_rate_limits?: number
  strict_liked_order_resume_from_index?: number
}

export type SnapshotImportRequestedActions = {
  import_playlists: boolean
  import_liked_tracks: boolean
  import_saved_albums: boolean
  import_followed_artists: boolean
  clear_existing_before_import: boolean
  strict_liked_order: boolean
  strict_liked_order_delay_seconds?: number | null
  strict_liked_order_cooldown_every?: number | null
  strict_liked_order_cooldown_seconds?: number | null
  strict_liked_order_max_consecutive_rate_limits?: number | null
  strict_liked_order_resume_from_index?: number | null
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
  target_account: SpotifyAccountIdentity | null
  source_account: SpotifyAccountIdentity | null
  summary: ImportSnapshotSummary
  created_playlists: ImportedPlaylistSummary[]
  warnings: string[]
  next_resume_index?: number | null
  strict_liked_order?: {
    enabled: boolean
    delay_seconds: number
    cooldown_every: number | null
    cooldown_seconds: number
    max_consecutive_rate_limits: number | null
    resume_from_index: number
    requested_total: number
    remaining_total: number
    processed_count: number
    completed: boolean
    stopped_early: boolean
    stopped_reason: string | null
    next_resume_index: number | null
  }
}

export type ImportSnapshotResponse = {
  message: string
  result: ImportSnapshotResult
}

export type SnapshotImportPreview = {
  previewed_at: string
  target_user_id: string | null
  source_user_id: string | null
  target_account: SpotifyAccountIdentity | null
  source_account: SpotifyAccountIdentity | null
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
