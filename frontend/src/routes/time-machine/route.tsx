import { TimeMachineTool } from "@/features/time-machine/time-machine-tool"
import { Badge } from "@/components/ui/badge"

const features = [
  "Group liked songs by month, quarter, half-year, or year.",
  "Filter by year range before generating buckets.",
  "Create a playlist from a chosen time slice with custom naming.",
]

export function TimeMachinePage() {
  return (
    <div className="container space-y-6 py-8 md:space-y-8 md:py-12">
      <section className="section-shell animate-fade-up">
        <div className="flex flex-wrap items-center gap-3">
          <span className="hero-badge">Primary Journey</span>
          <Badge>Hero feature</Badge>
        </div>

        <div className="mt-6 space-y-4">
          <h1 className="max-w-3xl text-4xl leading-tight md:text-5xl">Turn your liked songs into time capsule playlists.</h1>
          <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
            Pick a time period, preview the slices in your library, and turn the ones you love into playlists that
            feel shaped by your own listening history.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {features.map((feature) => (
            <span key={feature} className="metric-pill">
              {feature}
            </span>
          ))}
        </div>
      </section>

      <TimeMachineTool />
    </div>
  )
}
