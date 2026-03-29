import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { getAuthStatus, getLoginUrl, getWhoAmI, logoutSpotify } from "@/lib/api"

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

  const logoutMutation = useMutation({
    mutationFn: logoutSpotify,
    onSuccess: async () => {
      queryClient.setQueryData(["authStatus"], { authenticated: false })
      queryClient.removeQueries({ queryKey: ["whoami"] })
      await queryClient.invalidateQueries({ queryKey: ["authStatus"] })
    },
  })

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
    handleSpotifyLogout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
    refreshSession,
  }
}
