import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { RasterSourceSpecification } from 'maplibre-gl'
import { Pause, Play } from '@phosphor-icons/react'
import { getJson } from '../lib/api'
import { formatClock, formatCoord } from '../lib/format'
import { useLayerOn } from '../state/store'
import { useMap, firstLabelLayer } from '../map/context'
import { useLayerStatus } from './useLayerStatus'
import { DetailHeader, ExternalLink, Facts, Lead, Section } from '../ui/Detail'
import styles from './weather.module.css'

interface RadarIndex {
  host: string
  radar: { past: { time: number; path: string }[] }
}

const FRAME_MS = 700

function useRadarIndex(enabled: boolean) {
  return useQuery({
    queryKey: ['radar'],
    queryFn: async ({ signal }) => {
      const index = await getJson<RadarIndex>('https://api.rainviewer.com/public/weather-maps.json', signal)
      return { fetchedAt: index.radar.past.at(-1)?.time ? index.radar.past.at(-1)!.time * 1000 : Date.now(), index }
    },
    enabled,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  })
}

function frameId(i: number) {
  return `radar-${i}`
}

function WeatherLayer() {
  const on = useLayerOn('weather')
  const map = useMap()
  const query = useRadarIndex(on)
  const frames = query.data?.index.radar.past ?? []
  const host = query.data?.index.host
  const [playing, setPlaying] = useState(false)
  const [frame, setFrame] = useState(-1)
  const last = frames.length - 1
  const current = frame < 0 || frame > last ? last : frame
  const framesKey = frames.map((f) => f.path).join(',')

  useEffect(() => {
    if (!map || !on || !host || frames.length === 0) return
    const before = firstLabelLayer(map)
    frames.forEach((f, i) => {
      const id = frameId(i)
      const source: RasterSourceSpecification = {
        type: 'raster',
        tiles: [`${host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`],
        tileSize: 256,
        maxzoom: 7,
        attribution: '<a href="https://www.rainviewer.com" target="_blank" rel="noreferrer">RainViewer</a>',
      }
      map.addSource(id, source)
      map.addLayer(
        {
          id,
          type: 'raster',
          source: id,
          metadata: { pantau: 'weather' },
          layout: { visibility: i === frames.length - 1 ? 'visible' : 'none' },
          paint: { 'raster-opacity': 0.7, 'raster-fade-duration': 0 },
        },
        before,
      )
    })
    return () => {
      frames.forEach((_, i) => {
        const id = frameId(i)
        if (map.getLayer(id)) map.removeLayer(id)
        if (map.getSource(id)) map.removeSource(id)
      })
    }
  }, [map, on, host, framesKey])

  useEffect(() => {
    if (!map || !on) return
    frames.forEach((_, i) => {
      const id = frameId(i)
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', i === current ? 'visible' : 'none')
    })
  }, [map, on, current, framesKey])

  useEffect(() => {
    if (!playing || frames.length === 0) return
    const timer = setInterval(() => setFrame((f) => ((f < 0 ? last : f) + 1) % frames.length), FRAME_MS)
    return () => clearInterval(timer)
  }, [playing, last, frames.length])

  useEffect(() => {
    if (!on) {
      setPlaying(false)
      setFrame(-1)
    }
  }, [on])

  useLayerStatus('weather', on, query, { note: 'Latest radar', staleAfterMs: 30 * 60_000 })

  if (!on || frames.length === 0) return null
  const time = frames[current].time * 1000
  return (
    <div className={styles.timeline} role="group" aria-label="Rain radar playback">
      <button
        type="button"
        className={styles.play}
        onClick={() => {
          if (playing) {
            setPlaying(false)
            setFrame(-1)
          } else setPlaying(true)
        }}
        aria-label={playing ? 'Stop radar loop and show latest' : 'Play the last two hours of radar'}
      >
        {playing ? <Pause size={16} weight="fill" aria-hidden="true" /> : <Play size={16} weight="fill" aria-hidden="true" />}
      </button>
      <span className={styles.time}>
        <span className="num">{formatClock(time)} WIB</span>
        <span className={styles.rel}>{current === last ? 'latest radar' : `${Math.round((frames[last].time * 1000 - time) / 60_000)} min earlier`}</span>
      </span>
      <span className={styles.credit}>RainViewer</span>
    </div>
  )
}

interface Forecast {
  current: {
    time: string
    temperature_2m: number
    apparent_temperature: number
    relative_humidity_2m: number
    precipitation: number
    weather_code: number
    wind_speed_10m: number
    wind_direction_10m: number
    cloud_cover: number
  }
  hourly: { time: string[]; temperature_2m: number[]; precipitation_probability: number[] }
}

interface AirQuality {
  current: { pm2_5: number; us_aqi: number }
}

