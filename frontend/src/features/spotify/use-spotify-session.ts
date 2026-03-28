import { useQuery, useQueryClient } from "@tanstack/react-query"

import { getAuthStatus, getLoginUrl, getWhoAmI } from "@/lib/api"

export function formatExpiresAt(value?: number | null) {
  if (!value) {
    return "Unknown"
  }

  return new Date(value * 1000).toLocaleString()
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong."
}

export function useSpotifySession() {
  const queryClient = useQueryClient()

  const authStatusQuery = useQuery({
    queryKey: ["authStatus"],
    queryFn: getAuthStatus,
  })

  const isAuthenticated = authStatusQuery.data?.authenticated === true

  const whoAmIQuery = useQuery({
    queryKey: ["whoami"],
    queryFn: getWhoAmI,
    enabled: isAuthenticated,
  })

  const handleSpotifyLogin = () => {
    window.location.href = getLoginUrl()
  }

  const refreshSession = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["authStatus"] }),
      queryClient.invalidateQueries({ queryKey: ["whoami"] }),
    ])
  }

  return {
    authStatusQuery,
    isAuthenticated,
    whoAmIQuery,
    handleSpotifyLogin,
    refreshSession,
  }
}
