import type {
  AppendPlaylistPayload,
  AppendPlaylistResponse,
  AuthStatus,
  CurrentUserPlaylistsResponse,
  CreateLanguagePlaylistPayload,
  CreatePlaylistPayload,
  ExportSnapshotPayload,
  ExportSnapshotResponse,
  GroupFilters,
  GroupedSongsResponse,
  ImportSnapshotPayload,
  SnapshotImportPreviewResponse,
  ImportSnapshotResponse,
  LanguageGroupsResponse,
  PlaylistMutationResponse,
  SearchArtistsResponse,
  SpotifyAccountRole,
  AsyncJob,
  TopTracksRequest,
  TopTracksResponse,
  WhoAmI,
} from "@/lib/types"

const fallbackBaseUrl =
  typeof window === "undefined"
    ? "http://127.0.0.1:8000"
    : `${window.location.protocol}//${window.location.hostname}:8000`

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || fallbackBaseUrl).replace(/\/$/, "")
const SPOTIFY_RATE_LIMIT_STORAGE_KEY = "spotify_api_rate_limit_until"
const SPOTIFY_RATE_LIMIT_EVENT = "spotify-rate-limit-updated"
const DEFAULT_SPOTIFY_RATE_LIMIT_COOLDOWN_SECONDS = 60

export class ApiError extends Error {
  status: number
  retryAfterSeconds?: number

  constructor(status: number, message: string, retryAfterSeconds?: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

function dispatchSpotifyRateLimitEvent() {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(new Event(SPOTIFY_RATE_LIMIT_EVENT))
}

export function getSpotifyRateLimitUntil() {
  if (typeof window === "undefined") {
    return null
  }

  const rawValue = window.sessionStorage.getItem(SPOTIFY_RATE_LIMIT_STORAGE_KEY)
  if (!rawValue) {
    return null
  }

  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed) || parsed <= Date.now()) {
    window.sessionStorage.removeItem(SPOTIFY_RATE_LIMIT_STORAGE_KEY)
    return null
  }

  return parsed
}

export function getSpotifyRateLimitRemainingSeconds() {
  const until = getSpotifyRateLimitUntil()
  if (!until) {
    return null
  }

  return Math.max(1, Math.ceil((until - Date.now()) / 1000))
}

export function setSpotifyRateLimitCooldown(retryAfterSeconds?: number) {
  if (typeof window === "undefined") {
    return
  }

  const cooldownSeconds =
    typeof retryAfterSeconds === "number" && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds
      : DEFAULT_SPOTIFY_RATE_LIMIT_COOLDOWN_SECONDS
  const nextUntil = Date.now() + cooldownSeconds * 1000
  const existingUntil = getSpotifyRateLimitUntil()
  const effectiveUntil = existingUntil && existingUntil > nextUntil ? existingUntil : nextUntil
  window.sessionStorage.setItem(SPOTIFY_RATE_LIMIT_STORAGE_KEY, String(effectiveUntil))
  dispatchSpotifyRateLimitEvent()
}

export function clearSpotifyRateLimitCooldown() {
  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.removeItem(SPOTIFY_RATE_LIMIT_STORAGE_KEY)
  dispatchSpotifyRateLimitEvent()
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") {
      continue
    }

    searchParams.set(key, String(value))
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  getSpotifyRateLimitUntil()

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })

  const contentType = response.headers.get("content-type") || ""
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const retryAfterHeader = response.headers.get("retry-after")
    const retryAfterSeconds =
      retryAfterHeader && /^\d+$/.test(retryAfterHeader.trim())
        ? Number(retryAfterHeader.trim())
        : undefined
    const requestId =
      typeof payload === "object" && payload !== null && "request_id" in payload
        ? String(payload.request_id)
        : undefined

    const message =
      typeof payload === "object" && payload !== null && "detail" in payload
        ? String(payload.detail)
        : typeof payload === "string"
          ? payload
          : "Request failed"

    if (response.status === 429) {
      setSpotifyRateLimitCooldown(retryAfterSeconds)
    }

    throw new ApiError(
      response.status,
      requestId ? `${message} (Request ID: ${requestId})` : message,
      retryAfterSeconds,
    )
  }

  return payload as T
}

type AccountScopedRequestOptions = {
  accountRole?: SpotifyAccountRole
}

type LoginUrlOptions = AccountScopedRequestOptions & {
  returnTo?: string
}

