import { createContext, useContext } from 'react'
import type { Map as MapLibre } from 'maplibre-gl'
import type { LayerId } from '../layers/registry'

export const MapContext = createContext<MapLibre | null>(null)

export function useMap(): MapLibre | null {
  return useContext(MapContext)
}

export const interactiveLayers = new Map<string, LayerId>()

export function firstLabelLayer(map: MapLibre): string | undefined {
  return map.getStyle().layers.find((l) => l.type === 'symbol')?.id
}
