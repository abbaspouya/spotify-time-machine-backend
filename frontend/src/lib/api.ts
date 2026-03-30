import type {
  AuthStatus,
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

const fallbackBaseUrl = "http://127.0.0.1:8000"

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || fallbackBaseUrl).replace(/\/$/, "")

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
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

    throw new ApiError(response.status, requestId ? `${message} (Request ID: ${requestId})` : message)
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
