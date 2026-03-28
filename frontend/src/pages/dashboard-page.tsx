import { ArrowRight, ArrowRightLeft, LayoutGrid, Sparkles, Wrench } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatExpiresAt, useSpotifySession } from "@/features/spotify/use-spotify-session"

const workspaceRoutes = [
  {
    to: "/connect",
    title: "Connect Spotify",
    description: "Connect your account, refresh status, and confirm which profile is active.",
  },
  {
    to: "/time-machine",
    title: "Time Machine",
    description: "Group liked songs by time period and create playlists from those slices.",
  },
  {
    to: "/transfer-library",
    title: "Transfer Library",
    description: "Download and import snapshot data from a dedicated migration page.",
  },
  {
    to: "/advanced",
    title: "Advanced",
    description: "Use language grouping and artist search without crowding the core flows.",
  },
] as const

const routeDelayClasses = [
  "[animation-delay:180ms]",
  "[animation-delay:220ms]",
  "[animation-delay:260ms]",
  "[animation-delay:300ms]",
] as const

export function DashboardPage() {
  const { authStatusQuery, isAuthenticated, whoAmIQuery } = useSpotifySession()

  return (
    <div className="container space-y-8 py-8 md:py-12">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="section-shell animate-fade-up overflow-hidden">
          <div className="flex flex-wrap items-center gap-3">
            <span className="hero-badge">
              <LayoutGrid className="h-3.5 w-3.5" />
              Overview
            </span>
            <Badge variant={isAuthenticated ? "default" : "outline"}>
              {isAuthenticated ? "Spotify connected" : "Spotify not connected"}
            </Badge>
          </div>

          <div className="mt-6 space-y-4">
            <h1 className="max-w-3xl text-4xl leading-tight md:text-5xl">Use this overview as a quick launchpad into the focused flows.</h1>
            <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
              Connection, playlist creation, transfers, and experiments each have their own page now, so this overview
              stays light and easy to scan.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/time-machine" className={buttonVariants({ variant: "default" })}>
              Open the main journey
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/transfer-library" className={buttonVariants({ variant: "outline" })}>
              Open transfer flow
              <ArrowRightLeft className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <Card className="animate-fade-up [animation-delay:120ms]">
          <CardHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Wrench className="h-6 w-6" />
            </div>
            <CardTitle>Current session</CardTitle>
            <CardDescription>Every page uses this same Spotify connection, so the overview still works well as a quick status check.</CardDescription>
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
                <p className="text-sm font-medium text-foreground">Connected account</p>
                <p className="mt-2 text-lg font-semibold">{whoAmIQuery.data.display_name || whoAmIQuery.data.id}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {whoAmIQuery.data.email || "Email not available"} - {whoAmIQuery.data.country || "Unknown country"}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {workspaceRoutes.map((route, index) => (
          <Card key={route.to} className={`animate-fade-up ${routeDelayClasses[index]}`}>
            <CardHeader>
              <CardTitle>{route.title}</CardTitle>
              <CardDescription>{route.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link to={route.to} className={buttonVariants({ variant: "secondary" })}>
                Open page
                <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 md:grid-cols-[1fr_1fr]">
        <Card className="animate-fade-up [animation-delay:340ms]">
          <CardHeader>
            <CardTitle>What changed</CardTitle>
            <CardDescription>The overview no longer tries to hold every tool at once.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border bg-white/70 px-4 py-3">
              Time-based playlist tools moved into the dedicated Time Machine journey.
            </div>
            <div className="rounded-2xl border border-border bg-white/70 px-4 py-3">
              Snapshot export and import moved into the dedicated Transfer Library page.
            </div>
            <div className="rounded-2xl border border-border bg-white/70 px-4 py-3">
              Language experiments and artist search moved into the Advanced page.
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-up [animation-delay:380ms]">
          <CardHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <CardTitle>How to use this page now</CardTitle>
            <CardDescription>Think of it as a launchpad and quick session check, not the main working surface.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border bg-white/70 px-4 py-3">
              Start in Connect when you need to authenticate or verify the active account.
            </div>
            <div className="rounded-2xl border border-border bg-white/70 px-4 py-3">
              Spend most of your time inside the page that matches the task you want to complete.
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
