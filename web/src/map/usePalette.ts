import { useMemo } from 'react'
import { useStore } from '../state/store'
import { basemapPalettes, cssVar } from '../theme'
import type { LayerId } from '../layers/registry'

export interface MarkerPalette {
  color: (id: LayerId) => string
  halo: string
  ink: string
  danger: string
  warning: string
  success: string
}

export function usePalette(): MarkerPalette {
  const theme = useStore((s) => s.theme)
  return useMemo(() => {
    const cache = new Map<string, string>()
    return {
      color: (id: LayerId) => {
        if (!cache.has(id)) cache.set(id, cssVar(`--c-${id}`))
        return cache.get(id)!
      },
      halo: basemapPalettes[theme].halo,
      ink: cssVar('--ink'),
      danger: cssVar('--danger'),
      warning: cssVar('--warning'),
      success: cssVar('--success'),
    }
  }, [theme])
}
