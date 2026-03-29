import { ArrowRight, ArrowRightLeft, Disc3, LibraryBig, ShieldCheck, Sparkles } from "lucide-react"
import { Link } from "react-router-dom"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useSpotifySession } from "@/features/spotify/use-spotify-session"
import { cn } from "@/lib/utils"

const productCards = [
  {
    title: "Time Machine",
    description: "Turn liked songs into time-based playlists you can keep, revisit, and share.",
    to: "/app/time-machine",
    icon: LibraryBig,
  },
  {
    title: "Transfer Library",
    description: "Move playlists and saved library data between accounts with clearer snapshot previews.",
    to: "/app/transfer-library",
    icon: ArrowRightLeft,
  },
  {
    title: "Advanced",
    description: "Keep experimental tools available without crowding the main product flows.",
    to: "/app/advanced",
    icon: Sparkles,
  },
] as const

const steps = [
  "Connect Spotify once so the app can work against your current account.",
  "Choose the flow you need inside the dashboard instead of learning the whole app at the door.",
  "Create playlists, transfer a library, or explore advanced tools from a cleaner workspace.",
] as const

export function LandingPage() {
  const { handleSpotifyLogin, isAuthenticated } = useSpotifySession()

  return (
    <div className="container space-y-10 py-8 md:space-y-14 md:py-12">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="section-shell animate-fade-up overflow-hidden">
          <div className="flex flex-wrap items-center gap-3">
            <span className="hero-badge">Connect first</span>
            <span className="metric-pill">Spotify login leads into the dashboard</span>
          </div>

          <div className="mt-6 space-y-4">
            <h1 className="max-w-4xl text-4xl leading-tight md:text-5xl lg:text-6xl">
              Connect Spotify and turn your library into clearer actions.
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
              Build time-capsule playlists from liked songs, move a library between accounts with safer previews, and
              keep the heavier navigation inside the app where it belongs.
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
              See the flows
            </a>
          </div>
        </div>

        <Card className="animate-fade-up [animation-delay:120ms]">
          <CardHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <CardTitle>What opens after login</CardTitle>
            <CardDescription>
              The homepage stays simple. The dashboard handles the real navigation once Spotify is connected.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {productCards.map(({ title, description, to, icon: Icon }) => (
              <Link
                key={title}
                to={to}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border border-border bg-white/70 px-4 py-4 text-left transition-colors",
                  "hover:border-white/70 hover:bg-white/80",
                )}
              >
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">{title}</p>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

      <section id="product-flows" className="grid gap-6 md:grid-cols-3">
        {productCards.map(({ title, description, to, icon: Icon }) => (
          <Card key={title} className="animate-fade-up">
            <CardHeader>
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <Icon className="h-5 w-5" />
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
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="animate-fade-up [animation-delay:120ms]">
          <CardHeader>
            <CardTitle>Why it feels clearer</CardTitle>
            <CardDescription>
              One Spotify connection opens the product without forcing every page and tool into the first screen.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border bg-white/70 px-4 py-3">
              Start with one action instead of deciding between every tool before the app knows your account.
            </div>
            <div className="rounded-2xl border border-border bg-white/70 px-4 py-3">
              Keep time-capsule playlists and transfer work in separate flows so each journey stays easier to follow.
            </div>
            <div className="rounded-2xl border border-border bg-white/70 px-4 py-3">
              Leave advanced experiments available without letting them crowd the main product entry.
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-up [animation-delay:180ms]">
          <CardHeader>
            <CardTitle>How it works</CardTitle>
            <CardDescription>Keep the entry page short, then let the dashboard do the routing and tool switching.</CardDescription>
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
      </section>
    </div>
  )
}
