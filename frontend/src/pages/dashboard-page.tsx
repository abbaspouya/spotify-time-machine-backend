import { useDeferredValue, useEffect, useState } from "react"
import type { FormEvent } from "react"
import {
  Disc3,
  Download,
  ExternalLink,
  Languages,
  LoaderCircle,
  LockOpen,
  Music4,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
} from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  createPlaylistByLanguage,
  createPlaylistForGroup,
  exportSnapshot,
  getAuthStatus,
  getGroupedSongs,
  getLanguageGroups,
  getLoginUrl,
  getWhoAmI,
  importSnapshot,
  searchArtists,
} from "@/lib/api"
import type { GroupFilters } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type GroupFilterDraft = {
  period: string
  order: string
  startYear: string
  endYear: string
}

const defaultGroupDraft: GroupFilterDraft = {
  period: "monthly",
  order: "asc",
  startYear: "",
  endYear: "",
}

const initialAppliedFilters: GroupFilters = {
  period: "monthly",
  order: "asc",
}

const periodOptions = [
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
  { label: "Half-year", value: "semi" },
  { label: "Yearly", value: "yearly" },
]

const orderOptions = [
  { label: "Oldest to newest", value: "asc" },
  { label: "Newest to oldest", value: "desc" },
]

const exportToggleFields = [
  { label: "Include playlists", key: "includePlaylists" },
  { label: "Include liked tracks", key: "includeLikedTracks" },
  { label: "Include saved albums", key: "includeSavedAlbums" },
  { label: "Include followed artists", key: "includeFollowedArtists" },
  { label: "Write to file", key: "writeToFile" },
  { label: "Return snapshot payload", key: "returnSnapshot" },
] as const

const importToggleFields = [
  { label: "Import playlists", key: "importPlaylists" },
  { label: "Import liked tracks", key: "importLikedTracks" },
  { label: "Import saved albums", key: "importSavedAlbums" },
  { label: "Import followed artists", key: "importFollowedArtists" },
  { label: "Clear existing first", key: "clearExistingBeforeImport" },
  { label: "Strict liked order", key: "strictLikedOrder" },
] as const

function formatExpiresAt(value?: number | null) {
  if (!value) {
    return "Unknown"
  }

  return new Date(value * 1000).toLocaleString()
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong."
}

function groupCardLabel(groupKey: string, trackIds: string[]) {
  return `${groupKey} - ${trackIds.length} tracks`
}

