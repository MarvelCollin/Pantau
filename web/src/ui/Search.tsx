import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { MagnifyingGlass } from '@phosphor-icons/react'
import type { Envelope } from '../lib/api'
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

function useResults(text: string): Result[] {
  const client = useQueryClient()
  return useMemo(() => {
    const q = text.trim().toLowerCase()
    if (q.length < 2) return []
    const out: Result[] = []
    const has = (s?: string) => {
      if (!s) return false
      const lower = s.toLowerCase()
      if (q.includes(' ')) return lower.includes(q)
      return lower.split(/[^a-z0-9]+/).some((word) => word.startsWith(q))
    }

    for (const [name, region, lon, lat] of cities) if (has(name)) out.push({ key: `city-${name}`, label: name, hint: region, lon, lat, zoom: 10 })
    for (const v of envelopes<Volcano>(client, 'volcanoes'))
      if (has(v.name)) out.push({ key: `v-${v.code}`, label: v.name, hint: `Volcano, ${v.province}`, lon: v.lon, lat: v.lat, zoom: 10, layer: 'volcanoes', id: v.code })
    for (const c of envelopes<Camera>(client, 'cameras'))
      if (has(c.name) || has(c.area)) out.push({ key: c.id, label: c.name, hint: `Camera, ${c.area ?? c.source}`, lon: c.lon, lat: c.lat, zoom: 13, layer: 'cameras', id: c.id })
    const seen = new Set<string>()
    for (const f of envelopes<Flight>(client, 'flights')) {
      if (seen.has(f.hex) || !(has(f.callsign) || has(f.reg) || f.hex === q)) continue
      seen.add(f.hex)
      out.push({ key: `f-${f.hex}`, label: f.callsign ?? f.reg ?? f.hex, hint: `Flight, ${f.type ?? 'aircraft'}`, lon: f.lon, lat: f.lat, zoom: 9, layer: 'flights', id: f.hex })
    }
    for (const e of envelopes<Quake>(client, 'quakes'))
      if (e.source === 'BMKG' && has(e.place)) out.push({ key: e.id, label: `M${e.mag.toFixed(1)} ${e.place}`, hint: 'Earthquake', lon: e.lon, lat: e.lat, zoom: 7, layer: 'quakes', id: e.id })
    return out.slice(0, 8)
  }, [text, client])
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
          placeholder={narrow ? 'Search' : 'Search places, volcanoes, flights'}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
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
              Nothing found. Turn on a layer to search its items.
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
