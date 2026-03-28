import { AlertTriangle, CheckCircle2, LoaderCircle } from "lucide-react"

import type { AsyncJob } from "@/lib/types"


type JobStatusCardProps = {
  job?: AsyncJob<unknown> | null
  title: string
  idleMessage: string
}

export function JobStatusCard({ job, title, idleMessage }: JobStatusCardProps) {
  const status = job?.status
  const progress = typeof job?.progress === "number" ? Math.max(0, Math.min(100, job.progress)) : null
  const isWorking = status === "queued" || status === "running"
  const isComplete = status === "completed"
  const isFailed = status === "failed"

  return (
    <div
      className={`rounded-3xl border p-4 ${
        isFailed
          ? "border-destructive/25 bg-destructive/8"
          : isComplete
            ? "border-primary/20 bg-primary/8"
            : "border-border bg-muted/45"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 rounded-2xl p-2 ${
            isFailed
              ? "bg-destructive/12 text-destructive"
              : isComplete
                ? "bg-primary/12 text-primary"
                : "bg-white/80 text-foreground"
          }`}
        >
          {isFailed ? (
            <AlertTriangle className="h-5 w-5" />
          ) : isComplete ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <LoaderCircle className={`h-5 w-5 ${isWorking ? "animate-spin" : ""}`} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {job?.message || job?.error || idleMessage}
          </p>
        </div>
      </div>

      {progress !== null ? (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-white/80">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">{progress}% complete</p>
        </div>
      ) : null}

      {job?.error ? (
        <p className="mt-4 rounded-2xl border border-destructive/20 bg-white/70 px-3 py-2 text-sm text-destructive">
          {job.error}
        </p>
      ) : null}
    </div>
  )
}
