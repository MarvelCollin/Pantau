import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Feature, FeatureCollection } from 'geojson'
import { getEnvelope, getJson, type Envelope } from '../lib/api'
import { formatAgo, formatClock, formatCoord, formatNumber } from '../lib/format'
import { useLayerOn, useStore } from '../state/store'
import { useMapLayer } from '../map/useMapLayer'
import { usePalette } from '../map/usePalette'
import { cssVar } from '../theme'
import { useLayerStatus } from './useLayerStatus'
import { TrailBook, distanceKm, greatCircle, lineCoords } from './trails'
import { DetailHeader, ExternalLink, Facts, Gone, Lead, Section } from '../ui/Detail'
import styles from './flights.module.css'
import { airlineName, flightNumber } from './airlines'
import { useMap } from '../map/context'

export interface Flight {
  hex: string
  callsign?: string
  reg?: string
  type?: string
  lat: number
  lon: number
  altFt: number | null
  ground: boolean
  speedKt?: number
  track?: number
  vertFpm?: number
  squawk?: string
  emergency?: string
  military: boolean
  seen: number
  route?: { from: RouteAirport; to: RouteAirport; stops: number }
}

export interface RouteAirport {
  code: string
  iata?: string
  name: string
  city: string
  country: string
  lat: number
  lon: number
}

export function routeLabel(f: Flight): string | undefined {
  return f.route ? `${f.route.from.city} to ${f.route.to.city}` : undefined
}

export function servesAirport(f: Flight, code: string): boolean {
  return f.route?.from.code === code || f.route?.to.code === code
}

interface Airport {
  iata_code?: string
  icao_code: string
  name: string
  municipality?: string
  country_name?: string
  latitude: number
  longitude: number
}

interface Route {
  airline?: { name: string; iata?: string; icao?: string; country?: string }
  origin: Airport
  destination: Airport
}

interface Photo {
  src: string
  width: number
  height: number
  link: string
  photographer: string
}


const CELL = 5
const DETAIL_ZOOM = 6
const trails = new TrailBook()

function project(f: Flight, seconds: number): [number, number] {
  if (f.ground || !f.speedKt || f.track === undefined || seconds <= 0) return [f.lon, f.lat]
  const t = Math.min(seconds, 90)
  const km = f.speedKt * 1.852 * (t / 3600)
  const rad = (f.track * Math.PI) / 180
  const dLat = (km * Math.cos(rad)) / 111.32
  const dLon = (km * Math.sin(rad)) / (111.32 * Math.cos((f.lat * Math.PI) / 180))
  return [f.lon + dLon, f.lat + dLat]
}

function useFlightsData(on: boolean) {
  const view = useStore((s) => s.view)
  const detailed = (view?.zoom ?? 0) >= DETAIL_ZOOM
  const lat = view ? Math.round(view.center[1] / CELL) * CELL : 0
  const lon = view ? ((((Math.round(view.center[0] / CELL) * CELL + 180) % 360) + 360) % 360) - 180 : 0
  const query = useQuery({
    queryKey: detailed ? ['flights', lat, lon] : ['flights', 'overview'],
    queryFn: ({ signal }) => getEnvelope<Flight[]>(detailed ? `/api/flights?lat=${lat}&lon=${lon}` : '/api/flights/overview', signal),
    enabled: on && view !== null,
    staleTime: detailed ? 15_000 : 40_000,
    refetchInterval: detailed ? 20_000 : 45_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  })
  const env = query.data
  useEffect(() => {
    if (!env) return
    trails.record(
      env.fetchedAt,
      env.items.map((f) => ({ id: f.hex, lon: f.lon, lat: f.lat, t: env.fetchedAt - f.seen * 1000 })),
    )
  }, [env])
  return { query, detailed }
}

