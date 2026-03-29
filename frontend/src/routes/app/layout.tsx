import { LayoutDashboard, Music2 } from "lucide-react"
import { Link, NavLink, Outlet } from "react-router-dom"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { primaryNavigation } from "../root/navigation"

export function AppLayout() {
  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-[-16rem] z-0 h-[30rem] bg-[radial-gradient(circle,_rgba(29,185,84,0.24),_transparent_58%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-[12rem] z-0 mx-auto h-[28rem] max-w-6xl rounded-full bg-[radial-gradient(circle,_rgba(148,163,184,0.16),_transparent_60%)] blur-3xl" />

      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur-xl">
        <div className="container flex flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between">
          <Link to="/app" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
              <Music2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/55">Spotify Time Machine</p>
              <p className="font-display text-lg">Dashboard and focused workflows</p>
            </div>
          </Link>

          <div className="flex flex-col gap-3 xl:items-end">
            <nav className="flex flex-wrap items-center gap-2">
              {primaryNavigation.map((item) => (
                <NavLink
                  key={item.to}
                  end={item.to === "/app"}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "rounded-full px-4 py-2 text-sm transition-colors",
                      isActive
                        ? "border border-white/10 bg-card/90 text-foreground shadow-panel"
                        : "text-foreground/72 hover:bg-card/80 hover:text-foreground",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="metric-pill">
                <LayoutDashboard className="mr-2 h-3.5 w-3.5" />
                Navigation now lives here
              </span>
              <Link to="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                View homepage
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 pb-16">
        <Outlet />
      </main>
    </div>
  )
}
