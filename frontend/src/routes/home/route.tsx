import { ArrowRight, ArrowRightLeft, CheckCircle2, Languages, Sparkles } from "lucide-react"
import { Link } from "react-router-dom"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TopTracksRecap } from "@/features/dashboard/top-tracks-recap"
import { useSpotifySession } from "@/features/spotify/use-spotify-session"

export function HomePage() {
  const { authStatusQuery, isAuthenticated, whoAmIQuery, spotifyRateLimit, handleSpotifyLogin, refreshSession } = useSpotifySession()
  const canLoadTopTracks = isAuthenticated && whoAmIQuery.isSuccess && !spotifyRateLimit.isRateLimited
  const topTracksBlockedError = whoAmIQuery.isError ? whoAmIQuery.error : spotifyRateLimit.error

  return (
    <div className="container space-y-8 py-8 md:py-12">
      <TopTracksRecap
        scope={authStatusQuery.data?.scope}
        canLoad={canLoadTopTracks}
        blockedError={topTracksBlockedError}
        onReconnect={handleSpotifyLogin}
        onRetrySession={() => void refreshSession()}
      />

      <section className="section-shell animate-fade-up space-y-3">
        <span className="hero-badge">Spotify workflow hub</span>
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="max-w-3xl text-3xl leading-tight md:text-4xl">Choose the Spotify job you want to do today.</h1>
            <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
              Build a playlist from a time period, move selected library data between accounts, or create a beta
              language playlist from your liked songs.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <Card className="animate-fade-up transition-all hover:-translate-y-0.5 hover:border-primary/35 [animation-delay:180ms]">
          <CardHeader>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <CardTitle>Time Machine</CardTitle>
            <CardDescription>Create playlists from months, quarters, half-years, or years of your Spotify history.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="space-y-3 border-t border-white/10 pt-4">
              <div className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>Group liked songs by the period you want to revisit.</p>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>Create the selected slice as a playlist in Spotify.</p>
              </div>
            </div>
            <Link to="/app/time-machine" className={buttonVariants({ variant: "secondary" })}>
              Open Time Machine
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <Card className="animate-fade-up transition-all hover:-translate-y-0.5 hover:border-primary/35 [animation-delay:220ms]">
          <CardHeader>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <CardTitle>Transfer Library</CardTitle>
            <CardDescription>Move playlists, liked songs, albums, and followed artists with more control.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="space-y-3 border-t border-white/10 pt-4">
              <div className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>Export only the library parts you want to move.</p>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>Connect a target account and preview before import.</p>
              </div>
            </div>
            <Link to="/app/transfer-library" className={buttonVariants({ variant: "secondary" })}>
              Open Transfer Library
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <Card className="animate-fade-up transition-all hover:-translate-y-0.5 hover:border-primary/35 [animation-delay:260ms]">
          <CardHeader>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Languages className="h-5 w-5" />
            </div>
            <CardTitle>Language Playlists</CardTitle>
            <CardDescription>Try the beta detector and create playlists from recognised language groups.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="space-y-3 border-t border-white/10 pt-4">
              <div className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>Scan liked song titles and artists with langdetect.</p>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>Choose a detected language and save it as a playlist.</p>
              </div>
            </div>
            <Link to="/app/language-playlists" className={buttonVariants({ variant: "secondary" })}>
              Open Language Playlists
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
