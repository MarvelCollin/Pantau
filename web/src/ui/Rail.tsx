import { useState, type ReactNode } from 'react'
import { CaretDown, Stack } from '@phosphor-icons/react'
import { useStore } from '../state/store'
import { layers } from '../layers/registry'
import styles from './Rail.module.css'

export function Rail({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const count = useStore((s) => s.enabled.length)

  return (
    <div className={styles.rail} data-open={open}>
      <button
        type="button"
        className={styles.handle}
        aria-expanded={open}
        aria-controls="rail-body"
        onClick={() => setOpen((v) => !v)}
      >
        <Stack size={18} weight="bold" aria-hidden="true" />
        <span className={styles.handleLabel}>Layers</span>
        <span className={styles.handleCount}>
          {count} of {layers.length} on
        </span>
        <CaretDown size={16} weight="bold" className={styles.caret} aria-hidden="true" />
      </button>
      <div id="rail-body" className={`scroll ${styles.body}`}>
        {children}
      </div>
    </div>
  )
}
