import { CalendarRange, Clock3, Music4, Wand2 } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const features = [
  "Group liked songs by month, quarter, half-year, or year.",
  "Filter by year range before generating buckets.",
  "Create a playlist from a chosen time slice with custom naming.",
]

const currentLinks = [
  { to: "/workspace#grouping", label: "Open grouping tools" },
  { to: "/workspace#overview", label: "Open current dashboard" },
]

export function TimeMachinePage() {
  return (
    <div className="container space-y-8 py-8 md:py-12">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="section-shell animate-fade-up">
          <div className="flex flex-wrap items-center gap-3">
            <span className="hero-badge">Primary Journey</span>
            <Badge>Hero feature</Badge>
          </div>

          <div className="mt-6 space-y-4">
            <h1 className="max-w-3xl text-4xl leading-tight md:text-5xl">Turn your liked songs into time capsule playlists.</h1>
            <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
              This route is the clearest product story in the app: pick a period, inspect the library slices, and spin
              them into playlists that feel curated by your listening history.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/connect" className={buttonVariants({ variant: "default" })}>
              Start with connection
            </Link>
            <Link to="/workspace#grouping" className={buttonVariants({ variant: "outline" })}>
              Use the current grouping flow
            </Link>
          </div>
        </div>

        <Card className="animate-fade-up [animation-delay:120ms]">
          <CardHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Clock3 className="h-6 w-6" />
            </div>
            <CardTitle>What this page will own</CardTitle>
            <CardDescription>Task 1 sets the route and navigation. Task 2 will move the working tools here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {features.map((feature) => (
              <div key={feature} className="rounded-2xl border border-border bg-white/70 px-4 py-3 text-sm text-muted-foreground">
                {feature}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-[1fr_1fr]">
        <Card className="animate-fade-up [animation-delay:180ms]">
          <CardHeader>
            <CardTitle>Current live tools</CardTitle>
            <CardDescription>The real functionality still lives in the transitional workspace for now.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {currentLinks.map((link) => (
              <Link key={link.to} to={link.to} className={buttonVariants({ variant: "secondary" })}>
                {link.label}
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="animate-fade-up [animation-delay:220ms]">
          <CardHeader>
            <CardTitle>Why this is the hero product</CardTitle>
            <CardDescription>It is distinct, emotionally understandable, and already backed by real working logic.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-white/70 px-4 py-3">
              <CalendarRange className="mt-0.5 h-4 w-4 text-primary" />
              <span>It turns invisible library history into a simple before-and-after outcome.</span>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-white/70 px-4 py-3">
              <Music4 className="mt-0.5 h-4 w-4 text-primary" />
              <span>It creates shareable Spotify playlists, which makes the feature feel complete and tangible.</span>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-white/70 px-4 py-3">
              <Wand2 className="mt-0.5 h-4 w-4 text-primary" />
              <span>It is already stronger as a focused product narrative than a general-purpose control panel.</span>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
