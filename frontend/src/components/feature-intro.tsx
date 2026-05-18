import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

type FeatureIntroPoint = {
  title: string
  description: string
}

type FeatureIntroProps = {
  eyebrow: string
  icon: LucideIcon
  points?: FeatureIntroPoint[]
  title: string
  visual: ReactNode
  children: ReactNode
}

export function FeatureIntro({ eyebrow, icon: Icon, points = [], title, visual, children }: FeatureIntroProps) {
  return (
    <div className="grid gap-8 rounded-[28px] border border-primary/15 bg-gradient-to-br from-primary/12 via-card to-card p-5 md:p-8 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex max-w-3xl flex-col justify-center space-y-5">
        <div className="flex items-center gap-3 text-primary">
          <Icon className="h-5 w-5" />
          <p className="text-xs font-semibold uppercase tracking-[0.22em]">{eyebrow}</p>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl leading-tight md:text-5xl">{title}</h1>
          {children}
        </div>

        {points.length ? (
          <div className="grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-3">
            {points.map((point) => (
              <div key={point.title} className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{point.title}</p>
                <p className="text-sm text-muted-foreground">{point.description}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-[26px] border border-white/10 bg-background/55 p-5 shadow-panel">{visual}</div>
    </div>
  )
}
