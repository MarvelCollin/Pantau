import styles from './MapTooltip.module.css'

export interface TooltipState {
  x: number
  y: number
  text: string
}

export function MapTooltip({ x, y, text }: TooltipState) {
  return (
    <div className={styles.tip} style={{ transform: `translate(${x + 14}px, ${y + 14}px)` }} role="tooltip">
      {text}
    </div>
  )
}
