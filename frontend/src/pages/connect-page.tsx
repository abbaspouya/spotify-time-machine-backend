import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowRight, Disc3, RefreshCcw, ShieldCheck, UserRound } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAuthStatus, getDocsUrl, getLoginUrl, getWhoAmI } from "@/lib/api"
import { cn } from "@/lib/utils"

function formatExpiresAt(value?: number | null) {
  if (!value) {
    return "Unknown"
  }

  return new Date(value * 1000).toLocaleString()
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong."
}

export function ConnectPage() {
  const queryClient = useQueryClient()

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

  const handleSpotifyLogin = () => {
    window.location.href = getLoginUrl()
  }

  const handleRefreshAuth = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["authStatus"] }),
      queryClient.invalidateQueries({ queryKey: ["whoami"] }),
    ])
  }

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
              This route becomes the front door for authentication, account readiness, and the first step into the Time
              Machine and library transfer journeys.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={handleSpotifyLogin}>
              <Disc3 className="h-4 w-4" />
              Connect Spotify
            </Button>
            <Button variant="outline" onClick={() => void handleRefreshAuth()}>
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
              Authentication still lives on the backend, but this page now owns the user-facing status check.
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
                Open current workspace
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
            <CardTitle>1. Connect</CardTitle>
            <CardDescription>Authenticate once and confirm the session is ready.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This page becomes the stable entry step for the rest of the product.
          </CardContent>
        </Card>

        <Card className="animate-fade-up [animation-delay:220ms]">
          <CardHeader>
            <CardTitle>2. Choose a journey</CardTitle>
            <CardDescription>Time Machine and Transfer Library become the primary flows.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            We are separating focused product routes first, then moving each working tool into its own page.
          </CardContent>
        </Card>

        <Card className="animate-fade-up [animation-delay:260ms]">
          <CardHeader>
            <CardTitle>3. Keep power tools accessible</CardTitle>
            <CardDescription>The original cockpit stays available while we split it out.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            The full MVP remains under <code>/workspace</code> during the transition.
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
