import type { Map as MapLibre, StyleSpecification } from 'maplibre-gl'
import type { BasemapPalette } from '../theme'
import baseStyle from './basemap-style.json'
import landUrl from './geo/land.json?url'
import bordersUrl from './geo/borders.json?url'
import { overviewLabels } from './overview'

type Rule = [RegExp, (p: BasemapPalette) => Record<string, unknown>]

const rules: Rule[] = [
  [/^background$/, (p) => ({ 'background-color': p.land })],
  [/^(water|overview-sea)$/, (p) => ({ 'fill-color': p.water })],
  [/^overview-land$/, (p) => ({ 'fill-color': p.land })],
  [/^overview-borders$/, (p) => ({ 'line-color': p.boundary })],
  [/^waterway/, (p) => ({ 'line-color': p.water })],
  [/^(park|landcover_wood)$/, (p) => ({ 'fill-color': p.park })],
  [/^landcover_(ice_shelf|glacier)$/, (p) => ({ 'fill-color': p.land })],
  [/^landuse_residential$/, (p) => ({ 'fill-color': p.built })],
  [/^building$/, (p) => ({ 'fill-color': p.built, 'fill-outline-color': p.roadCase })],
  [/^(road_area_pier)$/, (p) => ({ 'fill-color': p.land })],
  [/^(road_pier)$/, (p) => ({ 'line-color': p.land })],
  [/^aeroway-area$/, (p) => ({ 'fill-color': p.built })],
  [/casing$/, (p) => ({ 'line-color': p.roadCase })],
  [/subtle$/, (p) => ({ 'line-color': p.roadCase })],
  [/(inner|minor|path|runway|taxiway)$/, (p) => ({ 'line-color': p.road })],
  [/^railway.*dashline$/, (p) => ({ 'line-color': p.land })],
  [/^railway/, (p) => ({ 'line-color': p.roadCase })],
  [/^boundary/, (p) => ({ 'line-color': p.boundary })],
]

const symbolRules: Rule[] = [
  [/^water_name/, (p) => ({ 'text-color': p.waterLabel, 'text-halo-color': p.halo })],
  [/^(waterway_line_label|highway-name|airport|label_overview_island)/, (p) => ({ 'text-color': p.labelMuted, 'text-halo-color': p.halo })],
  [/^label_/, (p) => ({ 'text-color': p.label, 'text-halo-color': p.halo })],
]

function paintFor(id: string, type: string, palette: BasemapPalette): Record<string, unknown> | undefined {
  const list = type === 'symbol' ? symbolRules : rules
  return list.find(([pattern]) => pattern.test(id))?.[1](palette)
}

export function buildStyle(palette: BasemapPalette): StyleSpecification {
  const style = structuredClone(baseStyle) as unknown as StyleSpecification
  const sources = style.sources as Record<string, { data?: unknown }>
  sources['overview-land'].data = new URL(landUrl, location.href).href
  sources['overview-borders'].data = new URL(bordersUrl, location.href).href
  sources['overview-labels'].data = overviewLabels
  for (const layer of style.layers) {
    const paint = paintFor(layer.id, layer.type, palette)
    if (paint) Object.assign(((layer as { paint?: object }).paint ??= {}), paint)
  }
  return style
}

export function applyBasemap(map: MapLibre, palette: BasemapPalette) {
  for (const layer of map.getStyle().layers) {
    if (typeof layer.metadata === 'object' && layer.metadata && 'pantau' in layer.metadata) continue
    const paint = paintFor(layer.id, layer.type, palette)
    if (!paint) continue
    for (const [key, value] of Object.entries(paint)) map.setPaintProperty(layer.id, key as never, value as never)
  }
}

export function firstLabelLayer(map: MapLibre): string | undefined {
  return map.getStyle().layers.find((l) => l.type === 'symbol')?.id
}
