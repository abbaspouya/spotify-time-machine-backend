import type {
  AuthStatus,
  CreateLanguagePlaylistPayload,
  CreatePlaylistPayload,
  ExportSnapshotPayload,
  ExportSnapshotResponse,
  GroupFilters,
  GroupedSongsResponse,
  ImportSnapshotPayload,
  ImportSnapshotResponse,
  LanguageGroupsResponse,
  PlaylistMutationResponse,
  SearchArtistsResponse,
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
    const message =
      typeof payload === "object" && payload !== null && "detail" in payload
        ? String(payload.detail)
        : typeof payload === "string"
          ? payload
          : "Request failed"

    throw new ApiError(response.status, message)
  }

  return payload as T
}

export function getLoginUrl() {
  return `${API_BASE_URL}/login`
}

export function getDocsUrl() {
  return `${API_BASE_URL}/docs`
}

export async function getAuthStatus() {
  return request<AuthStatus>("/auth_status")
}

export async function getWhoAmI() {
  return request<WhoAmI>("/whoami")
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

export async function createPlaylistForGroup(payload: CreatePlaylistPayload) {
  return request<PlaylistMutationResponse>("/create_playlist_for_group", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function getLanguageGroups() {
  return request<LanguageGroupsResponse>("/group_by_language")
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

export async function exportSnapshot(payload: ExportSnapshotPayload) {
  return request<ExportSnapshotResponse>("/export_account_snapshot", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function importSnapshot(payload: ImportSnapshotPayload) {
  return request<ImportSnapshotResponse>("/import_account_snapshot", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}
