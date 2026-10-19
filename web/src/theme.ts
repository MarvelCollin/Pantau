export type ThemeName = 'light' | 'dark'

export interface BasemapPalette {
  land: string
  water: string
  park: string
  built: string
  road: string
  roadCase: string
  boundary: string
  label: string
  labelMuted: string
  halo: string
  waterLabel: string
  shade: number
}

export const basemapPalettes: Record<ThemeName, BasemapPalette> = {
  light: {
    land: '#eff5f0',
    water: '#b4dce7',
    park: '#dbeede',
    built: '#e6ecea',
    road: '#fafcfd',
    roadCase: '#d0d9da',
    boundary: '#769a9e',
    label: '#2f474a',
    labelMuted: '#5d7376',
    halo: '#f1f8f9',
    waterLabel: '#1f5d6c',
    shade: 0.35,
  },
  dark: {
    land: '#171f1e',
    water: '#031218',
    park: '#1b241d',
    built: '#1d2626',
    road: '#293233',
    roadCase: '#212829',
    boundary: '#425a5d',
    label: '#b0c2c4',
    labelMuted: '#7f9496',
    halo: '#0e1819',
    waterLabel: '#6f9ea8',
    shade: 0.12,
  },
}

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