function useRoute(callsign?: string) {
  return useQuery({
    queryKey: ['route', callsign],
    queryFn: async ({ signal }) => {
      try {
        const res = await getJson<{ response: { flightroute?: Route } | string }>(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign!)}`, signal)
        const route = typeof res.response === 'object' ? (res.response.flightroute ?? null) : null
        const known = airlineName(callsign!)
        if (route && known && route.airline?.name !== known) route.airline = { ...route.airline, name: known, country: undefined }
        return route
      } catch {
        return null
      }
    },
    enabled: !!callsign && /^[A-Z]{3}\d/.test(callsign),
    staleTime: 12 * 3600_000,
    gcTime: 24 * 3600_000,
    meta: { persist: true },
  })
}

function airportOf(a: RouteAirport): Airport {
  return { iata_code: a.iata, icao_code: a.code, name: a.name, municipality: a.city, country_name: a.country, latitude: a.lat, longitude: a.lon }
}

function resolveRoute(f: Flight | undefined, fallback: Route | null | undefined): Route | undefined {
  if (!f) return undefined
  if (f.route) {
    const name = f.callsign ? airlineName(f.callsign) : undefined
    return { airline: fallback?.airline ?? (name ? { name } : undefined), origin: airportOf(f.route.from), destination: airportOf(f.route.to) }
  }
  return fallback ?? undefined
}

const lastSeen = new Map<string, { flight: Flight; at: number }>()

function usePhoto(hex: string) {
  return useQuery({
    queryKey: ['photo', hex],
    queryFn: ({ signal }) => getEnvelope<Photo | null>(`/api/flights/photo?hex=${hex}`, signal),
    staleTime: 24 * 3600_000,
    meta: { persist: true },
  })
}

function FlightsLayer() {
  const on = useLayerOn('flights')
  const { query, detailed } = useFlightsData(on)
  const palette = usePalette()
  const color = palette.color('flights')
  const view = useStore((s) => s.view)
  const selected = useStore((s) => (s.selection?.kind === 'item' && s.selection.layer === 'flights' ? s.selection.id : null))
  const [tick, setTick] = useState(() => Date.now())
  const env = query.data
  const selectedFlight = selected ? env?.items.find((f) => f.hex === selected) : undefined
  const fallbackRoute = useRoute(selectedFlight && !selectedFlight.route ? selectedFlight.callsign : undefined).data
  const route = resolveRoute(selectedFlight, fallbackRoute)
  const filter = useStore((s) => s.airportFilter)
  const follow = useStore((s) => s.followFlight)
  const map = useMap()

  const animate = (view?.zoom ?? 0) >= 6.5 || selected !== null
  useEffect(() => {
    if (!on || !animate) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setTick(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [on, animate])

  const data = useMemo<FeatureCollection>(() => {
    const features: Feature[] = []
    if (!env) return { type: 'FeatureCollection', features }
    for (const f of env.items) {
      if (filter && f.hex !== selected && !servesAirport(f, filter.code)) continue
      const coords = project(f, (tick - env.fetchedAt) / 1000 + f.seen)
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coords },
        properties: {
          id: f.hex,
          role: 'plane',
          track: f.track ?? 0,
          kind: f.emergency ? 'emergency' : f.military ? 'military' : f.ground ? 'ground' : 'air',
          label: f.callsign ?? f.reg ?? f.hex,
          title: [flightNumber(f.callsign) ?? f.callsign ?? f.hex, routeLabel(f), f.altFt ? `${formatNumber(f.altFt)} ft` : f.ground ? 'on the ground' : ''].filter(Boolean).join(', '),
        },
      })
      if (f.hex === selected) {
        const trail = lineCoords(trails.get(f.hex), coords)
        if (trail.length > 1) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: trail }, properties: { role: 'trail' } })
      }
    }
    if (route) {
      const from: [number, number] = [route.origin.longitude, route.origin.latitude]
      const to: [number, number] = [route.destination.longitude, route.destination.latitude]
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: greatCircle(from, to) }, properties: { role: 'route' } })
      for (const [airport, at] of [
        [route.origin, from],
        [route.destination, to],
      ] as const)
        features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: at }, properties: { role: 'airport', code: airport.iata_code ?? airport.icao_code } })
    }
    return { type: 'FeatureCollection', features }
  }, [env, tick, selected, route, filter])

  const military = cssVar('--accent-strong')
  const specs = useMemo(
    () => [
      {
        id: 'flights-route',
        type: 'line' as const,
        filter: ['==', ['get', 'role'], 'route'],
        paint: { 'line-color': color, 'line-width': 1.5, 'line-opacity': 0.55, 'line-dasharray': [1, 2.5] },
      },
      {
        id: 'flights-trail',
        type: 'line' as const,
        filter: ['==', ['get', 'role'], 'trail'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': color, 'line-width': 3, 'line-opacity': 0.85 },
      },
      {
        id: 'flights-airport',
        type: 'symbol' as const,
        filter: ['==', ['get', 'role'], 'airport'],
        layout: {
          'icon-image': 'square',
          'icon-size': 0.35,
          'text-field': ['get', 'code'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 11,
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
          'icon-allow-overlap': true,
        },
        paint: { 'icon-color': color, 'text-color': color, 'text-halo-color': palette.halo, 'text-halo-width': 1.5 },
      },
      {
        id: 'flights-icon',
        type: 'symbol' as const,
        filter: ['==', ['get', 'role'], 'plane'],
        layout: {
          'icon-image': 'plane',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.42, 8, 0.62, 12, 0.8],
          'icon-rotate': ['get', 'track'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'text-field': ['step', ['zoom'], '', 8, ['get', 'label']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'icon-color': ['match', ['get', 'kind'], 'emergency', palette.danger, 'military', military, 'ground', cssVar('--muted'), color],
          'icon-halo-color': palette.halo,
          'icon-halo-width': 1.5,
          'text-color': color,
          'text-halo-color': palette.halo,
          'text-halo-width': 1.5,
        },
      },
    ],
    [color, palette, military],
  )

  useMapLayer({
    owner: 'flights',
    sourceId: 'flights',
    source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    layers: specs as never,
    data,
    visible: on,
    interactive: ['flights-icon'],
  })

  useEffect(() => {
    if (!map || !follow || !selectedFlight || !env) return
    const [lon, lat] = project(selectedFlight, (tick - env.fetchedAt) / 1000 + selectedFlight.seen)
    map.easeTo({ center: [lon, lat], duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900 })
  }, [map, follow, selectedFlight, env, tick])

  useEffect(() => {
    if (env && selected) {
      const f = env.items.find((i) => i.hex === selected)
      if (f) lastSeen.set(selected, { flight: f, at: env.fetchedAt })
    }
  }, [env, selected])

  const inView = useMemo(() => {
    if (!env) return undefined
    const list = filter ? env.items.filter((f) => servesAirport(f, filter.code)) : env.items
    if (!view) return list.length
    const [w, s, e, n] = view.bounds
    return list.filter((f) => f.lat >= s && f.lat <= n && f.lon >= w && f.lon <= e).length
  }, [env, view, filter])

  useLayerStatus('flights', on, query, {
    count: inView,
    note: filter ? `to or from ${filter.label} in view` : detailed ? 'in view' : 'in view, zoom in for more',
    staleAfterMs: 3 * 60_000,
  })
  return null
}

function useFlight(hex: string): { flight?: Flight; fetchedAt?: number; lost?: boolean } {
  const client = useQueryClient()
  const [, force] = useState(0)
  useEffect(
    () =>
      client.getQueryCache().subscribe((event) => {
        if (event.type === 'updated' && event.action.type === 'success' && event.query.queryKey[0] === 'flights') force((n) => n + 1)
      }),
    [client],
  )
  let best: { flight: Flight; fetchedAt: number } | undefined
  for (const q of client.getQueryCache().findAll({ queryKey: ['flights'] })) {
    const env = q.state.data as Envelope<Flight[]> | undefined
    const f = env?.items.find((i) => i.hex === hex)
    if (f && env && (!best || env.fetchedAt > best.fetchedAt)) best = { flight: f, fetchedAt: env.fetchedAt }
  }
  if (best) return best
  const last = lastSeen.get(hex)
  return last ? { flight: last.flight, fetchedAt: last.at, lost: true } : {}
}

function phase(f: Flight, route?: Route): string | undefined {
  const to = route ? (route.destination.municipality ?? route.destination.name) : undefined
  const from = route ? (route.origin.municipality ?? route.origin.name) : undefined
  if (f.ground) return to && route && distanceKm([f.lon, f.lat], [route.destination.longitude, route.destination.latitude]) < 15 ? `On the ground in ${to}` : 'On the ground'
  const vr = f.vertFpm ?? 0
  if (vr < -500) return to ? `Descending into ${to}` : 'Descending'
  if (vr > 500) return from ? `Climbing out of ${from}` : 'Climbing'
  return to ? `Cruising to ${to}` : 'Cruising'
}

function RouteBlock({ route, flight }: { route: Route; flight: Flight }) {
  const from: [number, number] = [route.origin.longitude, route.origin.latitude]
  const to: [number, number] = [route.destination.longitude, route.destination.latitude]
  const total = distanceKm(from, to)
  const left = distanceKm([flight.lon, flight.lat], to)
  const progress = Math.max(0, Math.min(1, 1 - left / total))
  const etaMin = flight.speedKt && flight.speedKt > 60 && !flight.ground ? Math.round((left / (flight.speedKt * 1.852)) * 60 + (left < 150 ? 4 : 10)) : undefined
  const landsAt = etaMin !== undefined && etaMin < 18 * 60 ? formatClock(Date.now() + etaMin * 60_000) : undefined
  const place = (a: Airport) => a.municipality ?? a.name

  return (
    <div className={styles.route}>
      <div className={styles.ends}>
        <span>
          <span className={styles.code}>{route.origin.iata_code ?? route.origin.icao_code}</span>
          <span className={styles.city}>{place(route.origin)}</span>
        </span>
        <span className={styles.to}>
          <span className={styles.code}>{route.destination.iata_code ?? route.destination.icao_code}</span>
          <span className={styles.city}>{place(route.destination)}</span>
        </span>
      </div>
      <div
        className={styles.bar}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label="Share of the route flown"
      >
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>
      {landsAt && etaMin !== undefined && (
        <p className={styles.eta}>
          Lands around <strong className="num">{landsAt} WIB</strong>
          <span className={styles.left}>, in about {etaMin >= 60 ? `${Math.floor(etaMin / 60)} h ${etaMin % 60} min` : `${etaMin} min`}</span>
        </p>
      )}
      <p className={styles.left}>
        {formatNumber(Math.round(left))} km to go of {formatNumber(Math.round(total))} km. Estimated from the current speed, not the airline schedule.
      </p>
    </div>
  )
}

function FlightDetail({ id }: { id: string }) {
  const { flight: f, fetchedAt, lost } = useFlight(id)
  const fallback = useRoute(f && !f.route ? f.callsign : undefined)
  const route = { data: resolveRoute(f, fallback.data) }
  const photo = usePhoto(id)
  const follow = useStore((s) => s.followFlight)
  const setFollow = useStore((s) => s.setFollowFlight)
  if (!f) return <Gone layer="flights" />
  const number = flightNumber(f.callsign)
  const status = phase(f, route.data)
  const title = number ?? f.callsign ?? f.reg ?? f.hex.toUpperCase()
  const km = f.speedKt ? Math.round(f.speedKt * 1.852) : undefined
  const altM = f.altFt ? Math.round(f.altFt * 0.3048) : undefined
  const trail = trails.get(f.hex)
  const trailMin = trail.length > 1 ? Math.round((trail[trail.length - 1].t - trail[0].t) / 60_000) : 0
  const pic = photo.data?.items

  return (
    <>
      <DetailHeader
        layer="flights"
        title={title}
        subtitle={[route.data?.airline?.name, number ? f.callsign : undefined, f.type, f.reg].filter(Boolean).join(', ') || 'Unknown aircraft'}
      />
      {lost && fetchedAt && (
        <p className={styles.lost} role="status">
          Last seen {formatAgo(fetchedAt)}. It has probably landed or flown out of receiver range, so this is its last known state.
        </p>
      )}
      {f.emergency && <p className={styles.emergency}>Emergency squawk: {f.emergency}</p>}
      {status && <p className={styles.phase}>{status}</p>}
      {route.data ? (
        <RouteBlock route={route.data} flight={f} />
      ) : (
        <p className={styles.left}>Route unknown. This callsign is not in the open route database yet.</p>
      )}
      {!lost && (
        <button type="button" className={styles.follow} aria-pressed={follow} onClick={() => setFollow(!follow)}>
          {follow ? 'Following on the map, tap to stop' : 'Follow on the map'}
        </button>
      )}
      <Lead
        value={f.ground ? 'Ground' : f.altFt !== null ? formatNumber(f.altFt) : 'Unknown'}
        unit={f.ground || f.altFt === null ? undefined : 'ft'}
        label={altM ? `${formatNumber(altM)} m above sea level` : 'Altitude'}
      />
      <Facts
        rows={[
          ['Speed', f.speedKt !== undefined ? <span className="num">{f.speedKt} kt, {km} km/h</span> : undefined],
          ['Heading', f.track !== undefined ? <span className="num">{Math.round(f.track)}°</span> : undefined],
          ['Climb rate', f.vertFpm ? <span className="num">{f.vertFpm > 0 ? '+' : ''}{formatNumber(f.vertFpm)} ft/min</span> : undefined],
          ['Airline', route.data?.airline ? `${route.data.airline.name}${route.data.airline.country ? `, ${route.data.airline.country}` : ''}` : undefined],
          ['From', route.data ? `${route.data.origin.name}${route.data.origin.iata_code ? ` (${route.data.origin.iata_code})` : ''}` : undefined],
          ['To', route.data ? `${route.data.destination.name}${route.data.destination.iata_code ? ` (${route.data.destination.iata_code})` : ''}` : undefined],
          ['Squawk', f.squawk],
          ['Operator type', f.military ? 'Military' : undefined],
          ['ICAO address', <span className="num">{f.hex.toUpperCase()}</span>],
          ['Position', <span className="num">{formatCoord(f.lat, f.lon)}</span>],
          ['Trail', trailMin > 0 ? `Solid line shows the last ${trailMin} min seen by Pantau` : 'Trail builds up while you watch'],
        ]}
      />
      {pic && (
        <Section>
          <figure className={styles.photo}>
            <img src={pic.src} alt={`Photo of ${f.reg ?? 'this aircraft'}${f.type ? `, a ${f.type}` : ''}`} width={pic.width} height={pic.height} loading="lazy" />
            <figcaption>
              Photo by <a href={pic.link} target="_blank" rel="noreferrer noopener">{pic.photographer} on Planespotters</a>
            </figcaption>
          </figure>
        </Section>
      )}
      <Section>
        <ExternalLink href={`https://adsb.lol/?icao=${f.hex}`}>Full history on adsb.lol</ExternalLink>
        {f.callsign && <ExternalLink href={`https://www.flightaware.com/live/flight/${encodeURIComponent(f.callsign)}`}>Flight on FlightAware</ExternalLink>}
        <p className={styles.credit}>Route and airline from adsbdb. Planned routes can differ from today's flight.</p>
      </Section>
    </>
  )
}

export const flightsModule = { Layer: FlightsLayer, Detail: FlightDetail }
