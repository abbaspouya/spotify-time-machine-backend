import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CalendarRange, ExternalLink, LoaderCircle, Music2, RefreshCcw, TrendingUp } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getErrorMessage } from "@/features/spotify/use-spotify-session"
import { getTopTracks } from "@/lib/api"
import type { TopTrack, TopTracksRequest, TopTracksTimeframeKey } from "@/lib/types"
import { cn } from "@/lib/utils"

const presetOptions: Array<{ key: TopTracksTimeframeKey; label: string }> = [
  { key: "1_week", label: "1 Week" },
  { key: "4_weeks", label: "4 Weeks" },
  { key: "6_months", label: "6 Months" },
  { key: "lifetime", label: "Lifetime" },
]

const requiredScopes = ["user-top-read", "user-read-recently-played"] as const

function hasRequiredTopTrackScopes(scope: string | null | undefined) {
  const availableScopes = new Set((scope || "").split(/\s+/).filter(Boolean))
  return requiredScopes.every((requiredScope) => availableScopes.has(requiredScope))
}

function formatArtists(track: TopTrack) {
  return track.artist_names.length > 0 ? track.artist_names.join(", ") : "Unknown artist"
}

function formatWindowMeta(days?: number | null) {
  if (!days) {
    return "Spotify top tracks"
  }

  return days === 1 ? "Last 1 day" : `Last ${days} days`
}

type TopTracksRecapProps = {
  displayName?: string | null
  scope?: string | null
  canLoad?: boolean
  blockedError?: unknown
  onReconnect: () => void
  onRetrySession?: () => void
}