function buildAccountRoleQuery(accountRole?: SpotifyAccountRole) {
  return buildQuery({
    account_role: accountRole,
  })
}

export function getLoginUrl(options?: LoginUrlOptions) {
  const query = buildQuery({
    account_role: options?.accountRole,
    return_to: options?.returnTo,
  })
  return `${API_BASE_URL}/login${query}`
}

export function getDocsUrl() {
  return `${API_BASE_URL}/docs`
}

export async function getAuthStatus(accountRole?: SpotifyAccountRole) {
  return request<AuthStatus>(`/auth_status${buildAccountRoleQuery(accountRole)}`)
}

export async function getTopTracks(payload: TopTracksRequest) {
  return request<TopTracksResponse>(
    `/top_tracks${buildQuery({
      timeframe: payload.timeframe,
      days: payload.days,
      limit: payload.limit ?? 50,
    })}`,
  )
}

export async function getWhoAmI(accountRole?: SpotifyAccountRole) {
  return request<WhoAmI>(`/whoami${buildAccountRoleQuery(accountRole)}`)
}

export async function logoutSpotify(accountRole?: SpotifyAccountRole) {
  return request<{ authenticated: false }>(`/logout${buildAccountRoleQuery(accountRole)}`, {
    method: "POST",
  })
}

export async function getGroupedSongs(filters: GroupFilters) {
  return request<GroupedSongsResponse>(
    `/fetch_and_group${buildQuery({
      period: filters.period,
      order: filters.order,
      start_year: filters.startYear,
      end_year: filters.endYear,
    })}`,
  )
}

export async function startGroupedSongsJob(filters: GroupFilters) {
  return request<AsyncJob<GroupedSongsResponse>>("/jobs/fetch_and_group", {
    method: "POST",
    body: JSON.stringify({
      period: filters.period,
      order: filters.order,
      start_year: filters.startYear,
      end_year: filters.endYear,
    }),
  })
}

export async function createPlaylistForGroup(payload: CreatePlaylistPayload) {
  return request<PlaylistMutationResponse>("/create_playlist_for_group", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function getLanguageGroups() {
  return request<LanguageGroupsResponse>("/group_by_language")
}

export async function startLanguageGroupsJob() {
  return request<AsyncJob<LanguageGroupsResponse>>("/jobs/group_by_language", {
    method: "POST",
    body: JSON.stringify({}),
  })
}

export async function createPlaylistByLanguage(payload: CreateLanguagePlaylistPayload) {
  return request<PlaylistMutationResponse>("/create_playlist_by_language", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function getCurrentUserPlaylists(accountRole?: SpotifyAccountRole) {
  return request<CurrentUserPlaylistsResponse>(`/playlists${buildAccountRoleQuery(accountRole)}`)
}

export async function appendPlaylist(payload: AppendPlaylistPayload, accountRole?: SpotifyAccountRole) {
  return request<AppendPlaylistResponse>(`/playlists/append${buildAccountRoleQuery(accountRole)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function searchArtists(query: string, limit = 8) {
  return request<SearchArtistsResponse>(
    `/search_artists${buildQuery({
      q: query,
      limit,
    })}`,
  )
}

export async function exportSnapshot(payload: ExportSnapshotPayload, accountRole?: SpotifyAccountRole) {
  return request<ExportSnapshotResponse>(`/export_account_snapshot${buildAccountRoleQuery(accountRole)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function startExportSnapshotJob(payload: ExportSnapshotPayload, accountRole?: SpotifyAccountRole) {
  return request<AsyncJob<ExportSnapshotResponse>>(`/jobs/export_account_snapshot${buildAccountRoleQuery(accountRole)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function importSnapshot(payload: ImportSnapshotPayload, accountRole?: SpotifyAccountRole) {
  return request<ImportSnapshotResponse>(`/import_account_snapshot${buildAccountRoleQuery(accountRole)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function previewSnapshotImport(payload: ImportSnapshotPayload, accountRole?: SpotifyAccountRole) {
  return request<SnapshotImportPreviewResponse>(`/preview_account_snapshot_import${buildAccountRoleQuery(accountRole)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function startImportSnapshotJob(payload: ImportSnapshotPayload, accountRole?: SpotifyAccountRole) {
  return request<AsyncJob<ImportSnapshotResponse>>(`/jobs/import_account_snapshot${buildAccountRoleQuery(accountRole)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function getJob<T>(jobId: string) {
  return request<AsyncJob<T>>(`/jobs/${jobId}`)
}
