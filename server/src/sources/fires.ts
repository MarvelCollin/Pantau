import { fetchText, round, UpstreamError } from '../lib/http.js'

export type Fire = [lat: number, lon: number, frp: number, confidence: 'l' | 'n' | 'h', time: number, night: 0 | 1]

const URL = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_SouthEast_Asia_24h.csv'
const BOX = { south: -12, north: 8, west: 94, east: 142 }
const WINDOW_S = 24 * 3600

export async function loadFires(): Promise<Fire[]> {
  const csv = await fetchText('NASA FIRMS', URL, { timeoutMs: 15000 })
  const lines = csv.split('\n')
  const header = lines[0]?.split(',') ?? []
  const col = (name: string) => header.indexOf(name)
  const iLat = col('latitude')
  const iLon = col('longitude')
  const iFrp = col('frp')
  const iConf = col('confidence')
  const iDate = col('acq_date')
  const iTime = col('acq_time')
  const iDn = col('daynight')
  if ([iLat, iLon, iFrp, iConf, iDate, iTime].some((i) => i < 0)) throw new UpstreamError('NASA FIRMS', 502)

  const out: Fire[] = []
  for (let n = 1; n < lines.length; n++) {
    const row = lines[n].split(',')
    if (row.length < header.length) continue
    const lat = Number(row[iLat])
    const lon = Number(row[iLon])
    if (!(lat >= BOX.south && lat <= BOX.north && lon >= BOX.west && lon <= BOX.east)) continue
    const hhmm = row[iTime].padStart(4, '0')
    const time = Date.parse(`${row[iDate]}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00Z`) / 1000
    const conf = row[iConf].charAt(0).toLowerCase()
    out.push([
      round(lat, 3),
      round(lon, 3),
      round(Number(row[iFrp]) || 0, 1),
      conf === 'h' ? 'h' : conf === 'l' ? 'l' : 'n',
      time,
      row[iDn]?.trim() === 'N' ? 1 : 0,
    ])
  }
  const latest = out.reduce((max, f) => Math.max(max, f[4]), 0)
  return out.filter((f) => f[4] > latest - WINDOW_S)
}
