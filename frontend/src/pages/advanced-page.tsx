import { Languages, Microscope, Search, Sparkles } from "lucide-react"
import { Link } from "react-router-dom"

import { ArtistSearchLab } from "@/features/advanced/artist-search-lab"
import { LanguageLab } from "@/features/advanced/language-lab"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const advancedAreas = [
  "Language grouping based on track and artist naming patterns.",
  "Artist lookup and other exploratory search utilities.",
  "Future experiments that are useful but not yet strong enough for the core flow.",
]

export function AdvancedPage() {
  return (
    <div className="container space-y-8 py-8 md:py-12">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="section-shell animate-fade-up">
          <div className="flex flex-wrap items-center gap-3">
            <span className="hero-badge">Secondary Area</span>
            <Badge variant="outline">Experimental tools</Badge>
          </div>

          <div className="mt-6 space-y-4">
            <h1 className="max-w-3xl text-4xl leading-tight md:text-5xl">Keep interesting experiments available without crowding the core product.</h1>
            <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
              This page is where we keep powerful but less product-shaped capabilities while the main journeys become
              simpler and easier to trust.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#language-lab" className={buttonVariants({ variant: "secondary" })}>
              Open language tools
            </a>
            <a href="#artist-search-lab" className={buttonVariants({ variant: "outline" })}>
              Open artist search
            </a>
          </div>
        </div>

        <Card className="animate-fade-up [animation-delay:120ms]">
          <CardHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Microscope className="h-6 w-6" />
            </div>
            <CardTitle>What stays advanced</CardTitle>
            <CardDescription>These capabilities are real and working, but they are still better framed as experiments than core flows.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {advancedAreas.map((area) => (
              <div key={area} className="rounded-2xl border border-border bg-white/70 px-4 py-3 text-sm text-muted-foreground">
                {area}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <LanguageLab />

      <ArtistSearchLab />

      <section className="grid gap-6 md:grid-cols-[1fr_1fr]">
        <Card className="animate-fade-up [animation-delay:180ms]">
          <CardHeader>
            <CardTitle>Current tools available</CardTitle>
            <CardDescription>The existing experiments remain usable throughout the navigation refactor.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-white/70 px-4 py-3">
              <Languages className="mt-0.5 h-4 w-4 text-primary" />
              <span>Language grouping stays available as a creative playlist experiment.</span>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-white/70 px-4 py-3">
              <Search className="mt-0.5 h-4 w-4 text-primary" />
              <span>Artist search remains a useful discovery tool and example of search-heavy UI.</span>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-up [animation-delay:220ms]">
          <CardHeader>
            <CardTitle>Promotion rule</CardTitle>
            <CardDescription>Features graduate out of Advanced when they become reliable, understandable, and central.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-white/70 px-4 py-3">
              <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
              <span>If a feature has a clean user story and repeatable value, it should earn its own route later.</span>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
