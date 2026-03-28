import { AlertTriangle, ArrowRightLeft, Download, ShieldCheck, Upload } from "lucide-react"
import { Link } from "react-router-dom"

import { TransferLibraryTool } from "@/features/transfer-library/transfer-library-tool"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const transferSteps = [
  "Export playlists, liked songs, saved albums, and followed artists.",
  "Review what is about to be transferred before applying it.",
  "Import the snapshot into the target account with safer guidance.",
]

export function TransferLibraryPage() {
  return (
    <div className="container space-y-8 py-8 md:py-12">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="section-shell animate-fade-up">
          <div className="flex flex-wrap items-center gap-3">
            <span className="hero-badge">Primary Journey</span>
            <Badge variant="secondary">Migration flow</Badge>
          </div>

          <div className="mt-6 space-y-4">
            <h1 className="max-w-3xl text-4xl leading-tight md:text-5xl">Move a Spotify library with more confidence and less manual work.</h1>
            <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
              This route will become the dedicated home for snapshot export and import, safety warnings, and eventually
              upload/download-driven transfer flows instead of backend file paths.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/connect" className={buttonVariants({ variant: "default" })}>
              Check connection first
            </Link>
            <a href="#transfer-tools" className={buttonVariants({ variant: "outline" })}>
              Jump to transfer tools
            </a>
          </div>
        </div>

        <Card className="animate-fade-up [animation-delay:120ms]">
          <CardHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <ArrowRightLeft className="h-6 w-6" />
            </div>
            <CardTitle>What belongs here</CardTitle>
            <CardDescription>The working export and import flow now lives here instead of being buried in a mixed dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {transferSteps.map((step) => (
              <div key={step} className="rounded-2xl border border-border bg-white/70 px-4 py-3 text-sm text-muted-foreground">
                {step}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-[1fr_1fr]">
        <Card className="animate-fade-up [animation-delay:180ms]">
          <CardHeader>
            <CardTitle>Related routes</CardTitle>
            <CardDescription>Use the dedicated product routes around this one now that the snapshot tools are here.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link to="/connect" className={buttonVariants({ variant: "secondary" })}>
              <Download className="h-4 w-4" />
              Connection page
            </Link>
            <Link to="/advanced" className={buttonVariants({ variant: "outline" })}>
              <Upload className="h-4 w-4" />
              Advanced tools
            </Link>
          </CardContent>
        </Card>

        <Card className="animate-fade-up [animation-delay:220ms]">
          <CardHeader>
            <CardTitle>Safety bar to reach</CardTitle>
            <CardDescription>Transfer flows feel product-ready only when the risk is explained before the action happens.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-white/70 px-4 py-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
              <span>Preview what will be created, added, or removed before import starts.</span>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-white/70 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-accent" />
              <span>Isolate destructive options behind clearer confirmations and warnings.</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <TransferLibraryTool />
    </div>
  )
}
