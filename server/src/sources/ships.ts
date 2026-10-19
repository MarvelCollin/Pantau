import { UpstreamError, round } from '../lib/http.js'

export interface Ship {
  mmsi: number
  name?: string
  lat: number
  lon: number
  sog?: number
  cog?: number
  heading?: number
  status?: number
  shipType?: number
  destination?: string
  callsign?: string
  time: number
}

interface AisMessage {
  MessageType: string
  MetaData: { MMSI: number; ShipName?: string; latitude: number; longitude: number; time_utc: string }
  Message: Record<string, Record<string, unknown>>
}

const COLLECT_MS = 6000
const KEEP_MS = 45 * 60_000
const MAX_SHIPS = 6000
const BOXES = [
  [
    [-12, 94],
    [8, 142],
  ],
]

const fleet = new Map<number, Ship>()

export class MissingKeyError extends Error {}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function apply(msg: AisMessage) {
  const meta = msg.MetaData
  if (!meta || !Number.isFinite(meta.latitude) || !Number.isFinite(meta.longitude)) return
  const prev = fleet.get(meta.MMSI)
  const ship: Ship = {
    ...prev,
    mmsi: meta.MMSI,
    name: meta.ShipName?.trim() || prev?.name,
    lat: round(meta.latitude),
    lon: round(meta.longitude),
    time: Date.parse(meta.time_utc.replace(/\.\d+/, '').replace(' +0000 UTC', 'Z').replace(' ', 'T')) || Date.now(),
  }
  const body = msg.Message[msg.MessageType] ?? {}
  if (msg.MessageType === 'ShipStaticData') {
    ship.shipType = num(body.Type) ?? prev?.shipType
    ship.destination = typeof body.Destination === 'string' ? body.Destination.trim() || undefined : prev?.destination
    ship.callsign = typeof body.CallSign === 'string' ? body.CallSign.trim() || undefined : prev?.callsign
    if (prev) {
      ship.lat = prev.lat
      ship.lon = prev.lon
      ship.time = prev.time
    }
  } else {
    ship.sog = num(body.Sog)
    ship.cog = num(body.Cog)
    const heading = num(body.TrueHeading)
    ship.heading = heading !== undefined && heading < 360 ? heading : undefined
    ship.status = num(body.NavigationalStatus) ?? prev?.status
  }
  fleet.set(meta.MMSI, ship)
}

function collect(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let received = 0
    let settled = false
    const ws = new WebSocket('wss://stream.aisstream.io/v0/stream')
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) ws.close()
      if (error && received === 0) reject(error)
      else resolve()
    }
    const timer = setTimeout(() => finish(), COLLECT_MS)
    ws.addEventListener('open', () => {
      ws.send(
        JSON.stringify({
          APIKey: key,
          BoundingBoxes: BOXES,
          FilterMessageTypes: ['PositionReport', 'StandardClassBPositionReport', 'ShipStaticData'],
        }),
      )
    })
    ws.addEventListener('message', async (event) => {
      try {
        const raw = typeof event.data === 'string' ? event.data : await new Response(event.data as Blob).text()
        const msg = JSON.parse(raw) as AisMessage & { error?: string }
        if (msg.error) return finish(new UpstreamError('aisstream', 401))
        received++
        apply(msg)
      } catch {
        return
      }
    })
    ws.addEventListener('error', () => finish(new UpstreamError('aisstream', 502)))
    ws.addEventListener('close', () => finish(received ? undefined : new UpstreamError('aisstream', 502)))
  })
}

export async function loadShips(): Promise<Ship[]> {
  const key = process.env.AISSTREAM_KEY
  if (!key) throw new MissingKeyError('AISSTREAM_KEY is not set')
  await collect(key)
  const cutoff = Date.now() - KEEP_MS
  for (const [mmsi, ship] of fleet) if (ship.time < cutoff) fleet.delete(mmsi)
  return [...fleet.values()].sort((a, b) => b.time - a.time).slice(0, MAX_SHIPS)
}
