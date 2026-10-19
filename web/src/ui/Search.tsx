import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { getEnvelope, type Envelope } from '../lib/api'
import { queryClient } from '../lib/query'
import { prefetchLayer } from '../layers/prefetch'
import { AIRLINES, airlineName, flightNumber } from '../layers/airlines'
import type { LayerId } from '../layers/registry'
import type { Volcano } from '../layers/volcanoes'
import type { Camera } from '../layers/cameras'
import type { Quake } from '../layers/quakes'
import type { Flight } from '../layers/flights'
import { useStore } from '../state/store'
import { cities } from '../map/overview'
import { LayerGlyph } from './LayerGlyph'
import styles from './Search.module.css'

interface Result {
  key: string
  label: string
  hint: string
  lon: number
  lat: number
  zoom: number
  layer?: LayerId
  id?: string
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

function useResults(text: string): Result[] {
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
      if (has(name) || has(region)) out.push({ key: `city-${name}`, label: name, hint: region, lon, lat, zoom: 10 })
    for (const v of envelopes<Volcano>(client, 'volcanoes'))
      if (has(v.name)) out.push({ key: `v-${v.code}`, label: v.name, hint: `Volcano, level ${['I', 'II', 'III', 'IV'][v.level - 1]}, ${v.province}`, lon: v.lon, lat: v.lat, zoom: 10, layer: 'volcanoes', id: v.code })
    for (const c of envelopes<Camera>(client, 'cameras'))
      if (has(c.name) || has(c.area)) out.push({ key: c.id, label: c.name, hint: `Camera, ${c.area ?? c.source}${c.online ? '' : ', offline'}`, lon: c.lon, lat: c.lat, zoom: 15, layer: 'cameras', id: c.id })
    const seen = new Set<string>()
    for (const f of envelopes<Flight>(client, 'flights')) {
      if (seen.has(f.hex)) continue
      const number = flightNumber(f.callsign)
      const airline = f.callsign ? airlineName(f.callsign) : undefined
      const match =
        has(f.callsign) ||
        has(f.reg) ||
        has(airline) ||
        (number !== undefined && number.replace(' ', '').toLowerCase().startsWith(compact)) ||
        f.hex === q
      if (!match) continue
      seen.add(f.hex)
      out.push({
        key: `f-${f.hex}`,
        label: number ? `${number}, ${f.callsign}` : (f.callsign ?? f.reg ?? f.hex),
        hint: [airline ?? 'Flight', f.type, f.ground ? 'on the ground' : undefined].filter(Boolean).join(', '),
        lon: f.lon,
        lat: f.lat,
        zoom: 8,
        layer: 'flights',
        id: f.hex,
      })
    }
    for (const e of envelopes<Quake>(client, 'quakes'))
      if (e.source === 'BMKG' && has(e.place)) out.push({ key: e.id, label: `M${e.mag.toFixed(1)} ${e.place}`, hint: 'Earthquake', lon: e.lon, lat: e.lat, zoom: 7, layer: 'quakes', id: e.id })
    const code = compact.slice(0, 2).toUpperCase()
    const flightLike = Object.values(AIRLINES).some((a) => a.iata === code) && /^[a-z0-9]{2}\d*$/.test(compact)
    if (flightLike) out.sort((a, b) => Number(b.layer === 'flights') - Number(a.layer === 'flights'))
    return out.slice(0, 10)
  }, [text, client, version])
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
  const results = useResults(text)
  const listId = useId()
  const [narrow] = useState(() => matchMedia('(max-width: 900px)').matches)
  const { select, requestFly, toggleLayer } = useStore.getState()

  const choose = (r: Result) => {
    if (r.layer && r.id) {
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

  const showList = open && text.trim().length >= 2

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
          placeholder={narrow ? 'Search' : 'Search a flight, city, volcano or camera'}
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
      {showList && (
        <ul id={listId} role="listbox" className={`scroll ${styles.list}`} aria-label="Search results">
          {results.length === 0 ? (
            <li className={styles.empty} role="option" aria-selected="false" aria-disabled="true">
              Nothing found. Try a flight number like GA 410, a city, a volcano or a camera name.
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
                <span className={styles.glyph}>{r.layer ? <LayerGlyph id={r.layer} size={16} /> : <MagnifyingGlass size={16} aria-hidden="true" />}</span>
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
  )
}
