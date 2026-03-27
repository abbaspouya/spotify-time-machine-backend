import { Headphones, LayoutGrid, Music2, Orbit, Sparkles } from "lucide-react"
import { Link, Outlet } from "react-router-dom"

import { buttonVariants } from "@/components/ui/button"
import { getDocsUrl } from "@/lib/api"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "#overview", label: "Overview" },
  { href: "#grouping", label: "Grouping" },
  { href: "#language", label: "Language" },
  { href: "#snapshots", label: "Snapshots" },
  { href: "#search", label: "Artists" },
]

export function RootLayout() {
  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-[-16rem] z-0 h-[28rem] bg-[radial-gradient(circle,_rgba(29,185,84,0.16),_transparent_56%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-[12rem] z-0 mx-auto h-[26rem] max-w-6xl rounded-full bg-[radial-gradient(circle,_rgba(250,139,73,0.12),_transparent_58%)] blur-3xl" />

      <header className="sticky top-0 z-20 border-b border-white/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex items-center justify-between gap-4 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background shadow-panel">
              <Music2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/55">Spotify Atelier</p>
              <p className="font-display text-lg">Library tools for playlist tinkerers</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 lg:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm text-foreground/72 transition-colors hover:bg-white/85 hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <a
            href={getDocsUrl()}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "hidden md:inline-flex")}
          >
            API Docs
          </a>
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
              FastAPI backend
            </span>
            <span className="metric-pill">
              <Orbit className="mr-2 h-3.5 w-3.5" />
              shadcn-style UI
            </span>
          </div>

          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            <span>Built as a local-first control panel for your Spotify experiments.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
