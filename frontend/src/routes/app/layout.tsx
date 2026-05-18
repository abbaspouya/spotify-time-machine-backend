import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, LoaderCircle, LogOut, Music2, RefreshCcw } from "lucide-react"
import { Link, NavLink, Navigate, Outlet } from "react-router-dom"

import { Button, buttonVariants } from "@/components/ui/button"
import { formatExpiresAt, getErrorMessage, useSpotifySession } from "@/features/spotify/use-spotify-session"
import { cn } from "@/lib/utils"

import { primaryNavigation } from "../root/navigation"

function getInitials(name?: string | null, fallbackId?: string | null) {
  const source = (name || fallbackId || "").trim()
  if (!source) {
    return "ST"
  }

  const parts = source.split(/\s+/).filter(Boolean)
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("")
  return initials || source.slice(0, 2).toUpperCase()
}

export function AppLayout() {
  const { authStatusQuery, whoAmIQuery, handleSpotifyLogout, isAuthenticated, isLoggingOut, refreshSession } = useSpotifySession()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const displayName = whoAmIQuery.data?.display_name || whoAmIQuery.data?.id || "Spotify user"
  const accountSummary = [whoAmIQuery.data?.email, whoAmIQuery.data?.country, whoAmIQuery.data?.product].filter(Boolean).join(" | ")
  const avatarInitials = useMemo(
    () => getInitials(whoAmIQuery.data?.display_name, whoAmIQuery.data?.id),
    [whoAmIQuery.data?.display_name, whoAmIQuery.data?.id],
  )

  useEffect(() => {
    if (!isProfileOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProfileOpen(false)
      }
    }

    window.addEventListener("mousedown", handlePointerDown)
    window.addEventListener("keydown", handleEscape)

    return () => {
      window.removeEventListener("mousedown", handlePointerDown)
      window.removeEventListener("keydown", handleEscape)
    }
  }, [isProfileOpen])

  if (authStatusQuery.isPending) {
    return (
      <div className="container flex min-h-screen items-center justify-center py-12">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-card/85 px-5 py-3 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Checking your Spotify session...
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/92 backdrop-blur-xl">
        <div className="container py-4">
          <div className="flex items-center justify-between gap-4">
            <Link to="/app" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
                <Music2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display text-2xl text-foreground">Spotify Time Machine</p>
              </div>
            </Link>

            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsProfileOpen((open) => !open)}
                className="flex items-center gap-2 rounded-full border border-border bg-background px-1.5 py-1.5 pr-3 shadow-sm transition-colors hover:border-foreground/15 hover:bg-card"
                aria-haspopup="menu"
                aria-expanded={isProfileOpen}
              >
                {whoAmIQuery.data?.image_url ? (
                  <img
                    src={whoAmIQuery.data.image_url}
                    alt={displayName}
                    className="h-10 w-10 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/14 text-sm font-semibold text-primary">
                    {avatarInitials}
                  </div>
                )}
                <ChevronDown className={cn("h-4 w-4 text-foreground/70 transition-transform", isProfileOpen && "rotate-180")} />
              </button>

              {isProfileOpen ? (
                <div
                  className="absolute right-0 top-[calc(100%+0.75rem)] z-30 min-w-[300px] rounded-3xl border border-border bg-background p-3 shadow-2xl"
                  role="menu"
                >
                  <div className="rounded-2xl border border-border bg-card px-3 py-3">
                    <p className="font-semibold text-foreground">{displayName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{accountSummary || "Spotify account connected"}</p>
                  </div>
                  <div className="mt-3 rounded-2xl border border-border bg-card px-3 py-3">
                    <p className="text-xs font-semibold tracking-[0.2em] text-foreground/55 uppercase">Session</p>
                    <p className="mt-3 text-sm font-medium text-foreground">{isAuthenticated ? "Connected" : "Not connected"}</p>
                    <p className="mt-3 text-xs font-semibold tracking-[0.2em] text-foreground/55 uppercase">Token expires</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isAuthenticated ? formatExpiresAt(authStatusQuery.data?.expires_at) : "No active Spotify session"}
                    </p>
                  </div>
                  {authStatusQuery.isError ? (
                    <p className="mt-3 rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {getErrorMessage(authStatusQuery.error)}
                    </p>
                  ) : null}
                  {whoAmIQuery.isError ? (
                    <p className="mt-3 rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {getErrorMessage(whoAmIQuery.error)}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="rounded-2xl bg-background"
                      onClick={() => void refreshSession()}
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Refresh
                    </Button>
                    {whoAmIQuery.data?.profile_url ? (
                      <a
                        href={whoAmIQuery.data.profile_url}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(buttonVariants({ variant: "secondary" }), "rounded-2xl border border-border bg-card")}
                      >
                        Open profile
                      </a>
                    ) : null}
                  </div>
                  <div className="my-3 h-px bg-border" />
                  <Button
                    variant="ghost"
                    className="w-full justify-start rounded-2xl bg-background hover:bg-card"
                    disabled={isLoggingOut}
                    onClick={async () => {
                      setIsProfileOpen(false)
                      await handleSpotifyLogout()
                    }}
                  >
                    {isLoggingOut ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                    Log out
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <nav className="mt-5 flex items-center gap-6 overflow-x-auto border-b border-white/10 pb-0.5">
            {primaryNavigation.map((item) => (
              <NavLink
                key={item.to}
                end={item.to === "/app"}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "border-b-2 px-1 pb-4 text-sm font-medium whitespace-nowrap transition-colors",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-foreground/58 hover:text-foreground/85",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="relative z-10 pb-16">
        <Outlet />
      </main>
    </div>
  )
}
