export interface TrailPoint {
  t: number
  lon: number
  lat: number
}

const KEEP_MS = 90 * 60_000
const MAX_POINTS = 360

export class TrailBook {
  private trails = new Map<string, TrailPoint[]>()
  private seen = new Set<number>()

  record(stamp: number, items: { id: string; lon: number; lat: number; t: number }[]) {
    if (this.seen.has(stamp)) return
    this.seen.add(stamp)
    const cutoff = Date.now() - KEEP_MS
    for (const item of items) {
      const list = this.trails.get(item.id) ?? []
      const last = list[list.length - 1]
      if (!last || (item.t > last.t && (last.lon !== item.lon || last.lat !== item.lat))) list.push({ t: item.t, lon: item.lon, lat: item.lat })
      while (list.length > MAX_POINTS || (list.length > 0 && list[0].t < cutoff)) list.shift()
      this.trails.set(item.id, list)
    }
    if (this.seen.size > 500) this.seen.clear()
  }

  get(id: string): TrailPoint[] {
    return this.trails.get(id) ?? []
  }
}

export function lineCoords(points: TrailPoint[], head?: [number, number]): [number, number][] {
  const coords: [number, number][] = points.map((p) => [p.lon, p.lat])
  if (head) coords.push(head)
  const out: [number, number][] = []
  for (const c of coords) {
    const prev = out[out.length - 1]
    if (prev && Math.abs(c[0] - prev[0]) > 180) continue
    out.push(c)
  }
  return out
}

export function greatCircle(from: [number, number], to: [number, number], steps = 64): [number, number][] {
  const r = Math.PI / 180
  const [lon1, lat1] = [from[0] * r, from[1] * r]
  const [lon2, lat2] = [to[0] * r, to[1] * r]
  const d = 2 * Math.asin(Math.sqrt(Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2))
  if (d === 0) return [from, to]
  const out: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const f = i / steps
    const a = Math.sin((1 - f) * d) / Math.sin(d)
    const b = Math.sin(f * d) / Math.sin(d)
    const x = a * Math.cos(lat1) * Math.cos(lon1) + b * Math.cos(lat2) * Math.cos(lon2)
    const y = a * Math.cos(lat1) * Math.sin(lon1) + b * Math.cos(lat2) * Math.sin(lon2)
    const z = a * Math.sin(lat1) + b * Math.sin(lat2)
    out.push([Math.atan2(y, x) / r, Math.atan2(z, Math.sqrt(x * x + y * y)) / r])
  }
  return out
}

export function distanceKm(a: [number, number], b: [number, number]): number {
  const r = Math.PI / 180
  const h = Math.sin(((b[1] - a[1]) * r) / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(((b[0] - a[0]) * r) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}
