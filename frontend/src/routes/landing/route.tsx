import {
  ArrowRight,
  ArrowRightLeft,
  CalendarRange,
  Check,
  Disc3,
  LibraryBig,
  Microscope,
  ShieldCheck,
} from "lucide-react"
import { Link } from "react-router-dom"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useSpotifySession } from "@/features/spotify/use-spotify-session"

const productCards = [
  {
    title: "Time Machine",
    description: "Group liked songs by month, quarter, half-year, or year and turn the best slices into Spotify playlists.",
    to: "/app/time-machine",
    icon: CalendarRange,
    label: "Main flow",
  },
  {
    title: "Transfer Library",
    description: "Export a snapshot from one account, preview what matters, and apply it into another with clearer steps.",
    to: "/app/transfer-library",
    icon: ArrowRightLeft,
    label: "Migration flow",
  },
  {
    title: "Advanced",
    description: "Keep experimental tools like language grouping and artist lookup available without crowding the core product.",
    to: "/app/advanced",
    icon: Microscope,
    label: "Extra tools",
  },
] as const

const steps = [
  "Connect Spotify once so the app can work against your current account.",
  "Choose the flow you want from the dashboard instead of sorting through every tool on the homepage.",
  "Create time-capsule playlists, transfer a library, or explore advanced tools when you need them.",
] as const

const trustPoints = [
  "Work from your own Spotify account instead of guessing how the tools behave on your library.",
  "Create playlists directly inside Spotify when a time slice is worth keeping.",
  "Preview transfer work before import so the migration flow stays easier to reason about.",
] as const

export function LandingPage() {
  const { handleSpotifyLogin, isAuthenticated } = useSpotifySession()

  return (
    <div className="container space-y-10 py-8 md:space-y-14 md:py-12">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="section-shell animate-fade-up overflow-hidden border-primary/20 bg-[linear-gradient(180deg,rgba(29,185,84,0.12),rgba(255,255,255,0.02)_30%,rgba(255,255,255,0))]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="hero-badge">Spotify login first</span>
            <span className="metric-pill">One connection, focused flows after</span>
          </div>

          <div className="mt-6 space-y-4">
            <h1 className="max-w-4xl text-4xl leading-tight md:text-5xl lg:text-6xl">
              Turn your Spotify library into time-capsule playlists and cleaner transfers.
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
              Connect once, then group liked songs by time, preview library snapshots before import, and keep advanced
              tools available without making the first screen feel like a dashboard.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {isAuthenticated ? (
              <Link to="/app" className={buttonVariants({ size: "lg" })}>
                Open dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Button size="lg" onClick={handleSpotifyLogin}>
                <Disc3 className="h-4 w-4" />
                Connect Spotify
              </Button>
            )}
            <a href="#product-flows" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Explore the product
            </a>
          </div>

          <div className="mt-8 flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span className="metric-pill">Liked songs into playlists</span>
            <span className="metric-pill">Snapshot preview before import</span>
            <span className="metric-pill">Advanced tools kept separate</span>
          </div>
        </div>

        <Card className="animate-fade-up overflow-hidden border-white/15 bg-card/92 [animation-delay:120ms]">
          <CardHeader className="border-b border-white/10 pb-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/55">Inside the dashboard</p>
                <CardTitle className="mt-2">What opens after you connect</CardTitle>
              </div>
              <div className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                Spotify ready
              </div>
            </div>
            <CardDescription>
              The homepage stays lean. The real navigation and account-specific work start after Spotify login.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 pt-6">
            {productCards.map(({ title, description, icon: Icon, label }) => (
              <div
                key={title}
                className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-foreground/70">
                    {label}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section id="product-flows" className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/55">What you can do</p>
          <h2 className="text-3xl md:text-4xl">Three focused ways to work with your Spotify library.</h2>
          <p className="max-w-2xl text-muted-foreground">
            Start with the product story here, then pick the exact workflow you want once you are inside the app.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {productCards.map(({ title, description, to, icon: Icon, label }) => (
            <Card key={title} className="animate-fade-up border-white/10 bg-card/88">
              <CardHeader>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-foreground/70">
                    {label}
                  </span>
                </div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link to={to} className={buttonVariants({ variant: "secondary" })}>
                  Open in dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="animate-fade-up border-white/10 bg-card/88 [animation-delay:120ms]">
          <CardHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <LibraryBig className="h-6 w-6" />
            </div>
            <CardTitle>How it works</CardTitle>
            <CardDescription>Keep the first screen simple, then let the dashboard handle the account-specific details.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {steps.map((step, index) => (
              <div key={step} className="flex items-start gap-3 rounded-2xl border border-border bg-white/70 px-4 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {index + 1}
                </div>
                <p className="pt-1 text-sm text-muted-foreground">{step}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="animate-fade-up border-white/10 bg-card/88 [animation-delay:180ms]">
          <CardHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <CardTitle>Why start here</CardTitle>
            <CardDescription>
              This page keeps the first decision simple before you move into playlist building or transfer work.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {trustPoints.map((point) => (
              <div key={point} className="flex items-start gap-3 rounded-2xl border border-border bg-white/70 px-4 py-4">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <Check className="h-4 w-4" />
                </div>
                <p className="text-sm text-muted-foreground">{point}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
