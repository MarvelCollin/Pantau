import type { ReactNode } from 'react'
import { ArrowSquareOut } from '@phosphor-icons/react'
import { layerInfo, type LayerId } from '../layers/registry'
import { LayerGlyph } from './LayerGlyph'
import styles from './Detail.module.css'

export function DetailHeader({ layer, title, subtitle }: { layer: LayerId; title: ReactNode; subtitle?: ReactNode }) {
  return (
    <header className={styles.header}>
      <p className={styles.kind}>
        <LayerGlyph id={layer} size={16} />
        {layerInfo(layer).label}
      </p>
      <h2 className={styles.title} id="detail-title" tabIndex={-1}>
        {title}
      </h2>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </header>
  )
}

export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className={styles.facts}>
      {rows
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([label, value]) => (
          <div key={label} className={styles.fact}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
    </dl>
  )
}

export function Lead({ value, unit, label }: { value: ReactNode; unit?: string; label: string }) {
  return (
    <p className={styles.lead}>
      <span className={`num ${styles.leadValue}`}>{value}</span>
      {unit && <span className={styles.leadUnit}>{unit}</span>}
      <span className={styles.leadLabel}>{label}</span>
    </p>
  )
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className={styles.external} href={href} target="_blank" rel="noreferrer noopener">
      {children}
      <ArrowSquareOut size={14} weight="bold" aria-hidden="true" />
      <span className="sr-only">, opens in a new tab</span>
    </a>
  )
}

export function Section({ children }: { children: ReactNode }) {
  return <div className={styles.section}>{children}</div>
}

export function Gone({ layer }: { layer: LayerId }) {
  return (
    <>
      <DetailHeader layer={layer} title="Not in view anymore" />
      <p className={styles.note}>
        This item left the area or the source stopped listing it. Pick another one on the map.
      </p>
    </>
  )
}
