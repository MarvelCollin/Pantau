import { layers, type LayerGroup, type LayerInfo } from '../layers/registry'
import { useStore, type LayerStatus } from '../state/store'
import { formatAgo, formatNumber } from '../lib/format'
import { useNow } from '../lib/useNow'
import { LayerGlyph } from './LayerGlyph'
import { SwitchTrack } from './Switch'
import { Legend } from './Legend'
import { prefetchLayer } from '../layers/prefetch'
import styles from './LayerPanel.module.css'

const groups: LayerGroup[] = ['Moving', 'Hazards', 'Sky', 'Eyes']

function StatusLine({ info, status, on, now }: { info: LayerInfo; status?: LayerStatus; on: boolean; now: number }) {
  if (!on) return <span className={styles.hint}>{info.hint}</span>
  if (!status || status.state === 'loading' || status.state === 'idle')
    return <span className={`skeleton ${styles.skel}`} aria-label="Loading" />
  const ago = status.fetchedAt ? formatAgo(status.fetchedAt, now) : ''
  const count = status.count !== undefined ? `${formatNumber(status.count)} ${status.note ?? 'shown'}` : status.note
  switch (status.state) {
    case 'error':
      return (
        <span className={styles.problem}>
          <span className={styles.mark} data-shape="ring" aria-hidden="true" />
          {status.fetchedAt ? `Source not responding. Showing data from ${ago}` : 'Source not responding. Retrying soon'}
        </span>
      )
    case 'needs_key':
      return (
        <span className={styles.problem}>
          <span className={styles.mark} data-shape="ring" aria-hidden="true" />
          {status.note ?? 'Needs a free API key on the server'}
        </span>
      )
    case 'zoom_in':
      return (
        <span className={styles.hint}>
          {count}. Zoom in to load more
        </span>
      )
    case 'stale':
      return (
        <span className={styles.warn}>
          <span className={styles.mark} data-shape="diamond" aria-hidden="true" />
          {count}, data from {ago}
        </span>
      )
    default:
      return (
        <span className={styles.meta}>
          {count}
          {ago && <span className={styles.ago}>, updated {ago}</span>}
        </span>
      )
  }
}

export function LayerPanel() {
  const enabled = useStore((s) => s.enabled)
  const status = useStore((s) => s.status)
  const toggle = useStore((s) => s.toggleLayer)
  const now = useNow(5000)

  return (
    <nav className={styles.panel} aria-label="Map layers">
      {groups.map((group) => (
        <section key={group} className={styles.group} aria-labelledby={`group-${group}`}>
          <h2 id={`group-${group}`} className={styles.groupLabel}>
            {group}
          </h2>
          <ul className={styles.list}>
            {layers
              .filter((l) => l.group === group)
              .map((info) => {
                const on = enabled.includes(info.id)
                return (
                  <li key={info.id}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      className={styles.row}
                      data-on={on}
                      onClick={() => toggle(info.id)}
                      onPointerEnter={() => !on && prefetchLayer(info.id)}
                      onFocus={() => !on && prefetchLayer(info.id)}
                    >
                      <span className={styles.glyph}>
                        <LayerGlyph id={info.id} />
                      </span>
                      <span className={styles.text}>
                        <span className={styles.label}>{info.label}</span>
                        <span className={styles.status} aria-live="polite">
                          <StatusLine info={info} status={status[info.id]} on={on} now={now} />
                        </span>
                      </span>
                      <SwitchTrack on={on} />
                    </button>
                    {on && <Legend id={info.id} label={info.label} />}
                  </li>
                )
              })}
          </ul>
        </section>
      ))}
    </nav>
  )
}