export function DashboardPage() {
  const queryClient = useQueryClient()

  const [groupDraft, setGroupDraft] = useState<GroupFilterDraft>(defaultGroupDraft)
  const [appliedGroupFilters, setAppliedGroupFilters] = useState<GroupFilters>(initialAppliedFilters)
  const [selectedGroup, setSelectedGroup] = useState("")
  const [groupPlaylistName, setGroupPlaylistName] = useState("")
  const [groupPlaylistDescription, setGroupPlaylistDescription] = useState("")

  const [selectedLanguage, setSelectedLanguage] = useState("")
  const [languagePlaylistName, setLanguagePlaylistName] = useState("")
  const [languageMinSongs, setLanguageMinSongs] = useState("5")

  const [artistSearch, setArtistSearch] = useState("")
  const deferredArtistSearch = useDeferredValue(artistSearch.trim())

  const [exportForm, setExportForm] = useState({
    cutoffDate: "",
    includePlaylists: true,
    includeLikedTracks: true,
    includeSavedAlbums: true,
    includeFollowedArtists: true,
    writeToFile: true,
    outputFileName: "",
    returnSnapshot: false,
  })

  const [importForm, setImportForm] = useState({
    filePath: "",
    importPlaylists: true,
    importLikedTracks: true,
    importSavedAlbums: true,
    importFollowedArtists: true,
    clearExistingBeforeImport: false,
    strictLikedOrder: false,
  })

  const authStatusQuery = useQuery({
    queryKey: ["authStatus"],
    queryFn: getAuthStatus,
  })

  const isAuthenticated = authStatusQuery.data?.authenticated === true

  const whoAmIQuery = useQuery({
    queryKey: ["whoami"],
    queryFn: getWhoAmI,
    enabled: isAuthenticated,
  })

  const groupedQuery = useQuery({
    queryKey: ["groupedSongs", appliedGroupFilters],
    queryFn: () => getGroupedSongs(appliedGroupFilters),
    enabled: isAuthenticated,
  })

  const languageGroupsQuery = useQuery({
    queryKey: ["languageGroups"],
    queryFn: getLanguageGroups,
    enabled: false,
  })

  const artistSearchQuery = useQuery({
    queryKey: ["artistSearch", deferredArtistSearch],
    queryFn: () => searchArtists(deferredArtistSearch),
    enabled: isAuthenticated && deferredArtistSearch.length >= 2,
    staleTime: 120_000,
  })

  useEffect(() => {
    const groups = Object.keys(groupedQuery.data?.groups ?? {})
    if (!groups.length) {
      setSelectedGroup("")
      return
    }

    if (!selectedGroup || !(selectedGroup in (groupedQuery.data?.groups ?? {}))) {
      setSelectedGroup(groups[0])
    }
  }, [groupedQuery.data, selectedGroup])

  useEffect(() => {
    const languages = Object.keys(languageGroupsQuery.data?.groups ?? {})
    if (!languages.length) {
      setSelectedLanguage("")
      return
    }

    if (!selectedLanguage || !(selectedLanguage in (languageGroupsQuery.data?.groups ?? {}))) {
      setSelectedLanguage(languages[0])
    }
  }, [languageGroupsQuery.data, selectedLanguage])

  const groupedPlaylistMutation = useMutation({
    mutationFn: () =>
      createPlaylistForGroup({
        period: appliedGroupFilters.period,
        order: appliedGroupFilters.order,
        start_year: appliedGroupFilters.startYear,
        end_year: appliedGroupFilters.endYear,
        group_key: selectedGroup,
        playlist_name: groupPlaylistName || undefined,
        playlist_description: groupPlaylistDescription || undefined,
      }),
  })

  const languagePlaylistMutation = useMutation({
    mutationFn: () =>
      createPlaylistByLanguage({
        language_code: selectedLanguage,
        playlist_name: languagePlaylistName || undefined,
        min_songs: Number(languageMinSongs) || 5,
      }),
  })

  const exportSnapshotMutation = useMutation({
    mutationFn: () =>
      exportSnapshot({
        cutoff_date: exportForm.cutoffDate ? new Date(exportForm.cutoffDate).toISOString() : undefined,
        include_playlists: exportForm.includePlaylists,
        include_liked_tracks: exportForm.includeLikedTracks,
        include_saved_albums: exportForm.includeSavedAlbums,
        include_followed_artists: exportForm.includeFollowedArtists,
        write_to_file: exportForm.writeToFile,
        output_file_name: exportForm.outputFileName || undefined,
        return_snapshot: exportForm.returnSnapshot,
      }),
  })

  const importSnapshotMutation = useMutation({
    mutationFn: () =>
      importSnapshot({
        file_path: importForm.filePath,
        import_playlists: importForm.importPlaylists,
        import_liked_tracks: importForm.importLikedTracks,
        import_saved_albums: importForm.importSavedAlbums,
        import_followed_artists: importForm.importFollowedArtists,
        clear_existing_before_import: importForm.clearExistingBeforeImport,
        strict_liked_order: importForm.strictLikedOrder,
      }),
  })

  const handleSpotifyLogin = () => {
    window.location.href = getLoginUrl()
  }

  const handleRefreshAuth = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["authStatus"] }),
      queryClient.invalidateQueries({ queryKey: ["whoami"] }),
    ])
  }

  const handleApplyGroupFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setAppliedGroupFilters({
      period: groupDraft.period,
      order: groupDraft.order,
      startYear: groupDraft.startYear ? Number(groupDraft.startYear) : undefined,
      endYear: groupDraft.endYear ? Number(groupDraft.endYear) : undefined,
    })
  }

  const handleCreateGroupedPlaylist = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void groupedPlaylistMutation.mutateAsync()
  }

  const handleCreateLanguagePlaylist = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void languagePlaylistMutation.mutateAsync()
  }

  const handleExportSnapshot = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void exportSnapshotMutation.mutateAsync()
  }

  const handleImportSnapshot = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void importSnapshotMutation.mutateAsync()
  }

  const groupedEntries = Object.entries(groupedQuery.data?.groups ?? {})
  const languageEntries = Object.entries(languageGroupsQuery.data?.groups ?? {}).sort((left, right) => {
    return right[1].length - left[1].length
  })

  return (
    <div className="container space-y-8 py-8 md:py-12">
      <section id="overview" className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="section-shell animate-fade-up overflow-hidden">
          <div className="flex flex-wrap items-center gap-3">
            <span className="hero-badge">
              <Sparkles className="h-3.5 w-3.5" />
              Basic product cockpit
            </span>
            <Badge variant={isAuthenticated ? "default" : "outline"}>
              {isAuthenticated ? "Spotify connected" : "Awaiting Spotify auth"}
            </Badge>
          </div>

          <div className="mt-6 space-y-4">
            <h1 className="max-w-3xl text-4xl leading-tight md:text-5xl">
              Shape liked songs into new playlists, language clusters, and account snapshots.
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
              This first frontend version keeps every current backend capability visible in one place, so we can
              harden flows before we split them into polished product pages.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/70 bg-white/85 p-4">
              <p className="text-sm text-muted-foreground">Auth status</p>
              <p className="mt-2 font-display text-2xl">{isAuthenticated ? "Ready" : "Needs login"}</p>
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/85 p-4">
              <p className="text-sm text-muted-foreground">Liked groups</p>
              <p className="mt-2 font-display text-2xl">{groupedEntries.length || "0"}</p>
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/85 p-4">
              <p className="text-sm text-muted-foreground">Language clusters</p>
              <p className="mt-2 font-display text-2xl">{languageEntries.length || "0"}</p>
            </div>
          </div>
        </div>

        <Card className="animate-fade-up [animation-delay:120ms]">
          <CardHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              {isAuthenticated ? <ShieldCheck className="h-6 w-6" /> : <LockOpen className="h-6 w-6" />}
            </div>
            <CardTitle>Connection status</CardTitle>
            <CardDescription>
              Spotify auth stays on the backend. The frontend only checks whether the local server session is ready.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-3xl border border-border bg-muted/45 p-4 text-sm">
              <p className="font-medium text-foreground">Authenticated</p>
              <p className="mt-1 text-muted-foreground">{isAuthenticated ? "Yes" : "No"}</p>
              <p className="mt-4 font-medium text-foreground">Token expiry</p>
              <p className="mt-1 text-muted-foreground">{formatExpiresAt(authStatusQuery.data?.expires_at)}</p>
            </div>

            {whoAmIQuery.data ? (
              <div className="rounded-3xl border border-border bg-white/70 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{whoAmIQuery.data.display_name || whoAmIQuery.data.id}</p>
                    <p className="text-sm text-muted-foreground">
                      {whoAmIQuery.data.email || "Email not available"} - {whoAmIQuery.data.country || "Unknown country"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {authStatusQuery.isError ? (
              <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {getErrorMessage(authStatusQuery.error)}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleSpotifyLogin}>
                <Disc3 className="h-4 w-4" />
                Connect Spotify
              </Button>
              <Button variant="outline" onClick={() => void handleRefreshAuth()}>
                <RefreshCcw className="h-4 w-4" />
                Refresh status
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="grouping" className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Card className="animate-fade-up [animation-delay:180ms]">
          <CardHeader>
            <CardTitle>Liked songs by time period</CardTitle>
            <CardDescription>
              Filter your liked library, inspect the generated buckets, and create a playlist from the selected slice.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleApplyGroupFilters}>
              <div className="space-y-2">
                <Label htmlFor="period">Period</Label>
                <Select
                  id="period"
                  value={groupDraft.period}
                  onChange={(event) => setGroupDraft((current) => ({ ...current, period: event.target.value }))}
                >
                  {periodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="order">Order</Label>
                <Select
                  id="order"
                  value={groupDraft.order}
                  onChange={(event) => setGroupDraft((current) => ({ ...current, order: event.target.value }))}
                >
                  {orderOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startYear">Start year</Label>
                <Input
                  id="startYear"
                  placeholder="2020"
                  value={groupDraft.startYear}
                  onChange={(event) => setGroupDraft((current) => ({ ...current, startYear: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endYear">End year</Label>
                <Input
                  id="endYear"
                  placeholder="2025"
                  value={groupDraft.endYear}
                  onChange={(event) => setGroupDraft((current) => ({ ...current, endYear: event.target.value }))}
                />
              </div>

              <div className="md:col-span-2">
                <Button className="w-full sm:w-auto" disabled={!isAuthenticated} type="submit">
                  <Music4 className="h-4 w-4" />
                  Load grouped songs
                </Button>
              </div>
            </form>

            {!isAuthenticated ? (
              <p className="rounded-2xl border border-border bg-muted/45 px-4 py-3 text-sm text-muted-foreground">
                Connect Spotify first to load your liked songs.
              </p>
            ) : null}

            {groupedQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Loading grouped library...
              </div>
            ) : null}

            {groupedQuery.isError ? (
              <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {getErrorMessage(groupedQuery.error)}
              </p>
            ) : null}

            {groupedQuery.data ? (
              <div className="rounded-3xl border border-border bg-white/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Generated groups</p>
                  <span className="text-sm text-muted-foreground">
                    {groupedEntries.length} groups - {groupedQuery.data.total_songs} total liked songs
                  </span>
                </div>

                <div className="grid max-h-[320px] gap-3 overflow-auto pr-1">
                  {groupedEntries.map(([groupKey, trackIds]) => {
                    const selected = selectedGroup === groupKey

                    return (
                      <button
                        key={groupKey}
                        className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                          selected
                            ? "border-primary bg-primary/10 shadow-glow"
                            : "border-border bg-white/80 hover:border-primary/30"
                        }`}
                        onClick={() => setSelectedGroup(groupKey)}
                        type="button"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-semibold">{groupKey}</p>
                            <p className="text-sm text-muted-foreground">{trackIds.length} tracks</p>
                          </div>
                          {selected ? <Badge>Selected</Badge> : <Badge variant="outline">Preview</Badge>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="animate-fade-up [animation-delay:220ms]">
          <CardHeader>
            <CardTitle>Create a playlist from the selected group</CardTitle>
            <CardDescription>
              Start with the backend default naming or provide a more polished public-facing title and description.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-3xl border border-border bg-muted/45 p-4">
              <p className="text-sm font-medium text-foreground">Current target</p>
              <p className="mt-2 text-lg font-semibold">{selectedGroup || "No group selected yet"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedGroup && groupedQuery.data?.groups[selectedGroup]
                  ? groupCardLabel(selectedGroup, groupedQuery.data.groups[selectedGroup])
                  : "Load groups and pick one from the list on the left."}
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleCreateGroupedPlaylist}>
              <div className="space-y-2">
                <Label htmlFor="groupPlaylistName">Playlist name</Label>
                <Input
                  id="groupPlaylistName"
                  placeholder="Leave blank to use the backend default"
                  value={groupPlaylistName}
                  onChange={(event) => setGroupPlaylistName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="groupPlaylistDescription">Playlist description</Label>
                <Textarea
                  id="groupPlaylistDescription"
                  placeholder="Optional curator note for this time slice"
                  value={groupPlaylistDescription}
                  onChange={(event) => setGroupPlaylistDescription(event.target.value)}
                />
              </div>
              <Button
                className="w-full sm:w-auto"
                disabled={!selectedGroup || groupedPlaylistMutation.isPending}
                type="submit"
              >
                {groupedPlaylistMutation.isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Create playlist
              </Button>
            </form>

            {groupedPlaylistMutation.isError ? (
              <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {getErrorMessage(groupedPlaylistMutation.error)}
              </p>
            ) : null}

            {groupedPlaylistMutation.data ? (
              <div className="rounded-3xl border border-primary/20 bg-primary/8 p-4">
                <p className="font-semibold">{groupedPlaylistMutation.data.playlist_name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {groupedPlaylistMutation.data.track_count} tracks added for {groupedPlaylistMutation.data.group_key}
                </p>
                <a
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  href={groupedPlaylistMutation.data.playlist_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open in Spotify
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section id="language" className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Card className="animate-fade-up [animation-delay:260ms]">
          <CardHeader>
            <CardTitle>Language-based playlist builder</CardTitle>
            <CardDescription>
              Ask the backend to detect languages from track and artist names, then turn a language cluster into a
              playlist.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Button
              className="w-full sm:w-auto"
              disabled={!isAuthenticated || languageGroupsQuery.isFetching}
              onClick={() => void languageGroupsQuery.refetch()}
              variant="secondary"
            >
              {languageGroupsQuery.isFetching ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Languages className="h-4 w-4" />
              )}
              Load language groups
            </Button>

            {languageGroupsQuery.isError ? (
              <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {getErrorMessage(languageGroupsQuery.error)}
              </p>
            ) : null}

            {languageEntries.length ? (
              <div className="grid max-h-[320px] gap-3 overflow-auto pr-1">
                {languageEntries.map(([languageCode, trackIds]) => {
                  const selected = selectedLanguage === languageCode

                  return (
                    <button
                      key={languageCode}
                      className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                        selected
                          ? "border-primary bg-primary/10 shadow-glow"
                          : "border-border bg-white/80 hover:border-primary/30"
                      }`}
                      onClick={() => setSelectedLanguage(languageCode)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold uppercase">{languageCode}</p>
                          <p className="text-sm text-muted-foreground">{trackIds.length} detected tracks</p>
                        </div>
                        {selected ? <Badge>Selected</Badge> : <Badge variant="outline">Use</Badge>}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="rounded-2xl border border-border bg-muted/45 px-4 py-3 text-sm text-muted-foreground">
                Load language groups to inspect the current backend output.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="animate-fade-up [animation-delay:300ms]">
          <CardHeader>
            <CardTitle>Create playlist by language</CardTitle>
            <CardDescription>
              Keep the selection tight by requiring a minimum track count before the backend creates the playlist.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-3xl border border-border bg-muted/45 p-4">
              <p className="text-sm font-medium text-foreground">Current language</p>
              <p className="mt-2 text-lg font-semibold uppercase">{selectedLanguage || "No language selected yet"}</p>
            </div>

            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateLanguagePlaylist}>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="languagePlaylistName">Playlist name</Label>
                <Input
                  id="languagePlaylistName"
                  placeholder="Optional custom playlist name"
                  value={languagePlaylistName}
                  onChange={(event) => setLanguagePlaylistName(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="languageMinSongs">Minimum songs</Label>
                <Input
                  id="languageMinSongs"
                  min="1"
                  type="number"
                  value={languageMinSongs}
                  onChange={(event) => setLanguageMinSongs(event.target.value)}
                />
              </div>

              <div className="flex items-end">
                <Button className="w-full" disabled={!selectedLanguage || languagePlaylistMutation.isPending} type="submit">
                  {languagePlaylistMutation.isPending ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Create language playlist
                </Button>
              </div>
            </form>

            {languagePlaylistMutation.isError ? (
              <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {getErrorMessage(languagePlaylistMutation.error)}
              </p>
            ) : null}

            {languagePlaylistMutation.data ? (
              <div className="rounded-3xl border border-primary/20 bg-primary/8 p-4">
                <p className="font-semibold">{languagePlaylistMutation.data.playlist_name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {languagePlaylistMutation.data.track_count} tracks added for language{" "}
                  {languagePlaylistMutation.data.language?.toUpperCase()}
                </p>
                <a
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  href={languagePlaylistMutation.data.playlist_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open in Spotify
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section id="snapshots" className="grid gap-6 xl:grid-cols-2">
        <Card className="animate-fade-up [animation-delay:340ms]">
          <CardHeader>
            <CardTitle>Export account snapshot</CardTitle>
            <CardDescription>
              Capture playlists, liked tracks, saved albums, and followed artists into a reusable export file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form className="space-y-4" onSubmit={handleExportSnapshot}>
              <div className="space-y-2">
                <Label htmlFor="cutoffDate">Cutoff date</Label>
                <Input
                  id="cutoffDate"
                  type="datetime-local"
                  value={exportForm.cutoffDate}
                  onChange={(event) => setExportForm((current) => ({ ...current, cutoffDate: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="outputFileName">Output file name</Label>
                <Input
                  id="outputFileName"
                  placeholder="snapshot-2026-03-25.json"
                  value={exportForm.outputFileName}
                  onChange={(event) => setExportForm((current) => ({ ...current, outputFileName: event.target.value }))}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {exportToggleFields.map(({ label, key }) => (
                  <label
                    key={key}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-white/70 px-4 py-3 text-sm"
                  >
                    <Checkbox
                      checked={exportForm[key]}
                      onChange={(event) =>
                        setExportForm((current) => ({
                          ...current,
                          [key]: event.target.checked,
                        }))
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              <Button className="w-full sm:w-auto" disabled={!isAuthenticated || exportSnapshotMutation.isPending} type="submit">
                {exportSnapshotMutation.isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Export snapshot
              </Button>
            </form>

            {exportSnapshotMutation.isError ? (
              <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {getErrorMessage(exportSnapshotMutation.error)}
              </p>
            ) : null}

            {exportSnapshotMutation.data ? (
              <div className="rounded-3xl border border-border bg-muted/45 p-4 text-sm">
                <p className="font-semibold text-foreground">{exportSnapshotMutation.data.message}</p>
                <p className="mt-1 text-muted-foreground">
                  File path: {exportSnapshotMutation.data.file_path || "No file written"}
                </p>
                <pre className="mt-4 overflow-auto rounded-2xl bg-foreground/[0.04] p-4 text-xs text-foreground/80">
                  {JSON.stringify(exportSnapshotMutation.data.counts, null, 2)}
                </pre>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="animate-fade-up [animation-delay:380ms]">
          <CardHeader>
            <CardTitle>Import account snapshot</CardTitle>
            <CardDescription>
              Point the backend at an existing snapshot file and choose how aggressively it should apply the import.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form className="space-y-4" onSubmit={handleImportSnapshot}>
              <div className="space-y-2">
                <Label htmlFor="filePath">Snapshot file path</Label>
                <Input
                  id="filePath"
                  placeholder="backend/exports/my-source-account-snapshot.json"
                  value={importForm.filePath}
                  onChange={(event) => setImportForm((current) => ({ ...current, filePath: event.target.value }))}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {importToggleFields.map(({ label, key }) => (
                  <label
                    key={key}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-white/70 px-4 py-3 text-sm"
                  >
                    <Checkbox
                      checked={importForm[key]}
                      onChange={(event) =>
                        setImportForm((current) => ({
                          ...current,
                          [key]: event.target.checked,
                        }))
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              <Button
                className="w-full sm:w-auto"
                disabled={!isAuthenticated || !importForm.filePath || importSnapshotMutation.isPending}
                type="submit"
                variant="secondary"
              >
                {importSnapshotMutation.isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Import snapshot
              </Button>
            </form>

            {importSnapshotMutation.isError ? (
              <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {getErrorMessage(importSnapshotMutation.error)}
              </p>
            ) : null}

            {importSnapshotMutation.data ? (
              <div className="rounded-3xl border border-border bg-muted/45 p-4 text-sm">
                <p className="font-semibold text-foreground">{importSnapshotMutation.data.message}</p>
                <pre className="mt-4 overflow-auto rounded-2xl bg-foreground/[0.04] p-4 text-xs text-foreground/80">
                  {JSON.stringify(importSnapshotMutation.data.result, null, 2)}
                </pre>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section id="search" className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="animate-fade-up [animation-delay:420ms]">
          <CardHeader>
            <CardTitle>Artist lookup</CardTitle>
            <CardDescription>
              A lightweight example of a search-heavy screen powered by TanStack Query and a deferred input value.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="artistSearch">Search artists</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="artistSearch"
                  className="pl-11"
                  placeholder="Try Mitski, Mahmood, or Rosalia"
                  value={artistSearch}
                  onChange={(event) => setArtistSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-muted/45 px-4 py-3 text-sm text-muted-foreground">
              {deferredArtistSearch.length < 2
                ? "Type at least two characters to start the search."
                : artistSearchQuery.isFetching
                  ? "Searching Spotify artists..."
                  : `Showing results for "${deferredArtistSearch}".`}
            </div>

            {artistSearchQuery.isError ? (
              <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {getErrorMessage(artistSearchQuery.error)}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="animate-fade-up [animation-delay:460ms]">
          <CardHeader>
            <CardTitle>Search results</CardTitle>
            <CardDescription>
              This section stays intentionally simple for now, but it already matches the backend payload structure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {artistSearchQuery.data?.artists.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {artistSearchQuery.data.artists.map((artist) => (
                  <article key={artist.id} className="rounded-3xl border border-border bg-white/80 p-4">
                    <div className="flex gap-4">
                      <div className="h-20 w-20 overflow-hidden rounded-2xl bg-secondary">
                        {artist.image_url ? (
                          <img className="h-full w-full object-cover" src={artist.image_url} alt={artist.name} />
                        ) : (
                          <div className="flex h-full items-center justify-center text-secondary-foreground">
                            <Disc3 className="h-7 w-7" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-semibold">{artist.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">Popularity: {artist.popularity ?? "N/A"}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {artist.genres.slice(0, 3).map((genre) => (
                            <Badge key={genre} variant="secondary">
                              {genre}
                            </Badge>
                          ))}
                        </div>
                        <a
                          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                          href={artist.spotify_url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Open artist
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-border bg-muted/45 px-5 py-10 text-center text-sm text-muted-foreground">
                {deferredArtistSearch.length >= 2
                  ? "No artists found for the current search."
                  : "Search results will appear here once you start typing."}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
