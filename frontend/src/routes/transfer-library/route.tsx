import { TransferLibraryTool } from "@/features/transfer-library/transfer-library-tool"
import { Badge } from "@/components/ui/badge"

const transferSteps = [
  "Export a snapshot from the source account.",
  "Preview exactly what the import will create, add, or remove.",
  "Apply the transfer with clearer warnings and confirmations.",
]

export function TransferLibraryPage() {
  return (
    <div className="container space-y-6 py-8 md:space-y-8 md:py-12">
      <section className="section-shell animate-fade-up">
        <div className="flex flex-wrap items-center gap-3">
          <span className="hero-badge">Primary Journey</span>
          <Badge variant="secondary">Migration flow</Badge>
        </div>

        <div className="mt-6 space-y-4">
          <h1 className="max-w-3xl text-4xl leading-tight md:text-5xl">Move a Spotify library with more confidence and less manual work.</h1>
          <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
            Create or bring in a snapshot, review the import plan, and keep the risky parts of the transfer visible
            before anything touches the target account.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {transferSteps.map((step) => (
            <span key={step} className="metric-pill">
              {step}
            </span>
          ))}
        </div>
      </section>

      <TransferLibraryTool />
    </div>
  )
}
