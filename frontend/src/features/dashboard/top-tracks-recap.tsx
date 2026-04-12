import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, ExternalLink, LayoutGrid, List, LoaderCircle, Music2, RefreshCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
const DEFAULT_TRACKS_PER_PAGE = 5

function getTracksPerPage(viewportWidth: number) {
  if (viewportWidth >= 1280) {
    return 7
  }

  if (viewportWidth >= 1024) {
    return 5
  }

  if (viewportWidth >= 768) {
    return 4
  }

  if (viewportWidth >= 640) {
    return 3
  }

  return 2
}

function getInitialTracksPerPage() {
  if (typeof window === "undefined") {
    return DEFAULT_TRACKS_PER_PAGE
  }

  return getTracksPerPage(window.innerWidth)
}

function hasRequiredTopTrackScopes(scope: string | null | undefined) {
  const availableScopes = new Set((scope || "").split(/\s+/).filter(Boolean))
  return requiredScopes.every((requiredScope) => availableScopes.has(requiredScope))
}

function formatArtists(track: TopTrack) {
  return track.artist_names.length > 0 ? track.artist_names.join(", ") : "Unknown artist"
}

type TopTracksRecapProps = {
  scope?: string | null
  canLoad?: boolean
  blockedError?: unknown
  onReconnect: () => void
  onRetrySession?: () => void
}

