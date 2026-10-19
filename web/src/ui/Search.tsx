import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { MagnifyingGlass, MapPin } from '@phosphor-icons/react'
import { getEnvelope, type Envelope } from '../lib/api'
import { queryClient } from '../lib/query'
import { prefetchLayer } from '../layers/prefetch'
import { AIRLINES, airlineName, flightNumber } from '../layers/airlines'
import type { LayerId } from '../layers/registry'
import type { Volcano } from '../layers/volcanoes'
import type { Camera } from '../layers/cameras'
import type { Quake } from '../layers/quakes'
import { routeLabel, type Flight, type RouteAirport } from '../layers/flights'
import { useStore } from '../state/store'
import { cities } from '../map/overview'
import type { AirportFilter } from '../state/store'
import { LayerGlyph } from './LayerGlyph'
import styles from './Search.module.css'

type Scope = 'all' | 'flights' | 'places' | 'volcanoes' | 'cameras' | 'quakes'

const SCOPES: { id: Scope; label: string; placeholder: string; examples: string[] }[] = [
  { id: 'all', label: 'All', placeholder: 'Search a flight, city, volcano or camera', examples: ['Jakarta', 'Garuda', 'Merapi', 'Malioboro'] },
  { id: 'flights', label: 'Flights', placeholder: 'Flight number, airline, city or airport', examples: ['GA', 'Citilink', 'Jakarta', 'DPS'] },
  { id: 'places', label: 'Places', placeholder: 'City or province', examples: ['Bali', 'Medan', 'Makassar'] },
  { id: 'volcanoes', label: 'Volcanoes', placeholder: 'Volcano name', examples: ['Merapi', 'Semeru', 'Krakatau'] },
  { id: 'cameras', label: 'Cameras', placeholder: 'Street or area', examples: ['Malioboro', 'Tugu', 'Cikampek'] },
  { id: 'quakes', label: 'Earthquakes', placeholder: 'Region of a recent earthquake', examples: ['Laut', 'Sulawesi', 'Maluku'] },
]

interface Result {
  kind: Exclude<Scope, 'all'>
  key: string
  label: string
  hint: string
  lon: number
  lat: number
  zoom: number
  layer?: LayerId
  id?: string
  filter?: AirportFilter
}


function envelopes<T>(client: ReturnType<typeof useQueryClient>, key: string): T[] {
  return client
    .getQueryCache()
    .findAll({ queryKey: [key] })
    .flatMap((q) => (q.state.data as Envelope<T[]> | undefined)?.items ?? [])
}

function useCacheVersion() {
  const client = useQueryClient()
  const [version, setVersion] = useState(0)
  useEffect(
    () =>
      client.getQueryCache().subscribe((event) => {
        if (event.type === 'updated' && event.action.type === 'success') setVersion((v) => v + 1)
      }),
    [client],
  )
  return version
}

function useResults(text: string, scope: Scope): Result[] {
  const client = useQueryClient()
  const version = useCacheVersion()
  return useMemo(() => {
    const q = text.trim().toLowerCase()
    if (q.length < 2) return []
    const compact = q.replace(/\s+/g, '')
    const out: Result[] = []
    const has = (s?: string) => {
      if (!s) return false
      const lower = s.toLowerCase()
      if (q.includes(' ')) return lower.includes(q)
      return lower.split(/[^a-z0-9]+/).some((word) => word.startsWith(q))
    }

    for (const [name, region, lon, lat] of cities)
      if (has(name) || has(region)) out.push({ kind: 'places', key: `city-${name}`, label: name, hint: region, lon, lat, zoom: 10 })
    for (const v of envelopes<Volcano>(client, 'volcanoes'))
      if (has(v.name)) out.push({ kind: 'volcanoes', key: `v-${v.code}`, label: v.name, hint: `Volcano, level ${['I', 'II', 'III', 'IV'][v.level - 1]}, ${v.province}`, lon: v.lon, lat: v.lat, zoom: 10, layer: 'volcanoes', id: v.code })
    for (const c of envelopes<Camera>(client, 'cameras'))
      if (has(c.name) || has(c.area)) out.push({ kind: 'cameras', key: c.id, label: c.name, hint: `Camera, ${c.area ?? c.source}${c.online ? '' : ', offline'}`, lon: c.lon, lat: c.lat, zoom: 15, layer: 'cameras', id: c.id })
    const seen = new Set<string>()
    const airports = new Map<string, { airport: RouteAirport; count: number }>()
    const airportHit = (a: RouteAirport) =>
      has(a.city) || has(a.name) || a.code.toLowerCase() === q || (a.iata !== undefined && a.iata.toLowerCase() === q)
    const flightRows: Result[] = []
    for (const f of envelopes<Flight>(client, 'flights')) {
      if (seen.has(f.hex)) continue
      const number = flightNumber(f.callsign)
      const airline = f.callsign ? airlineName(f.callsign) : undefined
      const routeHit = f.route ? [f.route.from, f.route.to].filter(airportHit) : []
      for (const a of routeHit) airports.set(a.code, { airport: a, count: (airports.get(a.code)?.count ?? 0) + 1 })
      const match =
        has(f.callsign) ||
        has(f.reg) ||
        has(airline) ||
        routeHit.length > 0 ||
        (number !== undefined && number.replace(' ', '').toLowerCase().startsWith(compact)) ||
        f.hex === q
      if (!match) continue
      seen.add(f.hex)
      const route = routeLabel(f)
      flightRows.push({
        kind: 'flights',
        key: `f-${f.hex}`,
        label: [number ?? f.callsign ?? f.reg ?? f.hex, route].filter(Boolean).join(', '),
        hint: [airline ?? 'Flight', number ? f.callsign : undefined, f.ground ? 'on the ground' : undefined].filter(Boolean).join(', '),
        lon: f.lon,
        lat: f.lat,
        zoom: 8,
        layer: 'flights',
        id: f.hex,
      })
    }
    for (const { airport, count } of [...airports.values()].sort((a, b) => b.count - a.count).slice(0, 2)) {
      const code = airport.iata ?? airport.code
      out.push({
        kind: 'flights',
        key: `airport-${airport.code}`,
        label: `Show all ${count} flight${count === 1 ? '' : 's'} to or from ${airport.city} (${code})`,
        hint: airport.name,
        lon: airport.lon,
        lat: airport.lat,
        zoom: 6,
        filter: { code: airport.code, label: `${airport.city} (${code})` },
      })
    }
    out.push(...flightRows)
    for (const e of envelopes<Quake>(client, 'quakes'))
      if (e.source === 'BMKG' && has(e.place)) out.push({ kind: 'quakes', key: e.id, label: `M${e.mag.toFixed(1)} ${e.place}`, hint: 'Earthquake', lon: e.lon, lat: e.lat, zoom: 7, layer: 'quakes', id: e.id })
    const code = compact.slice(0, 2).toUpperCase()
    const flightLike = Object.values(AIRLINES).some((a) => a.iata === code) && /^[a-z0-9]{2}\d*$/.test(compact)
    if (flightLike) out.sort((a, b) => Number(b.kind === 'flights') - Number(a.kind === 'flights'))
    return out.filter((r) => scope === 'all' || r.kind === scope).slice(0, scope === 'all' ? 10 : 30)
  }, [text, scope, client, version])
}

