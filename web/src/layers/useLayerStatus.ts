import { useEffect } from 'react'
import { ApiError } from '../lib/api'
import { useStore, type LayerState } from '../state/store'
import type { LayerId } from './registry'

interface Options {
  count?: number
  note?: string
  staleAfterMs: number
  override?: LayerState
}

export interface StatusSource {
  data?: { fetchedAt: number }
  isError: boolean
  error: unknown
}

export function useLayerStatus(id: LayerId, on: boolean, query: StatusSource, options: Options) {
  const setStatus = useStore((s) => s.setStatus)
  const fetchedAt = query.data?.fetchedAt
  const { count, note, staleAfterMs, override } = options
  const errorCode = query.error instanceof ApiError ? query.error.code : undefined

  useEffect(() => {
    if (!on) {
      setStatus(id, { state: 'idle' })
      return
    }
    if (errorCode === 'needs_key') {
      setStatus(id, { state: 'needs_key', note })
      return
    }
    if (query.isError && !fetchedAt) {
      setStatus(id, { state: 'error' })
      return
    }
    if (!fetchedAt) {
      setStatus(id, { state: 'loading' })
      return
    }
    const state: LayerState = override ?? (query.isError ? 'error' : Date.now() - fetchedAt > staleAfterMs ? 'stale' : 'ready')
    setStatus(id, { state, count, note, fetchedAt })
  }, [id, on, fetchedAt, query.isError, errorCode, count, note, staleAfterMs, override, setStatus])
}
