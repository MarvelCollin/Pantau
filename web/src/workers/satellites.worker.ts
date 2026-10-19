import { json2satrec, propagate, gstime, eciToGeodetic, degreesLat, degreesLong, type OMMJsonObject, type SatRec } from 'satellite.js'

export interface SatPosition {
  id: string
  name: string
  lat: number
  lon: number
  altKm: number
  speedKms: number
}

export type WorkerIn =
  | { type: 'load'; omm: OMMJsonObject[] }
  | { type: 'tick'; time: number }
  | { type: 'track'; id: string; time: number }

export type WorkerOut =
  | { type: 'positions'; time: number; items: SatPosition[] }
  | { type: 'track'; id: string; lines: [number, number][][] }

const sats: { id: string; name: string; rec: SatRec }[] = []

function position(rec: SatRec, date: Date) {
  const pv = propagate(rec, date)
  if (!pv || typeof pv.position === 'boolean' || !pv.position) return null
  const geo = eciToGeodetic(pv.position, gstime(date))
  const v = pv.velocity && typeof pv.velocity !== 'boolean' ? pv.velocity : { x: 0, y: 0, z: 0 }
  return {
    lat: degreesLat(geo.latitude),
    lon: degreesLong(geo.longitude),
    altKm: geo.height,
    speedKms: Math.hypot(v.x, v.y, v.z),
  }
}

const ctx = self as unknown as { onmessage: (e: MessageEvent<WorkerIn>) => void; postMessage: (m: WorkerOut) => void }

ctx.onmessage = (e) => {
  const msg = e.data
  if (msg.type === 'load') {
    sats.length = 0
    for (const o of msg.omm) {
      try {
        sats.push({ id: String(o.NORAD_CAT_ID), name: o.OBJECT_NAME, rec: json2satrec(o) })
      } catch {
        continue
      }
    }
    return
  }
  if (msg.type === 'tick') {
    const date = new Date(msg.time)
    const items: SatPosition[] = []
    for (const s of sats) {
      const p = position(s.rec, date)
      if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon)) items.push({ id: s.id, name: s.name, ...p })
    }
    ctx.postMessage({ type: 'positions', time: msg.time, items })
    return
  }
  if (msg.type === 'track') {
    const sat = sats.find((s) => s.id === msg.id)
    if (!sat) return
    const lines: [number, number][][] = [[]]
    let prevLon: number | null = null
    for (let m = -10; m <= 100; m += 1) {
      const p = position(sat.rec, new Date(msg.time + m * 60_000))
      if (!p) continue
      if (prevLon !== null && Math.abs(p.lon - prevLon) > 180) lines.push([])
      lines[lines.length - 1].push([p.lon, p.lat])
      prevLon = p.lon
    }
    ctx.postMessage({ type: 'track', id: msg.id, lines: lines.filter((l) => l.length > 1) })
  }
}
