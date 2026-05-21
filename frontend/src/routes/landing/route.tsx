import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import {
  ArrowDown,
  ArrowRight,
  ArrowRightLeft,
  CalendarRange,
  CheckCircle2,
  Disc3,
  Languages,
  ListMusic,
} from "lucide-react"
import { Link } from "react-router-dom"

import { Button, buttonVariants } from "@/components/ui/button"
import { useSpotifySession } from "@/features/spotify/use-spotify-session"
import { IS_DEMO_MODE } from "@/lib/api"
import { cn } from "@/lib/utils"

const storyFeatures = [
  {
    title: "Time Machine",
    eyebrow: "Liked songs by time",
    description: "Pick a month, quarter, half-year, or year from your listening history and turn that slice into a Spotify playlist.",
    icon: CalendarRange,
    accent: "01",
    preview: ["Jan 2021", "Feb 2021", "Mar 2021"],
  },
  {
    title: "Transfer Library",
    eyebrow: "Move between accounts",
    description: "Export selected library data, connect the receiving account, preview the import plan, and apply only what you choose.",
    icon: ArrowRightLeft,
    accent: "02",
    preview: ["Playlists", "Liked songs", "Followed artists"],
  },
  {
    title: "Language Playlists",
    eyebrow: "Beta language scan",
    description: "Scan liked songs for recognised language groups, choose one, and create a playlist from the matching tracks.",
    icon: Languages,
    accent: "03",
    preview: ["IT", "EN", "FA"],
  },
] as const

function ScrollReveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.18 },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out will-change-transform",
        isVisible ? "translate-y-0 opacity-100 blur-0" : "translate-y-12 opacity-0 blur-sm",
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

export function LandingPage() {
  const { handleSpotifyLogin, isAuthenticated } = useSpotifySession()

  return (
    <div className="relative isolate overflow-hidden">
      <div className="container py-8 md:py-12">
        <section id="spotify-login" className="min-h-[calc(100vh-8rem)] scroll-mt-28">
          <div className="grid min-h-[calc(100vh-10rem)] place-items-center">
            <div className="mx-auto max-w-5xl text-center">
              <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-[28px] border border-primary/25 bg-primary text-primary-foreground shadow-glow">
                <Disc3 className="h-9 w-9" />
              </div>

              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Spotify login first</p>
              <h1 className="mx-auto mt-5 max-w-4xl text-5xl leading-[0.98] md:text-7xl">
                Turn your Spotify history into playlists, transfers, and better library control.
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground md:text-xl">
                Connect your Spotify account once, then use focused tools for time-based playlists, account-to-account
                library moves, and beta language playlist creation.
              </p>

              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                {isAuthenticated ? (
                  <Link to="/app" className={buttonVariants({ size: "lg" })}>
                    {IS_DEMO_MODE ? "Open demo dashboard" : "Open dashboard"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <Button className="min-w-48" size="lg" onClick={handleSpotifyLogin}>
                    <Disc3 className="h-4 w-4" />
                    {IS_DEMO_MODE ? "Enter demo mode" : "Connect Spotify"}
                  </Button>
                )}
                <a href="#feature-story" className={buttonVariants({ variant: "outline", size: "lg" })}>
                  See what unlocks
                  <ArrowDown className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="feature-story" className="scroll-mt-28 space-y-10 py-10 md:py-16">
          <ScrollReveal className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-foreground/55">After you connect</p>
            <h2 className="mt-3 text-3xl md:text-5xl">The app appears one focused Spotify workflow at a time.</h2>
            <p className="mt-4 text-muted-foreground md:text-lg">
              Scroll through the story, then return to the top when you are ready to connect and use the tools with your
              own library.
            </p>
          </ScrollReveal>

          <div className="space-y-10">
            {storyFeatures.map(({ accent, description, eyebrow, icon: Icon, preview, title }, index) => (
              <ScrollReveal key={title} delay={index * 80}>
                <article className="grid min-h-[440px] items-center gap-8 rounded-[30px] border border-white/10 bg-card/78 p-5 shadow-panel backdrop-blur-xl md:p-8 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className={index % 2 ? "lg:order-2" : undefined}>
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                        <Icon className="h-7 w-7" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{eyebrow}</p>
                        <h3 className="mt-1 text-3xl md:text-4xl">{title}</h3>
                      </div>
                    </div>
                    <p className="mt-6 max-w-xl text-base text-muted-foreground md:text-lg">{description}</p>
                  </div>

                  <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-background/55 p-5">
                    <div className="absolute right-5 top-5 font-display text-6xl text-primary/10">{accent}</div>
                    <div className="relative space-y-4">
                      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                            <ListMusic className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{title}</p>
                            <p className="text-xs text-muted-foreground">Ready after Spotify login</p>
                          </div>
                        </div>
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      </div>

                      <div className="grid gap-3">
                        {preview.map((item, previewIndex) => (
                          <div
                            key={item}
                            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                          >
                            <span className="text-sm font-medium text-foreground">{item}</span>
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${88 - previewIndex * 16}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </section>

        <section className="py-10 md:py-16">
          <div className="mx-auto max-w-3xl rounded-[30px] border border-primary/20 bg-primary/8 p-6 text-center shadow-glow backdrop-blur md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Ready to start</p>
            <h2 className="mt-3 text-3xl md:text-5xl">Connect Spotify and let the dashboard become personal.</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              The public page stays simple. Your real playlists, account transfer choices, and language scans appear only
              after Spotify login.
            </p>
            <div className="mt-8 flex justify-center">
              {isAuthenticated ? (
                <Link to="/app" className={buttonVariants({ size: "lg" })}>
                  {IS_DEMO_MODE ? "Open demo dashboard" : "Open dashboard"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <a href="#spotify-login" className={buttonVariants({ size: "lg" })}>
                  Back to Spotify login
                  <ArrowDown className="h-4 w-4 rotate-180" />
                </a>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
