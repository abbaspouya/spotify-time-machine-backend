import { AlertTriangle, ArrowRightLeft, Download, ShieldCheck, Upload } from "lucide-react"
import { Link } from "react-router-dom"

import { TransferLibraryTool } from "@/features/transfer-library/transfer-library-tool"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const transferSteps = [
  "Export playlists, liked songs, saved albums, and followed artists.",
  "Choose exactly which parts of the snapshot you want to apply.",
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
              Download a snapshot from one account, upload it into another, and keep the transfer steps easier to
              follow from start to finish.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/app" className={buttonVariants({ variant: "default" })}>
              Open dashboard
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
            <CardDescription>Snapshot download, upload, and transfer feedback are all kept together in one place.</CardDescription>
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
            <CardTitle>Related pages</CardTitle>
            <CardDescription>Jump to the dashboard or advanced tools when you need them, then come right back to the transfer flow.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link to="/app" className={buttonVariants({ variant: "secondary" })}>
              <Download className="h-4 w-4" />
              Dashboard
            </Link>
            <Link to="/app/advanced" className={buttonVariants({ variant: "outline" })}>
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