export function TopTracksRecap({
  scope,
  canLoad = true,
  blockedError,
  onReconnect,
  onRetrySession,
}: TopTracksRecapProps) {
  const [request, setRequest] = useState<TopTracksRequest>({ timeframe: "4_weeks", limit: 50 })
  const [isExpanded, setIsExpanded] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageDirection, setPageDirection] = useState<"forward" | "backward">("forward")
  const [tracksPerPage, setTracksPerPage] = useState(getInitialTracksPerPage)

  const topTracksEnabled = hasRequiredTopTrackScopes(scope)

  const topTracksQuery = useQuery({
    queryKey: ["topTracks", request.timeframe, request.limit ?? 50],
    queryFn: () => getTopTracks(request),
    enabled: topTracksEnabled && canLoad,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const featuredTrack = topTracksQuery.data?.tracks[0]
  const tracks = topTracksQuery.data?.tracks ?? []
  const selectedTimeframeLabel =
    topTracksQuery.data?.selected_timeframe.label ||
    presetOptions.find((option) => option.key === request.timeframe)?.label ||
    "4 Weeks"
  const totalPages = Math.max(1, Math.ceil(tracks.length / tracksPerPage))
  const currentPageStart = pageIndex * tracksPerPage
  const visibleTracks = isExpanded ? tracks : tracks.slice(currentPageStart, currentPageStart + tracksPerPage)
  const gallerySubtitle = isExpanded
    ? `Showing all ${tracks.length} tracks for ${selectedTimeframeLabel}.`
    : `Showing ${Math.min(currentPageStart + 1, tracks.length)}-${Math.min(currentPageStart + tracksPerPage, tracks.length)} of ${tracks.length} tracks for ${selectedTimeframeLabel}.`

  const applyPreset = (timeframe: TopTracksTimeframeKey) => {
    setRequest({ timeframe, limit: 50 })
    setPageDirection("forward")
    setPageIndex(0)
  }

  const showPreviousPage = () => {
    setPageDirection("backward")
    setPageIndex((currentPage) => Math.max(0, currentPage - 1))
  }

  const showNextPage = () => {
    setPageDirection("forward")
    setPageIndex((currentPage) => Math.min(totalPages - 1, currentPage + 1))
  }

  const toggleExpanded = () => {
    setIsExpanded((expanded) => !expanded)
    setPageDirection("forward")
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined
    }

    const syncTracksPerPage = () => {
      setTracksPerPage(getTracksPerPage(window.innerWidth))
    }

    syncTracksPerPage()
    window.addEventListener("resize", syncTracksPerPage)

    return () => {
      window.removeEventListener("resize", syncTracksPerPage)
    }
  }, [])

  useEffect(() => {
    setPageIndex((currentPage) => Math.min(currentPage, totalPages - 1))
  }, [totalPages])

  return (
    <section className="animate-fade-up">
      <Card className="overflow-hidden border-white/10 bg-card/90">
        <CardHeader className="border-b border-white/10 pb-5">
          <div className="flex w-full justify-end">
            <div className="w-full max-w-xl">
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
            <div className="space-y-6">
              <div className="rounded-[34px] bg-[linear-gradient(135deg,rgba(29,185,84,0.26),rgba(255,255,255,0.06),rgba(15,23,42,0.86))] p-5">
                <div className="flex items-center gap-3 text-white">
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  <p className="font-medium">Loading your top tracks...</p>
                </div>
                <div className="mt-5 h-56 animate-pulse rounded-[28px] bg-white/10" />
              </div>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                  <div className="h-8 w-40 animate-pulse rounded-full bg-white/10" />
                  <div className="h-4 w-72 animate-pulse rounded-full bg-white/10" />
                </div>

                <div className="flex gap-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-11 w-11 animate-pulse rounded-full border border-white/10 bg-white/5" />
                  ))}
                </div>
              </div>

              <div className="grid gap-x-4 gap-y-8 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
                {Array.from({ length: tracksPerPage }).map((_, index) => (
                  <div key={index} className="space-y-3">
                    <div className="aspect-square animate-pulse rounded-[24px] border border-white/10 bg-white/5" />
                    <div className="h-5 animate-pulse rounded-full bg-white/10" />
                    <div className="h-4 w-3/4 animate-pulse rounded-full bg-white/10" />
                  </div>
                ))}
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
              <div>
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
                      <p className="truncate text-3xl font-semibold leading-tight">{featuredTrack?.name || "Unknown track"}</p>
                      <p className="mt-2 truncate text-base text-white/80">{featuredTrack ? formatArtists(featuredTrack) : "Unknown artist"}</p>
                      <p className="mt-1 truncate text-sm text-white/60">{featuredTrack?.album_name || "Unknown album"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6 rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-semibold text-foreground">Top tracks</h2>
                    <p className="text-sm text-muted-foreground">{gallerySubtitle}</p>
                  </div>

                  <div className="flex items-center gap-2 self-start">
                    <button
                      type="button"
                      onClick={toggleExpanded}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-foreground/75 transition-colors hover:bg-white/10 hover:text-foreground"
                      aria-label={isExpanded ? "Switch to paged top tracks view" : "Show all top tracks"}
                      title={isExpanded ? "Switch to paged top tracks view" : "Show all top tracks"}
                    >
                      {isExpanded ? <List className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}
                    </button>

                    <button
                      type="button"
                      onClick={showPreviousPage}
                      disabled={isExpanded || pageIndex === 0}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-foreground/75 transition-colors hover:bg-white/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Show previous top tracks page"
                      title="Show previous top tracks page"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    <button
                      type="button"
                      onClick={showNextPage}
                      disabled={isExpanded || pageIndex >= totalPages - 1}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-foreground/75 transition-colors hover:bg-white/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Show next top tracks page"
                      title="Show next top tracks page"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div
                  key={isExpanded ? `expanded-${selectedTimeframeLabel}` : `page-${pageIndex}-${selectedTimeframeLabel}`}
                  className="grid gap-x-4 gap-y-8 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7"
                >
                  {visibleTracks.map((track, index) => (
                    <div
                      key={`${track.rank}-${track.id || track.name || "track"}`}
                      className={cn(
                        "group min-w-0",
                        pageDirection === "forward" ? "animate-track-page-in-right" : "animate-track-page-in-left",
                      )}
                      style={{
                        animationDelay: `${Math.min(index, Math.max(tracksPerPage - 1, 0)) * 45}ms`,
                      }}
                    >
                      <div className="relative overflow-hidden rounded-[24px] bg-secondary/75 shadow-[0_20px_45px_rgba(0,0,0,0.22)]">
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
                            className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-background/75 text-foreground/80 backdrop-blur transition-colors hover:bg-background hover:text-foreground"
                            aria-label={`Open ${track.name || "track"} on Spotify`}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : null}
                      </div>

                      <div className="mt-3 space-y-1.5">
                        <p className="text-2xl font-semibold leading-none text-primary/90">{track.rank}.</p>
                        <p className="min-h-[3.5rem] text-[1.05rem] font-semibold leading-snug text-foreground">
                          {track.name || "Unknown track"}
                        </p>
                        <p className="text-base leading-snug text-muted-foreground">{formatArtists(track)}</p>
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
