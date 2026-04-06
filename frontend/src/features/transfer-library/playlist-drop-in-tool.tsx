import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { ArrowRight, CheckCircle2, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { appendPlaylist, getCurrentUserPlaylists } from "@/lib/api"
import type { AppendPlaylistResponse, PlaylistSummary } from "@/lib/types"
import { AuthRequiredNotice } from "@/features/spotify/auth-required-notice"
import { getErrorMessage, useSpotifySession } from "@/features/spotify/use-spotify-session"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"

function formatPlaylistTrackCount(trackCount?: number | null) {
  if (typeof trackCount !== "number") {
    return "Track count unavailable"
  }

  return `${trackCount} track${trackCount === 1 ? "" : "s"}`
}

function PlaylistAppendWarningList({ warnings }: { warnings: string[] }) {
  if (!warnings.length) {
    return null
  }

  return (
    <div className="rounded-3xl border border-accent/35 bg-accent/10 p-4 text-sm text-foreground">
      <p className="font-semibold">Review these notes</p>
      <div className="mt-3 grid gap-2">
        {warnings.map((warning) => (
          <div key={warning} className="rounded-2xl border border-border bg-white/70 px-3 py-2">
            {warning}
          </div>
        ))}
      </div>
    </div>
  )
}

function PlaylistCard({
  eyebrow,
  title,
  subtitle,
  spotifyUrl,
}: {
  eyebrow: string
  title: string
  subtitle: string
  spotifyUrl?: string | null
}) {
  return (
    <div className="rounded-3xl border border-border bg-white/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
      <p className="mt-3 text-lg font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      {spotifyUrl ? (
        <a
          className="mt-3 inline-flex items-center gap-2 text-sm text-primary hover:underline"
          href={spotifyUrl}
          rel="noreferrer"
          target="_blank"
        >
          Open in Spotify
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </div>
  )
}

function ResultSummary({ result }: { result: AppendPlaylistResponse }) {
  return (
    <div className="space-y-4 rounded-[28px] border border-primary/20 bg-primary/8 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-2xl bg-primary/12 p-2 text-primary">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-foreground">Playlist added</p>
          <p className="mt-1 text-sm text-muted-foreground">{result.message}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-white/80 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Tracks added</p>
          <p className="mt-2 text-2xl font-display text-foreground">{result.tracks_added}</p>
        </div>
        <div className="rounded-2xl border border-border bg-white/80 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Tracks skipped</p>
          <p className="mt-2 text-2xl font-display text-foreground">{result.skipped_tracks}</p>
        </div>
      </div>

      <PlaylistAppendWarningList warnings={result.warnings} />
    </div>
  )
}

export function PlaylistDropInTool() {
  const queryClient = useQueryClient()
  const {
    handleSpotifyLogin,
    isAuthenticated,
    whoAmIQuery,
  } = useSpotifySession({
    accountRole: "target",
    returnTo: "/app/transfer-library",
  })

  const [sourcePlaylistId, setSourcePlaylistId] = useState("")
  const [targetType, setTargetType] = useState<"liked_tracks" | "playlist">("liked_tracks")
  const [targetPlaylistId, setTargetPlaylistId] = useState("")

  const playlistsQuery = useQuery({
    queryKey: ["playlists", "target"],
    queryFn: () => getCurrentUserPlaylists("target"),
    enabled: isAuthenticated,
    staleTime: 60_000,
    retry: false,
  })

  const playlists = playlistsQuery.data?.playlists ?? []

  useEffect(() => {
    if (!playlists.length) {
      setSourcePlaylistId("")
      setTargetPlaylistId("")
      return
    }

    if (!sourcePlaylistId || !playlists.some((playlist) => playlist.id === sourcePlaylistId)) {
      setSourcePlaylistId(playlists[0].id)
    }
  }, [playlists, sourcePlaylistId])

  useEffect(() => {
    if (targetType !== "playlist") {
      if (targetPlaylistId) {
        setTargetPlaylistId("")
      }
      return
    }

    const playlistTargetOptions = playlists.filter((playlist) => playlist.id !== sourcePlaylistId)
    if (!playlistTargetOptions.length) {
      setTargetPlaylistId("")
      return
    }

    if (!targetPlaylistId || !playlistTargetOptions.some((playlist) => playlist.id === targetPlaylistId)) {
      setTargetPlaylistId(playlistTargetOptions[0].id)
    }
  }, [playlists, sourcePlaylistId, targetPlaylistId, targetType])

  const sourcePlaylist = playlists.find((playlist) => playlist.id === sourcePlaylistId) ?? null
  const playlistTargetOptions = playlists.filter((playlist) => playlist.id !== sourcePlaylistId)
  const selectedTargetPlaylist = playlistTargetOptions.find((playlist) => playlist.id === targetPlaylistId) ?? null
  const canSubmit = Boolean(sourcePlaylistId) && (targetType === "liked_tracks" || Boolean(targetPlaylistId))

  const appendPlaylistMutation = useMutation({
    mutationFn: () =>
      appendPlaylist(
        {
          source_playlist_id: sourcePlaylistId,
          target_type: targetType,
          target_playlist_id: targetType === "playlist" ? targetPlaylistId : undefined,
        },
        "target",
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["playlists", "target"] })
    },
  })

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) {
      return
    }

    void appendPlaylistMutation.mutateAsync()
  }

  const connectedAccountName = whoAmIQuery.data?.display_name || whoAmIQuery.data?.id || "Connect the import account"
  const destinationTitle = targetType === "liked_tracks" ? "Liked Songs" : selectedTargetPlaylist?.name || "Choose a playlist"
  const destinationSubtitle =
    targetType === "liked_tracks"
      ? "Newly saved songs will appear at the top of your Liked Songs list."
      : selectedTargetPlaylist
        ? `${formatPlaylistTrackCount(selectedTargetPlaylist.track_count)} before the drop-in`
        : "Pick another playlist in this same account."

  const handleSourceChange = (nextPlaylistId: string) => {
    setSourcePlaylistId(nextPlaylistId)
    appendPlaylistMutation.reset()
  }

  const handleTargetTypeChange = (nextTargetType: "liked_tracks" | "playlist") => {
    setTargetType(nextTargetType)
    appendPlaylistMutation.reset()
  }

  const handleTargetPlaylistChange = (nextPlaylistId: string) => {
    setTargetPlaylistId(nextPlaylistId)
    appendPlaylistMutation.reset()
  }

  return (
    <section id="playlist-drop-in-tool" className="section-shell animate-fade-up overflow-hidden">
      <div className="flex flex-wrap items-center gap-3">
        <span className="hero-badge">Quick Add-On</span>
        <Badge variant={appendPlaylistMutation.data ? "default" : "outline"}>
          {appendPlaylistMutation.data ? "Playlist added" : "One playlist at a time"}
        </Badge>
      </div>

      <div className="mt-6 space-y-4">
        <h2 className="max-w-3xl text-3xl leading-tight md:text-4xl">Drop one playlist into Liked Songs or another playlist.</h2>
        <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
          This works inside the connected import account. Make a playlist on your phone or in Time Machine, then use
          this page to push that one playlist into Liked Songs or another playlist with the new songs landing at the
          top of the target playlist.
        </p>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[30px] border border-white/10 bg-white/5 p-5 shadow-panel">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/55">Single-source move</p>
            <h3 className="text-2xl font-semibold">Choose one source playlist and one destination</h3>
            <p className="text-sm text-muted-foreground">
              Multi-playlist batching stays off here on purpose, so every run is one playlist into one target only.
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <PlaylistCard
              eyebrow="Connected account"
              title={connectedAccountName}
              subtitle={whoAmIQuery.data?.email || whoAmIQuery.data?.country || "Uses the same import account as the snapshot flow above."}
              spotifyUrl={whoAmIQuery.data?.profile_url}
            />
            <PlaylistCard
              eyebrow="Current destination"
              title={destinationTitle}
              subtitle={destinationSubtitle}
              spotifyUrl={selectedTargetPlaylist?.spotify_url || (targetType === "liked_tracks" ? "https://open.spotify.com/collection/tracks" : null)}
            />
          </div>

          {!isAuthenticated ? (
            <div className="mt-5 space-y-4">
              <AuthRequiredNotice message="Connect the import account before choosing playlists for the quick add-on flow." />
              <Button onClick={handleSpotifyLogin} variant="outline">
                <RefreshCw className="h-4 w-4" />
                Connect import account
              </Button>
            </div>
          ) : null}

          {isAuthenticated ? (
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="playlistDropInSource">Source playlist</Label>
                <Select
                  id="playlistDropInSource"
                  disabled={!playlists.length || playlistsQuery.isPending}
                  value={sourcePlaylistId}
                  onChange={(event) => handleSourceChange(event.target.value)}
                >
                  {playlists.length ? null : <option value="">No playlists available in this account</option>}
                  {playlists.map((playlist) => (
                    <option key={playlist.id} value={playlist.id}>
                      {playlist.name} - {formatPlaylistTrackCount(playlist.track_count)}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="playlistDropInTargetType">Add into</Label>
                  <Select
                    id="playlistDropInTargetType"
                    value={targetType}
                    onChange={(event) => handleTargetTypeChange(event.target.value as "liked_tracks" | "playlist")}
                  >
                    <option value="liked_tracks">Liked Songs</option>
                    <option value="playlist">Another playlist</option>
                  </Select>
                </div>

                {targetType === "playlist" ? (
                  <div className="space-y-2">
                    <Label htmlFor="playlistDropInTargetPlaylist">Target playlist</Label>
                    <Select
                      id="playlistDropInTargetPlaylist"
                      disabled={!playlistTargetOptions.length}
                      value={targetPlaylistId}
                      onChange={(event) => handleTargetPlaylistChange(event.target.value)}
                    >
                      {playlistTargetOptions.length ? null : <option value="">No second playlist available</option>}
                      {playlistTargetOptions.map((playlist) => (
                        <option key={playlist.id} value={playlist.id}>
                          {playlist.name} - {formatPlaylistTrackCount(playlist.track_count)}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : null}
              </div>

              {targetType === "playlist" && !playlistTargetOptions.length ? (
                <p className="rounded-2xl border border-border bg-white/70 px-4 py-3 text-sm text-muted-foreground">
                  You need at least two playlists in this account to move one playlist into another playlist.
                </p>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={playlistsQuery.isPending}
                  onClick={() => {
                    appendPlaylistMutation.reset()
                    void playlistsQuery.refetch()
                  }}
                  type="button"
                  variant="outline"
                >
                  {playlistsQuery.isFetching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh playlists
                </Button>

                <Button
                  disabled={!canSubmit || appendPlaylistMutation.isPending || playlistsQuery.isPending}
                  type="submit"
                >
                  {appendPlaylistMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Add playlist into target
                </Button>
              </div>
            </form>
          ) : null}

          {playlistsQuery.isError ? (
            <p className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {getErrorMessage(playlistsQuery.error)}
            </p>
          ) : null}

          {appendPlaylistMutation.isError ? (
            <p className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {getErrorMessage(appendPlaylistMutation.error)}
            </p>
          ) : null}
        </div>

        <div className="rounded-[30px] border border-white/10 bg-white/5 p-5 shadow-panel">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/55">Live summary</p>
            <h3 className="text-2xl font-semibold">Check the source, then fire the one-shot add</h3>
            <p className="text-sm text-muted-foreground">
              The selected source playlist stays untouched. When the destination is another playlist, its new songs are
              inserted at the top instead of the bottom.
            </p>
          </div>

          <div className="mt-6 rounded-[28px] border border-white/10 bg-background/35 p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
              <PlaylistCard
                eyebrow="From"
                title={sourcePlaylist?.name || "Choose a source playlist"}
                subtitle={sourcePlaylist ? formatPlaylistTrackCount(sourcePlaylist.track_count) : "The source playlist will come from the connected import account."}
                spotifyUrl={sourcePlaylist?.spotify_url}
              />
              <div className="flex items-center justify-center text-primary">
                <ArrowRight className="h-5 w-5" />
              </div>
              <PlaylistCard
                eyebrow="Into"
                title={destinationTitle}
                subtitle={destinationSubtitle}
                spotifyUrl={selectedTargetPlaylist?.spotify_url || (targetType === "liked_tracks" ? "https://open.spotify.com/collection/tracks" : null)}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Available playlists</p>
              <p className="mt-2 text-2xl font-display text-foreground">{playlists.length}</p>
            </div>
            <div className="rounded-2xl border border-border bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Source tracks</p>
              <p className="mt-2 text-2xl font-display text-foreground">{sourcePlaylist?.track_count ?? 0}</p>
            </div>
          </div>

          {appendPlaylistMutation.data ? (
            <div className="mt-5">
              <ResultSummary result={appendPlaylistMutation.data} />
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-muted-foreground">
              Pick the playlist and destination on the left, then the result will show up here after the add finishes.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
