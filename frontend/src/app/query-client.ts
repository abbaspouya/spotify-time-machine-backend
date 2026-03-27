import { QueryClient } from "@tanstack/react-query"

import { ApiError } from "@/lib/api"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          return error.status >= 500 && failureCount < 2
        }

        return failureCount < 2
      },
    },
    mutations: {
      retry: 0,
    },
  },
})
