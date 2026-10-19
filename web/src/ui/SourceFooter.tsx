import { ArrowSquareOut } from '@phosphor-icons/react'
import { references } from '../layers/references'
import type { LayerId } from '../layers/registry'
import { useStore } from '../state/store'
import { formatAgo } from '../lib/format'
import styles from './SourceFooter.module.css'

export function SourceFooter({ layer }: { layer: LayerId | 'point' }) {
  const fetchedAt = useStore((s) => (layer === 'point' ? undefined : s.status[layer]?.fetchedAt))
  const refs = references[layer]

  return (
    <footer className={styles.footer} aria-labelledby="source-title">
      <h3 id="source-title" className={styles.title}>
        Where this comes from
      </h3>
      <ul className={styles.list}>
        {refs.map((r) => (
          <li key={r.name}>
            <a href={r.url} target="_blank" rel="noreferrer noopener">
              {r.name}
              <ArrowSquareOut size={12} weight="bold" aria-hidden="true" />
              <span className="sr-only">, opens in a new tab</span>
            </a>
            <span className={styles.what}>{r.what}</span>
          </li>
        ))}
      </ul>
      <p className={styles.note}>
        {fetchedAt ? `Fetched ${formatAgo(fetchedAt)}. ` : ''}Free public data, which can be late or incomplete.
      </p>
    </footer>
  )
}
