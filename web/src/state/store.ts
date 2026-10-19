import { create } from 'zustand'
import { defaultLayers, layerIds, type LayerId } from '../layers/registry'
import type { ThemeName } from '../theme'

export type LayerState = 'idle' | 'loading' | 'ready' | 'stale' | 'error' | 'needs_key' | 'zoom_in'

export interface LayerStatus {
  state: LayerState
  count?: number
  fetchedAt?: number
  note?: string
}

export type Selection =
  | { kind: 'item'; layer: LayerId; id: string }
  | { kind: 'point'; lat: number; lon: number }
  | null

export interface ViewState {
  center: [number, number]
  zoom: number
  bounds: [number, number, number, number]
}

export interface AirportFilter {
  code: string
  label: string
}

interface Store {
  airportFilter: AirportFilter | null
  followFlight: boolean
  setFollowFlight: (follow: boolean) => void
  setAirportFilter: (filter: AirportFilter | null) => void
  theme: ThemeName
  enabled: LayerId[]
  selection: Selection
  status: Partial<Record<LayerId, LayerStatus>>
  view: ViewState | null
  flyTo: { lon: number; lat: number; zoom?: number; at: number } | null
  setTheme: (theme: ThemeName) => void
  toggleLayer: (id: LayerId) => void
  select: (selection: Selection) => void
  setStatus: (id: LayerId, status: LayerStatus) => void
  setView: (view: ViewState) => void
  requestFly: (lon: number, lat: number, zoom?: number) => void
}

function readLayers(): LayerId[] {
  const raw = new URLSearchParams(location.search).get('layers')
  if (raw === null) return defaultLayers
  return raw.split(',').filter((v): v is LayerId => (layerIds as string[]).includes(v))
}

function readSelection(): Selection {
  const raw = new URLSearchParams(location.search).get('focus')
  if (!raw) return null
  const [layer, ...rest] = raw.split(':')
  const id = rest.join(':')
  if (layer === 'point') {
    const [lat, lon] = id.split(',').map(Number)
    return Number.isFinite(lat) && Number.isFinite(lon) ? { kind: 'point', lat, lon } : null
  }
  if (!(layerIds as string[]).includes(layer) || !id) return null
  return { kind: 'item', layer: layer as LayerId, id }
}

function readTheme(): ThemeName {
  const saved = localStorage.getItem('pantau-theme')
  if (saved === 'light' || saved === 'dark') return saved
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme
}

const initialTheme = readTheme()
applyTheme(initialTheme)

function writeUrl(enabled: LayerId[], selection: Selection) {
  const params = new URLSearchParams(location.search)
  params.set('layers', enabled.join(','))
  if (!selection) params.delete('focus')
  else if (selection.kind === 'point') params.set('focus', `point:${selection.lat.toFixed(3)},${selection.lon.toFixed(3)}`)
  else params.set('focus', `${selection.layer}:${selection.id}`)
  const query = params.toString().replaceAll('%2C', ',').replaceAll('%3A', ':')
  history.replaceState(null, '', `${location.pathname}?${query}${location.hash}`)
}

export const useStore = create<Store>((set, get) => ({
  theme: initialTheme,
  enabled: readLayers(),
  selection: readSelection(),
  status: {},
  view: null,
  flyTo: null,
  airportFilter: null,
  followFlight: false,
  setFollowFlight: (followFlight) => set({ followFlight }),
  setAirportFilter: (airportFilter) => set({ airportFilter }),
  setTheme: (theme) => {
    localStorage.setItem('pantau-theme', theme)
    applyTheme(theme)
    set({ theme })
  },
  toggleLayer: (id) => {
    const { enabled, selection } = get()
    const next = enabled.includes(id) ? enabled.filter((l) => l !== id) : [...enabled, id]
    const keepSelection = selection?.kind === 'item' && !next.includes(selection.layer) ? null : selection
    set({ enabled: next, selection: keepSelection })
    writeUrl(next, keepSelection)
  },
  select: (selection) => {
    set({ selection, followFlight: false })
    writeUrl(get().enabled, selection)
  },
  setStatus: (id, status) => {
    const current = get().status[id]
    if (
      current &&
      current.state === status.state &&
      current.count === status.count &&
      current.fetchedAt === status.fetchedAt &&
      current.note === status.note
    )
      return
    set({ status: { ...get().status, [id]: status } })
  },
  setView: (view) => set({ view }),
  requestFly: (lon, lat, zoom) => set({ flyTo: { lon, lat, zoom, at: Date.now() } }),
}))

export function useLayerOn(id: LayerId): boolean {
  return useStore((s) => s.enabled.includes(id))
}
