import { ArrowRight, ArrowRightLeft, Disc3, RefreshCcw, ShieldCheck, Sparkles, UserRound } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatExpiresAt, getErrorMessage, useSpotifySession } from "@/features/spotify/use-spotify-session"
import { getDocsUrl } from "@/lib/api"
import { cn } from "@/lib/utils"

export function ConnectPage() {
  const { authStatusQuery, isAuthenticated, whoAmIQuery, handleSpotifyLogin, refreshSession } = useSpotifySession()

  return (
    <div className="container space-y-8 py-8 md:py-12">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="section-shell animate-fade-up overflow-hidden">
          <div className="flex flex-wrap items-center gap-3">
            <span className="hero-badge">Entry Point</span>
            <Badge variant={isAuthenticated ? "default" : "outline"}>
              {isAuthenticated ? "Spotify connected" : "Spotify not connected"}
            </Badge>
          </div>

          <div className="mt-6 space-y-4">
            <h1 className="max-w-3xl text-4xl leading-tight md:text-5xl">
              Connect Spotify once, then move into the product flows that matter.
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
              Start here to connect your account, confirm that everything is ready, and then head into playlist
              creation or library transfer.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={handleSpotifyLogin}>
              <Disc3 className="h-4 w-4" />
              Connect Spotify
            </Button>
            <Button variant="outline" onClick={() => void refreshSession()}>
              <RefreshCcw className="h-4 w-4" />
              Refresh status
            </Button>
            <Link to="/time-machine" className={cn(buttonVariants({ variant: "ghost" }), "bg-white/60")}>
              Explore the main journey
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <Card className="animate-fade-up [animation-delay:120ms]">
          <CardHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <CardTitle>Connection status</CardTitle>
            <CardDescription>
              Keep your current Spotify connection visible, refresh it when needed, and confirm which account is active in this browser session.
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
              <div className="rounded-3xl border border-border bg-white/75 p-4">
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
              <Link to="/workspace" className={buttonVariants({ variant: "secondary" })}>
                Open overview
              </Link>
              <a
                href={getDocsUrl()}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "outline" })}
              >
                API Docs
              </a>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <Card className="animate-fade-up [animation-delay:180ms]">
          <CardHeader>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <CardTitle>Time Machine</CardTitle>
            <CardDescription>Turn your liked songs into grouped time capsules and create playlists from them.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Browse your listening history by time period and turn those slices into playlists.</p>
            <Link to="/time-machine" className={buttonVariants({ variant: "secondary" })}>
              Open Time Machine
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <Card className="animate-fade-up [animation-delay:220ms]">
          <CardHeader>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <CardTitle>Transfer Library</CardTitle>
            <CardDescription>Export and import account snapshots from a migration-focused page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Download a snapshot, upload it into another account, and keep track of what was applied.</p>
            <Link to="/transfer-library" className={buttonVariants({ variant: "secondary" })}>
              Open Transfer Library
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <Card className="animate-fade-up [animation-delay:260ms]">
          <CardHeader>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Disc3 className="h-5 w-5" />
            </div>
            <CardTitle>Advanced</CardTitle>
            <CardDescription>Experimental tools like language grouping and artist lookup now have their own home.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Explore language grouping and artist search without interrupting the main flows.</p>
            <div className="flex flex-wrap gap-3">
              <Link to="/advanced" className={buttonVariants({ variant: "secondary" })}>
                Open Advanced
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/workspace" className={buttonVariants({ variant: "outline" })}>
                Open Overview
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
