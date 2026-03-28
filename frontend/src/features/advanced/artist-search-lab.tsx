import { useDeferredValue, useState } from "react"
import { Disc3, ExternalLink, Search } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { searchArtists } from "@/lib/api"
import { AuthRequiredNotice } from "@/features/spotify/auth-required-notice"
import { getErrorMessage, useSpotifySession } from "@/features/spotify/use-spotify-session"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ArtistSearchLab() {
  const { isAuthenticated } = useSpotifySession()

  const [artistSearch, setArtistSearch] = useState("")
  const deferredArtistSearch = useDeferredValue(artistSearch.trim())

  const artistSearchQuery = useQuery({
    queryKey: ["artistSearch", deferredArtistSearch],
    queryFn: () => searchArtists(deferredArtistSearch),
    enabled: isAuthenticated && deferredArtistSearch.length >= 2,
    staleTime: 120_000,
  })

  return (
    <section id="artist-search-lab" className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card className="animate-fade-up [animation-delay:180ms]">
        <CardHeader>
          <CardTitle>Artist lookup</CardTitle>
          <CardDescription>
            Search Spotify artists quickly and browse a lightweight card view with the basics you usually want first.
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

          {!isAuthenticated ? (
            <AuthRequiredNotice message="Connect Spotify first to use the artist search utilities." />
          ) : null}

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

      <Card className="animate-fade-up [animation-delay:220ms]">
        <CardHeader>
          <CardTitle>Search results</CardTitle>
          <CardDescription>
            Results stay compact so you can scan artists, popularity, and genres without a heavy detail view.
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
  )
}
