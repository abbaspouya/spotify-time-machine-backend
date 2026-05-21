import type {
  AppendPlaylistPayload,
  AppendPlaylistResponse,
  AsyncJob,
  AuthStatus,
  CreateLanguagePlaylistPayload,
  CreatePlaylistPayload,
  ExportSnapshotPayload,
  ExportSnapshotResponse,
  GroupedSongsResponse,
  ImportSnapshotPayload,
  ImportSnapshotResponse,
  LanguageGroupsResponse,
  PlaylistMutationResponse,
  SnapshotCounts,
  SnapshotDocument,
  SnapshotImportPreviewResponse,
  SpotifyAccountRole,
  TopTracksResponse,
  WhoAmI,
} from "@/lib/types"
import {
  DEMO_SPOTIFY_SCOPE,
  accountIdentity,
  buildDemoImportSummary,
  buildDemoSnapshot,
  demoGroupedSongs,
  demoLanguageGroups,
  demoPlaylists,
  demoPlaylistsResponse,
  demoSnapshotCounts,
  demoSourceAccount,
  demoTargetAccount,
  demoTimeframes,
  demoTopTracks,
} from "@/lib/demo-data"

const demoJobs = new Map<string, AsyncJob<unknown>>()
let demoJobSequence = 0

function delay(ms = 180) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function nowIso() {
  return new Date().toISOString()
}

function readJsonBody<T>(init?: RequestInit): T | null {
  if (typeof init?.body !== "string" || !init.body) {
    return null
  }

  try {
    return JSON.parse(init.body) as T
  } catch {
    return null
  }
}

function getAccountRole(url: URL): SpotifyAccountRole {
  return url.searchParams.get("account_role") === "target" ? "target" : "source"
}

function getDemoAccount(role: SpotifyAccountRole): WhoAmI {
  return role === "target" ? demoTargetAccount : demoSourceAccount
}

function createCompletedJob<T>(kind: string, result: T, message: string): AsyncJob<T> {
  const timestamp = nowIso()
  const job: AsyncJob<T> = {
    job_id: `demo-job-${++demoJobSequence}`,
    kind,
    status: "completed",
    progress: 1,
    message,
    error: null,
    created_at: timestamp,
    updated_at: timestamp,
    finished_at: timestamp,
    result,
  }

  demoJobs.set(job.job_id, job as AsyncJob<unknown>)
  return job
}

function getSnapshotCounts(snapshot?: SnapshotDocument | null): SnapshotCounts {
  return {
    playlists: snapshot?.counts?.playlists ?? demoSnapshotCounts.playlists,
    playlist_tracks: snapshot?.counts?.playlist_tracks ?? demoSnapshotCounts.playlist_tracks,
    liked_tracks: snapshot?.counts?.liked_tracks ?? demoSnapshotCounts.liked_tracks,
    saved_albums: snapshot?.counts?.saved_albums ?? demoSnapshotCounts.saved_albums,
    followed_artists: snapshot?.counts?.followed_artists ?? demoSnapshotCounts.followed_artists,
  }
}

function buildExportSnapshotResponse(payload: ExportSnapshotPayload | null): ExportSnapshotResponse {
  const counts: SnapshotCounts = {
    playlists: payload?.include_playlists === false ? 0 : demoSnapshotCounts.playlists,
    playlist_tracks: payload?.include_playlists === false ? 0 : demoSnapshotCounts.playlist_tracks,
    liked_tracks: payload?.include_liked_tracks === false ? 0 : demoSnapshotCounts.liked_tracks,
    saved_albums: payload?.include_saved_albums === false ? 0 : demoSnapshotCounts.saved_albums,
    followed_artists: payload?.include_followed_artists === false ? 0 : demoSnapshotCounts.followed_artists,
  }
  const snapshot = {
    ...buildDemoSnapshot(),
    cutoff_date: payload?.cutoff_date || null,
    counts,
  }

  return {
    message: "Demo snapshot exported.",
    file_path: null,
    counts,
    source_user_id: demoSourceAccount.id,
    source_account: accountIdentity(demoSourceAccount),
    warnings: [
      "Demo mode uses sample data and does not read, create, or modify Spotify content.",
      "Use real mode with your Spotify Developer credentials when you are ready to work with an account.",
    ],
    exported_at: snapshot.exported_at ?? nowIso(),
    cutoff_date: payload?.cutoff_date || null,
    snapshot,
  }
}

