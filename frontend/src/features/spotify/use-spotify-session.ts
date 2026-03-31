import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { ApiError, getAuthStatus, getLoginUrl, getWhoAmI, logoutSpotify } from "@/lib/api"
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

type UseSpotifySessionOptions = {
  accountRole?: SpotifyAccountRole
  returnTo?: string
}

export function useSpotifySession(options: UseSpotifySessionOptions = {}) {
  const queryClient = useQueryClient()
  const accountRole = options.accountRole ?? "source"

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
    enabled: isAuthenticated,
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
    handleSpotifyLogin,
    handleSpotifyLogout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
    refreshSession,
  }
}
