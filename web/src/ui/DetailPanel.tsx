import { useEffect, useRef, useState, type ComponentType } from 'react'
import { Check, LinkSimple, X } from '@phosphor-icons/react'
import { useStore } from '../state/store'
import { layerModules } from '../layers/modules'
import { SourceFooter } from './SourceFooter'
import styles from './DetailPanel.module.css'

export function DetailPanel({ PointDetail }: { PointDetail?: ComponentType<{ lat: number; lon: number }> }) {
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const panel = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState(false)
  const key = selection ? (selection.kind === 'item' ? `${selection.layer}:${selection.id}` : `point:${selection.lat}:${selection.lon}`) : ''

  useEffect(() => {
    if (!selection) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selection, select])

  useEffect(() => {
    if (!key) return
    const heading = panel.current?.querySelector<HTMLElement>('#detail-title')
    heading?.focus({ preventScroll: true })
  }, [key])

  if (!selection) return null

  let body = null
  if (selection.kind === 'item') {
    const Detail = layerModules[selection.layer]?.Detail
    body = Detail ? <Detail id={selection.id} /> : null
  } else if (PointDetail) {
    body = <PointDetail lat={selection.lat} lon={selection.lon} />
  }

  return (
    <aside ref={panel} className={styles.panel} aria-labelledby="detail-title" key={key}>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.action}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(location.href)
              setCopied(true)
              setTimeout(() => setCopied(false), 2500)
            } catch {
              setCopied(false)
            }
          }}
          aria-label={copied ? 'Link copied' : 'Copy a link to this'}
        >
          {copied ? <Check size={18} weight="bold" aria-hidden="true" /> : <LinkSimple size={18} weight="bold" aria-hidden="true" />}
        </button>
        <button type="button" className={styles.action} onClick={() => select(null)} aria-label="Close details">
          <X size={18} weight="bold" aria-hidden="true" />
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Link copied' : ''}
      </span>
      <div className={`scroll ${styles.body}`}>
        {body}
        <SourceFooter layer={selection.kind === 'item' ? selection.layer : 'point'} />
      </div>
    </aside>
  )
}