function buildPreviewResponse(payload: ImportSnapshotPayload | null): SnapshotImportPreviewResponse {
  const snapshotCounts = getSnapshotCounts(payload?.snapshot)
  const clearExistingBeforeImport = payload?.clear_existing_before_import === true
  const summary = buildDemoImportSummary({
    importPlaylists: payload?.import_playlists !== false,
    importLikedTracks: payload?.import_liked_tracks !== false,
    importSavedAlbums: payload?.import_saved_albums !== false,
    importFollowedArtists: payload?.import_followed_artists !== false,
    clearExistingBeforeImport,
  })
  const destructiveOperations = clearExistingBeforeImport
    ? [
        "Demo cleanup: existing target playlists selected for replacement would be removed first.",
        "Demo cleanup: selected target library items would be cleared before import.",
      ]
    : []

  return {
    message: "Demo import preview ready.",
    preview: {
      previewed_at: nowIso(),
      target_user_id: demoTargetAccount.id,
      source_user_id: demoSourceAccount.id,
      target_account: accountIdentity(demoTargetAccount),
      source_account: accountIdentity(demoSourceAccount),
      snapshot_counts: snapshotCounts,
      summary,
      requested_actions: {
        import_playlists: payload?.import_playlists !== false,
        import_liked_tracks: payload?.import_liked_tracks !== false,
        import_saved_albums: payload?.import_saved_albums !== false,
        import_followed_artists: payload?.import_followed_artists !== false,
        clear_existing_before_import: clearExistingBeforeImport,
        strict_liked_order: payload?.strict_liked_order === true,
        strict_liked_order_delay_seconds: payload?.strict_liked_order_delay_seconds ?? null,
        strict_liked_order_cooldown_every: payload?.strict_liked_order_cooldown_every ?? null,
        strict_liked_order_cooldown_seconds: payload?.strict_liked_order_cooldown_seconds ?? null,
        strict_liked_order_max_consecutive_rate_limits: payload?.strict_liked_order_max_consecutive_rate_limits ?? null,
        strict_liked_order_resume_from_index: payload?.strict_liked_order_resume_from_index ?? null,
      },
      destructive_operations: destructiveOperations,
      warnings: ["Demo preview only: no target Spotify account will be changed."],
      requires_confirmation: destructiveOperations.length > 0,
    },
  }
}

function buildImportResponse(payload: ImportSnapshotPayload | null): ImportSnapshotResponse {
  const summary = buildDemoImportSummary({
    importPlaylists: payload?.import_playlists !== false,
    importLikedTracks: payload?.import_liked_tracks !== false,
    importSavedAlbums: payload?.import_saved_albums !== false,
    importFollowedArtists: payload?.import_followed_artists !== false,
    clearExistingBeforeImport: payload?.clear_existing_before_import === true,
  })

  return {
    message: "Demo import completed.",
    result: {
      imported_at: nowIso(),
      target_user_id: demoTargetAccount.id,
      source_user_id: demoSourceAccount.id,
      target_account: accountIdentity(demoTargetAccount),
      source_account: accountIdentity(demoSourceAccount),
      summary,
      created_playlists: [
        {
          id: "demo-created-2020",
          name: "Imported Demo: Time Capsule 2020",
          external_url: "https://open.spotify.com/",
        },
        {
          id: "demo-created-road",
          name: "Imported Demo: Road Trip Draft",
          external_url: "https://open.spotify.com/",
        },
      ],
      warnings: ["Demo import only: this result is simulated and no Spotify data was changed."],
    },
  }
}

function buildTopTracksResponse(url: URL): TopTracksResponse {
  const timeframe = url.searchParams.get("timeframe") || "4_weeks"
  const selectedTimeframe = demoTimeframes[timeframe] ?? demoTimeframes["4_weeks"]
  const limit = Number(url.searchParams.get("limit") || "50")
  const tracks = demoTopTracks.slice(0, Number.isFinite(limit) && limit > 0 ? limit : 50)

  return {
    selected_timeframe: selectedTimeframe,
    tracks,
    track_count: tracks.length,
    total_unique_tracks: demoTopTracks.length,
    scanned_plays: selectedTimeframe.mode === "recent_window" ? 136 : null,
    window_start: selectedTimeframe.days ? new Date(Date.now() - selectedTimeframe.days * 86_400_000).toISOString() : null,
    window_end: new Date().toISOString(),
    is_partial: false,
    source_note: "Demo mode uses sample top-track data.",
    retrieved_at: nowIso(),
  }
}