function warmSearch() {
  for (const id of ['volcanoes', 'cameras', 'quakes'] as const) prefetchLayer(id)
  queryClient.prefetchQuery({
    queryKey: ['flights', 'overview'],
    queryFn: ({ signal }) => getEnvelope('/api/flights/overview', signal),
    staleTime: 40_000,
  })
}

export function Search() {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const [scope, setScope] = useState<Scope>('all')
  const results = useResults(text, scope)
  const current = SCOPES.find((x) => x.id === scope)!
  const listId = useId()
  const [narrow] = useState(() => matchMedia('(max-width: 900px)').matches)
  const { select, requestFly, toggleLayer } = useStore.getState()

  const choose = (r: Result) => {
    if (r.filter) {
      if (!useStore.getState().enabled.includes('flights')) toggleLayer('flights')
      useStore.getState().setAirportFilter(r.filter)
      select(null)
    } else if (r.layer && r.id) {
      if (!useStore.getState().enabled.includes(r.layer)) toggleLayer(r.layer)
      select({ kind: 'item', layer: r.layer, id: r.id })
    }
    requestFly(r.lon, r.lat, r.zoom)
    setOpen(false)
    setText('')
    input.current?.blur()
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(results.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault()
      choose(results[active])
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      setOpen(false)
    }
  }

  const typed = text.trim().length >= 2
  const showList = open && typed
  const pick = (value: string) => {
    warmSearch()
    setText(value)
    setActive(0)
    input.current?.focus()
  }

  return (
    <div className={styles.search}>
      <label className={styles.field}>
        <MagnifyingGlass size={16} weight="bold" aria-hidden="true" className={styles.icon} />
        <span className="sr-only">Search cities, volcanoes, cameras and flights</span>
        <input
          ref={input}
          className={styles.input}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
          placeholder={narrow ? 'Search' : current.placeholder}
          value={text}
          onChange={(e) => {
            warmSearch()
            setText(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => {
            setOpen(true)
            warmSearch()
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKey}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {open && (
        <div className={styles.panel} onMouseDown={(e) => e.preventDefault()}>
          <div className={styles.scopes} role="radiogroup" aria-label="What are you looking for">
            {SCOPES.map((x) => (
              <button
                key={x.id}
                type="button"
                role="radio"
                aria-checked={scope === x.id}
                className={styles.scope}
                onClick={() => {
                  setScope(x.id)
                  setActive(0)
                  input.current?.focus()
                }}
              >
                {x.label}
              </button>
            ))}
          </div>
          {!typed && (
            <div className={styles.examples}>
              <p className={styles.examplesLabel}>{scope === 'all' ? 'What are you looking for? Pick a type above or try' : `${current.placeholder}, for example`}</p>
              <div className={styles.exampleRow}>
                {current.examples.map((ex) => (
                  <button key={ex} type="button" className={styles.example} onClick={() => pick(ex)}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}
      {showList && (
        <ul id={listId} role="listbox" className={`scroll ${styles.list}`} aria-label="Search results">
          {results.length === 0 ? (
            <li className={styles.empty} role="option" aria-selected="false" aria-disabled="true">
              {scope === 'all' ? 'Nothing found. Try a flight number like GA 410, a city, a volcano or a camera name.' : `No ${current.label.toLowerCase()} match. Try ${current.examples[0]} or switch to All.`}
            </li>
          ) : (
            results.map((r, i) => (
              <li
                key={r.key}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={styles.option}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(r)}
                onMouseEnter={() => setActive(i)}
              >
                <span className={styles.glyph}>
                  {r.layer ? <LayerGlyph id={r.layer} size={16} /> : r.filter ? <LayerGlyph id="flights" size={16} /> : <MapPin size={16} aria-hidden="true" />}
                </span>
                <span className={styles.text}>
                  <span className={styles.label}>{r.label}</span>
                  <span className={styles.hint}>{r.hint}</span>
                </span>
              </li>
            ))
          )}
        </ul>
      )}
        </div>
      )}
    </div>
  )
}
