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
  write_to_file: boolean
  output_file_name?: string
  return_snapshot: boolean
}

export type ExportSnapshotResponse = {
  message: string
  file_path: string | null
  counts: Record<string, number>
  source_user_id: string | null
  exported_at: string | null
  cutoff_date: string | null
  snapshot?: Record<string, unknown>
}

export type ImportSnapshotPayload = {
  file_path: string
  import_playlists: boolean
  import_liked_tracks: boolean
  import_saved_albums: boolean
  import_followed_artists: boolean
  clear_existing_before_import: boolean
  strict_liked_order: boolean
}

export type ImportSnapshotResponse = {
  message: string
  result: Record<string, unknown>
}
