import { useMemo } from 'react'
import { Pause, Play } from '@phosphor-icons/react'
import { useQuakes } from '../layers/quakes'
import { useVolcanoes, levelNames } from '../layers/volcanoes'
import { useKarhutla, provinceTotals } from '../layers/karhutla'
import { useAir, airCategories, ispuLabel } from '../layers/air'
import { useSmoke, useSmokeHour, smokeHours, describeSpot } from '../layers/smoke'
import { useStore, useLayerOn } from '../state/store'
import { formatAgo, formatClock, formatNumber } from '../lib/format'
import { useNow } from '../lib/useNow'
import styles from './Latest.module.css'

function LatestQuakes() {
  const on = useLayerOn('quakes')
  const { data, isPending } = useQuakes(on)
  const select = useStore((s) => s.select)
  const fly = useStore((s) => s.requestFly)
  const now = useNow(30_000)
  if (!on) return null

  const items = (data?.items ?? []).filter((q) => q.source === 'BMKG').slice(0, 5)

  return (
    <section className={styles.latest} aria-labelledby="latest-title">
      <h2 id="latest-title" className={styles.title}>
        Latest earthquakes in Indonesia
      </h2>
      {isPending && !data ? (
        <ul className={styles.list} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className={styles.skelRow}>
              <span className="skeleton" style={{ width: 36, height: 22 }} />
              <span className="skeleton" style={{ flex: 1, height: 14 }} />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className={styles.empty}>No recent reports from BMKG.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((q) => (
            <li key={q.id}>
              <button
                type="button"
                className={styles.item}
                onClick={() => {
                  select({ kind: 'item', layer: 'quakes', id: q.id })
                  fly(q.lon, q.lat, 6.5)
                }}
              >
                <span className={`num ${styles.mag}`} data-strong={q.mag >= 5}>
                  {q.mag.toFixed(1)}
                </span>
                <span className={styles.text}>
                  <span className={styles.place}>{q.place}</span>
                  <span className={styles.when}>{formatAgo(q.time, now)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function VolcanoAlerts() {
  const on = useLayerOn('volcanoes')
  const { data } = useVolcanoes(on)
  const select = useStore((s) => s.select)
  const fly = useStore((s) => s.requestFly)
  if (!on || !data) return null
  const items = data.items.filter((v) => v.level >= 3)
  if (items.length === 0) return null

  return (
    <section className={styles.latest} aria-labelledby="volcano-alerts">
      <h2 id="volcano-alerts" className={styles.title}>
        Volcanoes at level III or IV
      </h2>
      <ul className={styles.list}>
        {items.map((v) => (
          <li key={v.code}>
            <button
              type="button"
              className={styles.item}
              onClick={() => {
                select({ kind: 'item', layer: 'volcanoes', id: v.code })
                fly(v.lon, v.lat, 9)
              }}
            >
              <span className={`num ${styles.mag}`} data-level={v.level}>
                {levelNames[v.level].roman}
              </span>
              <span className={styles.text}>
                <span className={styles.place}>{v.name}</span>
                <span className={styles.when}>
                  {levelNames[v.level].id}, {v.province}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function KarhutlaProvinces() {
  const on = useLayerOn('karhutla')
  const { data } = useKarhutla(on)
  const fly = useStore((s) => s.requestFly)
  const rows = useMemo(() => (data ? provinceTotals(data.items, 'h').slice(0, 5) : []), [data])
  if (!on || rows.length === 0) return null

  return (
    <section className={styles.latest} aria-labelledby="karhutla-provinces">
      <h2 id="karhutla-provinces" className={styles.title}>
        High confidence karhutla hotspots by province
      </h2>
      <ul className={styles.list}>
        {rows.map((r) => (
          <li key={r.province}>
            <button type="button" className={styles.item} onClick={() => fly(r.lon, r.lat, 6.5)}>
              <span className={`num ${styles.mag}`} data-level={4}>
                {formatNumber(r.count)}
              </span>
              <span className={styles.text}>
                <span className={styles.place}>{r.province}</span>
                <span className={styles.when}>past 24 hours, SiPongi+</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function WorstAir() {
  const on = useLayerOn('air')
  const { data } = useAir(on)
  const select = useStore((s) => s.select)
  const fly = useStore((s) => s.requestFly)
  if (!on || !data) return null
  const items = data.items.filter((s) => s.ispu > 100).slice(0, 5)
  if (items.length === 0) return null

  return (
    <section className={styles.latest} aria-labelledby="worst-air">
      <h2 id="worst-air" className={styles.title}>
        Unhealthy air right now
      </h2>
      <ul className={styles.list}>
        {items.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className={styles.item}
              onClick={() => {
                select({ kind: 'item', layer: 'air', id: s.id })
                fly(s.lon, s.lat, 8)
              }}
            >
              <span className={`num ${styles.mag}`} data-level={s.ispu > 200 ? 4 : 3}>
                {ispuLabel(s.ispu)}
              </span>
              <span className={styles.text}>
                <span className={styles.place}>{s.city}</span>
                <span className={styles.when}>
                  {airCategories[s.category].en}, {s.province}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function SmokeForecast() {
  const on = useLayerOn('smoke')
  const { data } = useSmoke(on)
  const { hour, t, playing, setHour, togglePlay } = useSmokeHour()
  const select = useStore((s) => s.select)
  const fly = useStore((s) => s.requestFly)
  if (!on || !data) return null
  const { start, plumes } = data.items
  const top = plumes.slice(0, 5)
  const step = playing ? Math.max(1, Math.round(t)) : hour === 0 ? 24 : hour

  return (
    <section className={styles.latest} aria-labelledby="smoke-forecast">
      <h2 id="smoke-forecast" className={styles.title}>
        Where the smoke goes
      </h2>
      <div className={styles.player}>
        <button
          type="button"
          className={styles.play}
          onClick={togglePlay}
          aria-label={playing ? 'Pause the smoke forecast' : 'Play the next 24 hours of smoke'}
          aria-pressed={playing}
        >
          {playing ? <Pause size={14} weight="fill" aria-hidden="true" /> : <Play size={14} weight="fill" aria-hidden="true" />}
        </button>
        <span className={styles.playClock}>
          <span className="num">{formatClock((start + t * 3600) * 1000)} WIB</span>
          <span className={styles.when}>{t < 0.5 ? 'now' : `+${Math.round(t)} h`}</span>
        </span>
        <span className={styles.track} aria-hidden="true">
          <span className={styles.fill} style={{ transform: `scaleX(${Math.min(1, t / 24)})` }} />
        </span>
      </div>
      <div className={styles.hours} role="group" aria-label="Smoke forecast time">
        {smokeHours.map((h) => (
          <button key={h} type="button" className={styles.hour} aria-pressed={!playing && hour === h} onClick={() => setHour(h)}>
            {h === 0 ? 'Now' : `+${h} h`}
            <span className={styles.hourClock}>{formatClock((start + h * 3600) * 1000)}</span>
          </button>
        ))}
      </div>
      {top.length === 0 ? (
        <p className={styles.empty}>No large fire clusters in the past 24 hours.</p>
      ) : (
        <ul className={styles.list}>
          {top.map((p) => {
            const at = p.path[Math.min(step, p.path.length - 1)]
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={styles.item}
                  onClick={() => {
                    select({ kind: 'item', layer: 'smoke', id: p.id })
                    fly((p.lon + at[0]) / 2, (p.lat + at[1]) / 2, 6.5)
                  }}
                >
                  <span className={`num ${styles.mag}`} data-level={4}>
                    {formatNumber(p.hotspots)}
                  </span>
                  <span className={styles.text}>
                    <span className={styles.place}>{p.regency || p.province}</span>
                    <span className={styles.when}>
                      +{step} h: {describeSpot(p, step)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function Latest() {
  return (
    <>
      <VolcanoAlerts />
      <SmokeForecast />
      <KarhutlaProvinces />
      <WorstAir />
      <LatestQuakes />
    </>
  )
}