interface Place {
  city?: string
  locality?: string
  principalSubdivision?: string
  countryName?: string
}

const codes: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Freezing fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  80: 'Light showers',
  81: 'Showers',
  82: 'Violent showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Severe thunderstorm with hail',
}

const compass = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

function aqiWord(aqi: number) {
  if (aqi <= 50) return 'Good'
  if (aqi <= 100) return 'Moderate'
  if (aqi <= 150) return 'Unhealthy for sensitive groups'
  if (aqi <= 200) return 'Unhealthy'
  if (aqi <= 300) return 'Very unhealthy'
  return 'Hazardous'
}

export function PointWeather({ lat, lon }: { lat: number; lon: number }) {
  const la = lat.toFixed(2)
  const lo = lon.toFixed(2)
  const forecast = useQuery({
    queryKey: ['forecast', la, lo],
    queryFn: ({ signal }) =>
      getJson<Forecast>(
        `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover&hourly=temperature_2m,precipitation_probability&forecast_hours=12&timezone=Asia%2FJakarta`,
        signal,
      ),
    staleTime: 15 * 60_000,
  })
  const air = useQuery({
    queryKey: ['air', la, lo],
    queryFn: ({ signal }) => getJson<AirQuality>(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${la}&longitude=${lo}&current=pm2_5,us_aqi`, signal),
    staleTime: 30 * 60_000,
  })
  const place = useQuery({
    queryKey: ['place', la, lo],
    queryFn: ({ signal }) => getJson<Place>(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${la}&longitude=${lo}&localityLanguage=en`, signal),
    staleTime: 24 * 3600_000,
    meta: { persist: true },
  })

  const name = place.data ? place.data.city || place.data.locality || place.data.principalSubdivision || 'Open sea' : 'Weather here'
  const sub = place.data ? [place.data.principalSubdivision, place.data.countryName].filter(Boolean).join(', ') : formatCoord(lat, lon)
  const c = forecast.data?.current
  const hours = useMemo(() => {
    const h = forecast.data?.hourly
    if (!h) return []
    return h.time.slice(0, 12).map((t, i) => ({ t, temp: h.temperature_2m[i], rain: h.precipitation_probability[i] }))
  }, [forecast.data])

  return (
    <>
      <DetailHeader layer="weather" kind="Weather here" title={name} subtitle={sub || formatCoord(lat, lon)} />
      {forecast.isError ? (
        <p className={styles.note}>Weather service is not answering. Try again in a minute.</p>
      ) : !c ? (
        <div className={styles.skeletonBlock} aria-label="Loading weather">
          <span className="skeleton" style={{ width: 120, height: 36 }} />
          <span className="skeleton" style={{ width: '70%', height: 14 }} />
          <span className="skeleton" style={{ width: '90%', height: 14 }} />
        </div>
      ) : (
        <>
          <Lead value={Math.round(c.temperature_2m)} unit="°C" label={`${codes[c.weather_code] ?? 'Mixed conditions'}, feels like ${Math.round(c.apparent_temperature)}°C`} />
          <Facts
            rows={[
              ['Rain now', <span className="num">{c.precipitation} mm</span>],
              ['Humidity', <span className="num">{c.relative_humidity_2m}%</span>],
              ['Cloud cover', <span className="num">{c.cloud_cover}%</span>],
              ['Wind', <span className="num">{Math.round(c.wind_speed_10m)} km/h from {compass[Math.round(c.wind_direction_10m / 45) % 8]}</span>],
              ['Air quality', air.data ? <span className="num">{aqiWord(air.data.current.us_aqi)}, US AQI {air.data.current.us_aqi}, PM2.5 {air.data.current.pm2_5} µg/m³</span> : undefined],
            ]}
          />
          {hours.length > 0 && (
            <Section>
              <h3 className={styles.hoursTitle}>Next 12 hours</h3>
              <ol className={`scroll ${styles.hours}`} tabIndex={0} aria-label="Hourly forecast">
                {hours.map((h) => (
                  <li key={h.t} className={styles.hour}>
                    <span className={styles.hourTime}>{h.t.slice(11, 16)}</span>
                    <span className="num">{Math.round(h.temp)}°</span>
                    <span className={`num ${styles.rain}`}>{h.rain}% rain</span>
                  </li>
                ))}
              </ol>
            </Section>
          )}
        </>
      )}
      <Section>
        <ExternalLink href={`https://www.bmkg.go.id/cuaca/prakiraan-cuaca`}>Official forecast on BMKG</ExternalLink>
        <p className={styles.note}>Weather by Open-Meteo. Place names by BigDataCloud.</p>
      </Section>
    </>
  )
}

export const weatherModule = { Layer: WeatherLayer, Detail: () => null }