export function TopTracksRecap({
  displayName,
  scope,
  canLoad = true,
  blockedError,
  onReconnect,
  onRetrySession,
}: TopTracksRecapProps) {
  const [request, setRequest] = useState<TopTracksRequest>({ timeframe: "4_weeks", limit: 50 })

  const topTracksEnabled = hasRequiredTopTrackScopes(scope)

  const topTracksQuery = useQuery({
    queryKey: ["topTracks", request.timeframe, request.limit ?? 50],
    queryFn: () => getTopTracks(request),
    enabled: topTracksEnabled && canLoad,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const selectedLabel =
    topTracksQuery.data?.selected_timeframe.label ||
    presetOptions.find((option) => option.key === request.timeframe)?.label ||
    "4 Weeks"

  const featuredTrack = topTracksQuery.data?.tracks[0]

  const applyPreset = (timeframe: TopTracksTimeframeKey) => {
    setRequest({ timeframe, limit: 50 })
  }

  return (
    <section className="animate-fade-up">
      <Card className="overflow-hidden border-white/10 bg-card/90">
        <CardHeader className="gap-6 border-b border-white/10 pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="hero-badge">Listening recap</span>
              <Badge variant="outline">50-track view</Badge>
            </div>

            <div className="space-y-2">
              <CardTitle className="text-3xl md:text-4xl">Top songs</CardTitle>
              <CardDescription className="max-w-2xl text-sm md:text-base">
                Start the dashboard with the songs you are returning to most, then jump into Time Machine or transfer
                work after you have a feel for the account.
              </CardDescription>
            </div>

            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span className="metric-pill">{displayName ? `${displayName}'s listening` : "Your listening"}</span>
              <span className="metric-pill">{selectedLabel}</span>
              <span className="metric-pill">{request.limit ?? 50} tracks</span>
            </div>
          </div>

          <div className="w-full max-w-xl space-y-3">
            <div className="rounded-[30px] border border-white/10 bg-white/5 p-2">
              <div className="grid gap-2 sm:grid-cols-4">
                {presetOptions.map((option) => {
                  const isActive = request.timeframe === option.key

                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => applyPreset(option.key)}
                      className={cn(
                        "rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
                        isActive ? "bg-primary text-primary-foreground shadow-glow" : "bg-transparent text-foreground/72 hover:bg-white/5 hover:text-foreground",
                      )}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-6">
          {!topTracksEnabled ? (
            <div className="rounded-[30px] border border-primary/20 bg-primary/10 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-foreground">Reconnect Spotify to unlock top songs.</p>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    This recap needs the newer `user-top-read` and `user-read-recently-played` scopes. Reconnect once
                    and the dashboard can load the recap cards.
                  </p>
                </div>
                <Button onClick={onReconnect}>Reconnect Spotify</Button>
              </div>
            </div>
          ) : !canLoad ? (
            <div className="rounded-[30px] border border-white/10 bg-white/5 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-foreground">
                    {blockedError ? "Top songs are waiting on your Spotify profile." : "Confirming your Spotify profile first."}
                  </p>
                  <p className={cn("text-sm", blockedError ? "text-destructive" : "text-muted-foreground")}>
                    {blockedError
                      ? getErrorMessage(blockedError)
                      : "Once the active account finishes loading, the dashboard will request top songs."}
                  </p>
                </div>
                {blockedError ? (
                  <Button variant="outline" onClick={onRetrySession}>
                    <RefreshCcw className="h-4 w-4" />
                    Retry session
                  </Button>
                ) : (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Loading profile
                  </div>
                )}
              </div>
            </div>
          ) : topTracksQuery.isPending ? (
            <div className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
              <div className="rounded-[34px] bg-[linear-gradient(135deg,rgba(29,185,84,0.26),rgba(255,255,255,0.06),rgba(15,23,42,0.86))] p-5">
                <div className="flex items-center gap-3 text-white">
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  <p className="font-medium">Loading your top tracks...</p>
                </div>
                <div className="mt-5 h-56 animate-pulse rounded-[28px] bg-white/10" />
              </div>

              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-32 animate-pulse rounded-[28px] border border-white/10 bg-white/5" />
                  ))}
                </div>
                <div className="overflow-x-auto pb-2">
                  <div className="grid grid-flow-col auto-cols-[170px] gap-4">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="h-[292px] animate-pulse rounded-[28px] border border-white/10 bg-white/5" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : topTracksQuery.isError ? (
            <div className="rounded-[30px] border border-destructive/20 bg-destructive/10 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-foreground">Top songs could not load right now.</p>
                  <p className="text-sm text-destructive">{getErrorMessage(topTracksQuery.error)}</p>
                </div>
                <Button variant="outline" onClick={() => void topTracksQuery.refetch()}>
                  <RefreshCcw className="h-4 w-4" />
                  Try again
                </Button>
              </div>
            </div>
          ) : topTracksQuery.data.tracks.length === 0 ? (
            <div className="rounded-[30px] border border-white/10 bg-white/5 p-5">
              <p className="text-lg font-semibold text-foreground">No top-song data came back for this window.</p>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Try another preset. Recent-play windows only work when Spotify has plays in that range.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
                <div className="overflow-hidden rounded-[34px] bg-[linear-gradient(135deg,#1db954,#1f2937_46%,#0f172a)] p-5 text-white shadow-[0_28px_70px_rgba(0,0,0,0.24)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">Current number one</p>

                  <div className="mt-5 flex flex-col gap-5 sm:flex-row">
                    <div className="h-32 w-32 overflow-hidden rounded-[28px] bg-white/12">
                      {featuredTrack?.album_image_url ? (
                        <img
                          src={featuredTrack.album_image_url}
                          alt={featuredTrack.name || "Top track cover"}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-white/70">
                          <Music2 className="h-9 w-9" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/15 bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
                          {topTracksQuery.data.selected_timeframe.label}
                        </span>
                        <span className="rounded-full border border-white/15 bg-white/12 px-3 py-1 text-xs font-medium text-white/80">
                          {formatWindowMeta(topTracksQuery.data.selected_timeframe.days)}
                        </span>
                      </div>

                      <p className="mt-4 truncate text-3xl font-semibold leading-tight">{featuredTrack?.name || "Unknown track"}</p>
                      <p className="mt-2 truncate text-base text-white/80">{featuredTrack ? formatArtists(featuredTrack) : "Unknown artist"}</p>
                      <p className="mt-1 truncate text-sm text-white/60">{featuredTrack?.album_name || "Unknown album"}</p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-900">
                          #{featuredTrack?.rank ?? 1}
                        </span>
                        {featuredTrack?.play_count ? (
                          <span className="rounded-full border border-white/15 bg-white/12 px-3 py-1.5 text-xs font-medium text-white/80">
                            {featuredTrack.play_count} plays
                          </span>
                        ) : (
                          <span className="rounded-full border border-white/15 bg-white/12 px-3 py-1.5 text-xs font-medium text-white/80">
                            Spotify rank
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[28px] border border-white/10 bg-white/5 p-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/55">Window</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{topTracksQuery.data.selected_timeframe.label}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{topTracksQuery.data.selected_timeframe.description}</p>
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-white/5 p-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                      <Music2 className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/55">Loaded</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{topTracksQuery.data.track_count}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {topTracksQuery.data.total_unique_tracks} distinct tracks ranked for this selection.
                    </p>
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-white/5 p-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                      <CalendarRange className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/55">Source</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {topTracksQuery.data.scanned_plays ?? "Spotify"}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {topTracksQuery.data.scanned_plays
                        ? `${topTracksQuery.data.scanned_plays} plays scanned in the recent window.`
                        : topTracksQuery.data.source_note}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="metric-pill">{topTracksQuery.data.source_note}</span>
                {topTracksQuery.data.is_partial ? <span className="metric-pill">Recent-play window is partial</span> : null}
                {topTracksQuery.data.selected_timeframe.disclaimer ? (
                  <span className="metric-pill">{topTracksQuery.data.selected_timeframe.disclaimer}</span>
                ) : null}
              </div>

              <div className="overflow-x-auto pb-2">
                <div className="grid grid-flow-col auto-cols-[178px] gap-4">
                  {topTracksQuery.data.tracks.map((track) => (
                    <div
                      key={`${track.rank}-${track.id || track.name || "track"}`}
                      className="group rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-3 transition-transform duration-200 hover:-translate-y-1"
                    >
                      <div className="relative overflow-hidden rounded-[24px] bg-secondary/80">
                        <div className="aspect-square">
                          {track.album_image_url ? (
                            <img
                              src={track.album_image_url}
                              alt={track.name || "Track cover"}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-foreground/45">
                              <Music2 className="h-8 w-8" />
                            </div>
                          )}
                        </div>

                        {track.spotify_url ? (
                          <a
                            href={track.spotify_url}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-background/75 text-foreground/80 backdrop-blur transition-colors hover:bg-background hover:text-foreground"
                            aria-label={`Open ${track.name || "track"} on Spotify`}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : null}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-primary">#{track.rank}</p>
                        {track.play_count ? (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-foreground/70">
                            {track.play_count} plays
                          </span>
                        ) : (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-foreground/55">
                            Spotify rank
                          </span>
                        )}
                      </div>

                      <div className="mt-3 space-y-1">
                        <p className="truncate font-semibold text-foreground">{track.name || "Unknown track"}</p>
                        <p className="truncate text-sm text-muted-foreground">{formatArtists(track)}</p>
                        <p className="truncate text-xs text-foreground/55">{track.album_name || "Unknown album"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
