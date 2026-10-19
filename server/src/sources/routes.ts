import { cached } from '../lib/cache.js'
import { fetchText, round } from '../lib/http.js'

export interface Airport {
  code: string
  iata?: string
  name: string
  city: string
  country: string
  lat: number
  lon: number
}

export interface FlightRoute {
  from: Airport
  to: Airport
  stops: number
}

const BASE = 'https://raw.githubusercontent.com/vradarserver/standing-data/main'

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    if (!line) continue
    const cells: string[] = []
    let cur = ''
    let quoted = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"'
          i++
        } else if (ch === '"') quoted = false
        else cur += ch
      } else if (ch === '"') quoted = true
      else if (ch === ',') {
        cells.push(cur)
        cur = ''
      } else cur += ch
    }
    cells.push(cur)
    rows.push(cells)
  }
  return rows
}

async function airlineRoutes(code: string): Promise<Record<string, string[]>> {
  const { entry } = await cached(`routes:${code}`, { ttl: 86400, swr: 6 * 86400, sie: 14 * 86400 }, async () => {
    let text = ''
    try {
      text = await fetchText('Routes', `${BASE}/routes/schema-01/${code[0]}/${code}-all.csv`, { timeoutMs: 8000 })
    } catch {
      return {}
    }
    const out: Record<string, string[]> = {}
    for (const row of parseCsv(text).slice(1)) {
      const [callsign, , , , airports] = row
      if (callsign && airports) out[callsign] = airports.split('-')
    }
    return out
  })
  return entry.value
}

async function airportFile(prefix: string): Promise<Record<string, Airport>> {
  const { entry } = await cached(`airports:${prefix}`, { ttl: 7 * 86400, swr: 7 * 86400, sie: 30 * 86400 }, async () => {
    let text = ''
    try {
      text = await fetchText('Airports', `${BASE}/airports/schema-01/${prefix[0]}/${prefix}.csv`, { timeoutMs: 8000 })
    } catch {
      return {}
    }
    const out: Record<string, Airport> = {}
    for (const row of parseCsv(text).slice(1)) {
      const [code, name, icao, iata, city, country, lat, lon] = row
      if (!icao || icao.length !== 4) continue
      out[icao] = {
        code: icao,
        iata: iata || undefined,
        name,
        city: cleanCity(city || name),
        country,
        lat: round(Number(lat), 3),
        lon: round(Number(lon), 3),
      }
      if (code !== icao && code.length === 4) out[code] = out[icao]
    }
    return out
  })
  return entry.value
}

const CITY_ALIASES: Record<string, string> = {
  'Ujung Pandang': 'Makassar',
  'Temon district': 'Yogyakarta',
  Sukarata: 'Solo',
  'Kuala Namu': 'Medan',
  'Tangerang': 'Jakarta',
  'Kotamadya Balikpapan': 'Balikpapan',
  'Tuban': 'Denpasar',
}

function cleanCity(value: string): string {
  const cleaned = cleanName(value)
  return CITY_ALIASES[cleaned] ?? cleaned
}

function cleanName(value: string): string {
  return value
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/-[^-]*Islands?$/i, '')
    .replace(/\s+Island$/i, '')
    .replace(/^Kotamadya\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = Math.PI / 180
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

interface Enrichable {
  callsign?: string
  lat: number
  lon: number
  route?: FlightRoute
}

export async function attachRoutes<T extends Enrichable>(flights: T[]): Promise<T[]> {
  const airlines = new Set<string>()
  for (const f of flights) if (f.callsign && /^[A-Z]{3}\d/.test(f.callsign)) airlines.add(f.callsign.slice(0, 3))
  const routeMaps = new Map<string, Record<string, string[]>>()
  await Promise.all([...airlines].map(async (a) => routeMaps.set(a, await airlineRoutes(a))))

  const codes = new Map<string, string[]>()
  const prefixes = new Set<string>()
  for (const f of flights) {
    const list = f.callsign ? routeMaps.get(f.callsign.slice(0, 3))?.[f.callsign] : undefined
    if (!list || list.length < 2) continue
    codes.set(f.callsign!, list)
    for (const c of list) if (c.length === 4) prefixes.add(c.slice(0, 2))
  }
  const airportMaps = new Map<string, Record<string, Airport>>()
  await Promise.all([...prefixes].map(async (p) => airportMaps.set(p, await airportFile(p))))
  const lookup = (c: string) => airportMaps.get(c.slice(0, 2))?.[c]

  for (const f of flights) {
    const list = f.callsign ? codes.get(f.callsign) : undefined
    if (!list) continue
    const stops = list.map(lookup)
    if (stops.some((s) => !s)) continue
    let best = 0
    let bestScore = Infinity
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i]!
      const b = stops[i + 1]!
      const score = km(a, f) + km(f, b) - km(a, b)
      if (score < bestScore) {
        bestScore = score
        best = i
      }
    }
    f.route = { from: stops[best]!, to: stops[best + 1]!, stops: stops.length - 2 }
  }
  return flights
}
