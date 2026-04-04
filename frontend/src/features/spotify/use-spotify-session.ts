import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { ApiError, getAuthStatus, getLoginUrl, getSpotifyRateLimitRemainingSeconds, getSpotifyRateLimitUntil, getWhoAmI, logoutSpotify } from "@/lib/api"
import type { SpotifyAccountRole } from "@/lib/types"

export function formatExpiresAt(value?: number | null) {
  if (!value) {
    return "Unknown"
  }

  return new Date(value * 1000).toLocaleString()
}

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 429) {
    if (typeof error.retryAfterSeconds === "number" && Number.isFinite(error.retryAfterSeconds)) {
      const seconds = Math.max(1, Math.round(error.retryAfterSeconds))
      return `${error.message} Wait about ${seconds} second${seconds === 1 ? "" : "s"} before retrying.`
    }

    return `${error.message} Give it a short pause before retrying.`
  }

  return error instanceof Error ? error.message : "Something went wrong."
}

export function useSpotifyApiRateLimit() {
  const [rateLimitUntil, setRateLimitUntil] = useState<number | null>(() => getSpotifyRateLimitUntil())

  useEffect(() => {
    const syncRateLimit = () => {
      setRateLimitUntil(getSpotifyRateLimitUntil())
    }

    syncRateLimit()
    window.addEventListener("spotify-rate-limit-updated", syncRateLimit)
    return () => {
      window.removeEventListener("spotify-rate-limit-updated", syncRateLimit)
    }
  }, [])

  useEffect(() => {
    if (!rateLimitUntil) {
      return
    }

    const remainingMs = rateLimitUntil - Date.now()
    if (remainingMs <= 0) {
      setRateLimitUntil(getSpotifyRateLimitUntil())
      return
    }

    const timeoutId = window.setTimeout(() => {
      setRateLimitUntil(getSpotifyRateLimitUntil())
    }, remainingMs + 100)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [rateLimitUntil])

  const retryAfterSeconds = getSpotifyRateLimitRemainingSeconds()
  const error =
    typeof retryAfterSeconds === "number"
      ? new ApiError(429, "Spotify is rate-limiting requests right now.", retryAfterSeconds)
      : null

  return {
    isRateLimited: typeof retryAfterSeconds === "number",
    retryAfterSeconds,
    rateLimitUntil,
    error,
  }
}

type UseSpotifySessionOptions = {
  accountRole?: SpotifyAccountRole
  returnTo?: string
}

export function useSpotifySession(options: UseSpotifySessionOptions = {}) {
  const queryClient = useQueryClient()
  const accountRole = options.accountRole ?? "source"
  const spotifyRateLimit = useSpotifyApiRateLimit()

  const authStatusQuery = useQuery({
    queryKey: ["authStatus", accountRole],
    queryFn: () => getAuthStatus(accountRole),
    staleTime: 2 * 60_000,
    retry: false,
  })

  const isAuthenticated = authStatusQuery.data?.authenticated === true

  const whoAmIQuery = useQuery({
    queryKey: ["whoami", accountRole],
    queryFn: () => getWhoAmI(accountRole),
    enabled: isAuthenticated && !spotifyRateLimit.isRateLimited,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const handleSpotifyLogin = () => {
    window.location.href = getLoginUrl({
      accountRole,
      returnTo: options.returnTo,
    })
  }

  const logoutMutation = useMutation({
    mutationFn: () => logoutSpotify(accountRole),
    onSuccess: async () => {
      queryClient.setQueryData(["authStatus", accountRole], { authenticated: false })
      queryClient.removeQueries({ queryKey: ["whoami", accountRole] })
      await queryClient.invalidateQueries({ queryKey: ["authStatus", accountRole] })
    },
  })

  const refreshSession = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["authStatus", accountRole] }),
      queryClient.invalidateQueries({ queryKey: ["whoami", accountRole] }),
    ])
  }

  return {
    accountRole,
    authStatusQuery,
    isAuthenticated,
    whoAmIQuery,
    spotifyRateLimit,
    handleSpotifyLogin,
    handleSpotifyLogout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
    refreshSession,
  }
}
