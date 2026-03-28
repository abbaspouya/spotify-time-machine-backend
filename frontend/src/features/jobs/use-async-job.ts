import { useQuery } from "@tanstack/react-query"

import { getJob } from "@/lib/api"


export function isActiveJobStatus(status?: string | null) {
  return status === "queued" || status === "running"
}


export function useAsyncJob<T>(jobId: string | null) {
  return useQuery({
    queryKey: ["job", jobId],
    queryFn: () => getJob<T>(jobId as string),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return isActiveJobStatus(status) || !status ? 1000 : false
    },
    staleTime: 0,
  })
}
