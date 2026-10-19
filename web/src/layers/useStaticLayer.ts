import { useQuery } from '@tanstack/react-query'
import { getEnvelope } from '../lib/api'

interface Options {
  key: string
  path: string
  enabled: boolean
  staleMs: number
  pollMs?: number
  persist?: boolean
}

export function useEnvelope<T>({ key, path, enabled, staleMs, pollMs, persist = true }: Options) {
  return useQuery({
    queryKey: [key],
    queryFn: ({ signal }) => getEnvelope<T>(path, signal),
    enabled,
    staleTime: staleMs,
    refetchInterval: pollMs,
    meta: { persist },
  })
}
