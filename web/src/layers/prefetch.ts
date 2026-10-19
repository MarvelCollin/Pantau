import { queryClient } from '../lib/query'
import { getEnvelope } from '../lib/api'
import type { LayerId } from './registry'

const paths: Partial<Record<LayerId, { path: string; staleTime: number }>> = {
  quakes: { path: '/api/quakes', staleTime: 2 * 60_000 },
  volcanoes: { path: '/api/volcanoes', staleTime: 15 * 60_000 },
  fires: { path: '/api/fires', staleTime: 20 * 60_000 },
  karhutla: { path: '/api/karhutla', staleTime: 15 * 60_000 },
  firecrews: { path: '/api/karhutla/crews', staleTime: 30 * 60_000 },
  air: { path: '/api/air', staleTime: 15 * 60_000 },
  reports: { path: '/api/reports', staleTime: 5 * 60_000 },
  cameras: { path: '/api/cameras', staleTime: 4 * 60_000 },
}

export function prefetchLayer(id: LayerId) {
  const target = paths[id]
  if (!target) return
  queryClient.prefetchQuery({
    queryKey: [id],
    queryFn: ({ signal }) => getEnvelope(target.path, signal),
    staleTime: target.staleTime,
  })
}
