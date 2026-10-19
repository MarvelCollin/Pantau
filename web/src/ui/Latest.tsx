import { useQuakes } from '../layers/quakes'
import { useStore, useLayerOn } from '../state/store'
import { formatAgo } from '../lib/format'
import { useNow } from '../lib/useNow'
import styles from './Latest.module.css'

export function Latest() {
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
