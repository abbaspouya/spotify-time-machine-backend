import { ArrowRight, Disc3, Music2 } from "lucide-react"
import { Link, Outlet } from "react-router-dom"

import { Button, buttonVariants } from "@/components/ui/button"
import { useSpotifySession } from "@/features/spotify/use-spotify-session"
import { getDocsUrl } from "@/lib/api"
import { cn } from "@/lib/utils"

export function RootLayout() {
  const { handleSpotifyLogin, isAuthenticated } = useSpotifySession()

  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-[-18rem] z-0 h-[34rem] bg-[radial-gradient(circle,_rgba(29,185,84,0.28),_transparent_58%)]" />
      <div className="pointer-events-none absolute right-[-8rem] top-[8rem] z-0 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,_rgba(244,244,245,0.16),_transparent_60%)] blur-3xl" />
      <div className="pointer-events-none absolute left-[-10rem] top-[26rem] z-0 h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,_rgba(148,163,184,0.18),_transparent_60%)] blur-3xl" />

      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="container flex items-center justify-between py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
              <Music2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/55">Spotify Time Machine</p>
              <p className="font-display text-lg">Time-based playlists and clearer library transfers</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <a
              href={getDocsUrl()}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}
            >
              API Docs
            </a>
            {isAuthenticated ? (
              <Link to="/app" className={buttonVariants({ size: "sm" })}>
                Open dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Button size="sm" onClick={handleSpotifyLogin}>
                <Disc3 className="h-4 w-4" />
                Connect Spotify
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 pb-16">
        <Outlet />
      </main>

      <footer className="relative z-10 border-t border-border/80 bg-card/72">
        <div className="container grid gap-8 py-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="space-y-3">
            <p className="font-display text-xl text-foreground">Spotify Time Machine</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Connect Spotify, then keep the real product inside the dashboard where playlist creation, transfers, and
              advanced tools can stay focused.
            </p>
          </div>

          <div className="space-y-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/55">Product</p>
            <div className="grid gap-2 text-muted-foreground">
              <Link to="/app" className="transition-colors hover:text-foreground">
                Dashboard
              </Link>
              <Link to="/app/time-machine" className="transition-colors hover:text-foreground">
                Time Machine
              </Link>
              <Link to="/app/transfer-library" className="transition-colors hover:text-foreground">
                Transfer Library
              </Link>
              <Link to="/app/advanced" className="transition-colors hover:text-foreground">
                Advanced
              </Link>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/55">Access</p>
            <div className="grid gap-2 text-muted-foreground">
              <Link to="/" className="transition-colors hover:text-foreground">
                Homepage
              </Link>
              <Link to="/app" className="transition-colors hover:text-foreground">
                Open dashboard
              </Link>
              <a href={getDocsUrl()} target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground">
                API Docs
              </a>
              <p>Spotify login is required before personal-library tools can load your account data.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
