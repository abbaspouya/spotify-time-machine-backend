import { Headphones, LayoutGrid, Music2, Orbit, Sparkles } from "lucide-react"
import { Link, NavLink, Outlet } from "react-router-dom"

import { primaryNavigation } from "@/app/navigation"
import { buttonVariants } from "@/components/ui/button"
import { getDocsUrl } from "@/lib/api"
import { cn } from "@/lib/utils"

export function RootLayout() {
  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-[-16rem] z-0 h-[28rem] bg-[radial-gradient(circle,_rgba(29,185,84,0.16),_transparent_56%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-[12rem] z-0 mx-auto h-[26rem] max-w-6xl rounded-full bg-[radial-gradient(circle,_rgba(250,139,73,0.12),_transparent_58%)] blur-3xl" />

      <header className="sticky top-0 z-20 border-b border-white/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background shadow-panel">
              <Music2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/55">Spotify Time Machine</p>
              <p className="font-display text-lg">Clearer journeys for playlists and library transfers</p>
            </div>
          </Link>

          <div className="flex flex-col gap-3 xl:items-end">
            <nav className="flex flex-wrap items-center gap-2">
              {primaryNavigation.map((item) => (
                <NavLink
                  key={item.to}
                  end={item.to === "/"}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "rounded-full px-4 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-white text-foreground shadow-panel"
                        : "text-foreground/72 hover:bg-white/85 hover:text-foreground",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={getDocsUrl()}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                API Docs
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 pb-16">
        <Outlet />
      </main>

      <footer className="relative z-10 border-t border-white/60 bg-white/65">
        <div className="container flex flex-col gap-4 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="metric-pill">
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              React + TanStack Query
            </span>
            <span className="metric-pill">
              <Headphones className="mr-2 h-3.5 w-3.5" />
              FastAPI API
            </span>
            <span className="metric-pill">
              <Orbit className="mr-2 h-3.5 w-3.5" />
              shadcn-style UI
            </span>
          </div>

          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            <span>Focused pages for connection, playlist creation, transfers, and experiments.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