function buildPlaylistMutationResponse(payload: CreatePlaylistPayload | null): PlaylistMutationResponse {
  const groupKey = payload?.group_key || Object.keys(demoGroupedSongs.groups)[0]
  const trackCount = demoGroupedSongs.groups[groupKey]?.length ?? 0

  return {
    message: "Demo playlist created.",
    playlist_id: `demo-playlist-${groupKey.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    playlist_name: payload?.playlist_name || `Liked Songs - ${groupKey}`,
    group_key: groupKey,
    track_count: trackCount,
    playlist_url: "https://open.spotify.com/",
  }
}

function buildLanguagePlaylistResponse(payload: CreateLanguagePlaylistPayload | null): PlaylistMutationResponse {
  const language = payload?.language_code || "en"
  const trackCount = demoLanguageGroups.groups[language]?.length ?? 0

  return {
    message: "Demo language playlist created.",
    playlist_id: `demo-language-${language}`,
    playlist_name: payload?.playlist_name || `Liked Songs - ${language.toUpperCase()}`,
    language,
    track_count: trackCount,
    playlist_url: "https://open.spotify.com/",
  }
}

function buildAppendPlaylistResponse(payload: AppendPlaylistPayload | null): AppendPlaylistResponse {
  const sourcePlaylist = demoPlaylists.find((playlist) => playlist.id === payload?.source_playlist_id) ?? demoPlaylists[0]
  const targetPlaylist = demoPlaylists.find((playlist) => playlist.id === payload?.target_playlist_id) ?? demoPlaylists[1]
  const target =
    payload?.target_type === "playlist"
      ? {
          kind: "playlist" as const,
          id: targetPlaylist.id,
          name: targetPlaylist.name,
          spotify_url: targetPlaylist.spotify_url,
        }
      : {
          kind: "liked_tracks" as const,
          id: null,
          name: "Liked Songs",
          spotify_url: "https://open.spotify.com/collection/tracks",
        }

  return {
    message: `Demo added ${sourcePlaylist.name} into ${target.name}.`,
    source_playlist: sourcePlaylist,
    target,
    tracks_added: sourcePlaylist.track_count ?? 0,
    skipped_tracks: 3,
    warnings: ["Demo mode only: the playlist move is simulated."],
  }
}

export async function demoRequest<T>(path: string, init?: RequestInit): Promise<T> {
  await delay()

  const url = new URL(path, "http://demo.local")
  const role = getAccountRole(url)
  const method = (init?.method || "GET").toUpperCase()

  if (url.pathname === "/auth_status") {
    return {
      authenticated: true,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      scope: DEMO_SPOTIFY_SCOPE,
      token_type: "Bearer",
    } satisfies AuthStatus as T
  }

  if (url.pathname === "/whoami") {
    return getDemoAccount(role) as T
  }

  if (url.pathname === "/logout") {
    return { authenticated: false } as T
  }

  if (url.pathname === "/top_tracks") {
    return buildTopTracksResponse(url) as T
  }

  if (url.pathname === "/fetch_and_group") {
    return demoGroupedSongs as T
  }

  if (url.pathname === "/jobs/fetch_and_group" && method === "POST") {
    return createCompletedJob<GroupedSongsResponse>("fetch_and_group", demoGroupedSongs, "Demo time groups are ready.") as T
  }

  if (url.pathname === "/group_by_language") {
    return demoLanguageGroups as T
  }

  if (url.pathname === "/jobs/group_by_language" && method === "POST") {
    return createCompletedJob<LanguageGroupsResponse>("group_by_language", demoLanguageGroups, "Demo language groups are ready.") as T
  }

  if (url.pathname === "/create_playlist_for_group" && method === "POST") {
    return buildPlaylistMutationResponse(readJsonBody<CreatePlaylistPayload>(init)) as T
  }

  if (url.pathname === "/create_playlist_by_language" && method === "POST") {
    return buildLanguagePlaylistResponse(readJsonBody<CreateLanguagePlaylistPayload>(init)) as T
  }

  if (url.pathname === "/playlists") {
    return demoPlaylistsResponse as T
  }

  if (url.pathname === "/playlists/append" && method === "POST") {
    return buildAppendPlaylistResponse(readJsonBody<AppendPlaylistPayload>(init)) as T
  }

  if (url.pathname === "/export_account_snapshot" && method === "POST") {
    return buildExportSnapshotResponse(readJsonBody<ExportSnapshotPayload>(init)) as T
  }

  if (url.pathname === "/jobs/export_account_snapshot" && method === "POST") {
    return createCompletedJob<ExportSnapshotResponse>(
      "export_account_snapshot",
      buildExportSnapshotResponse(readJsonBody<ExportSnapshotPayload>(init)),
      "Demo snapshot export is ready.",
    ) as T
  }

  if (url.pathname === "/preview_account_snapshot_import" && method === "POST") {
    return buildPreviewResponse(readJsonBody<ImportSnapshotPayload>(init)) as T
  }

  if (url.pathname === "/import_account_snapshot" && method === "POST") {
    return buildImportResponse(readJsonBody<ImportSnapshotPayload>(init)) as T
  }

  if (url.pathname === "/jobs/import_account_snapshot" && method === "POST") {
    return createCompletedJob<ImportSnapshotResponse>(
      "import_account_snapshot",
      buildImportResponse(readJsonBody<ImportSnapshotPayload>(init)),
      "Demo snapshot import completed.",
    ) as T
  }

  if (url.pathname.startsWith("/jobs/")) {
    const jobId = url.pathname.split("/").filter(Boolean)[1]
    const job = demoJobs.get(jobId)
    if (job) {
      return job as T
    }
  }

  throw new Error(`Demo mode does not have a mock response for ${method} ${url.pathname}.`)
}
