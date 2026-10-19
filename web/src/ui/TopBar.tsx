import { Sun, Moon, GithubLogo } from '@phosphor-icons/react'
import { useStore } from '../state/store'
import { formatClock } from '../lib/format'
import { useNow } from '../lib/useNow'
import styles from './TopBar.module.css'
import type { ReactNode } from 'react'

export function TopBar({ children }: { children?: ReactNode }) {
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const now = useNow(15_000)
  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <header className={styles.bar}>
      <a className={styles.brand} href={import.meta.env.BASE_URL} aria-label="Pantau home">
        <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
          <circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeWidth="3" />
          <circle cx="16" cy="16" r="3.5" fill="var(--accent-strong)" />
        </svg>
        <span className={styles.word}>Pantau</span>
      </a>
      <p className={styles.tagline}>Live open data across Indonesia</p>
      <div className={styles.center}>{children}</div>
      <div className={styles.actions}>
        <time className={`num ${styles.clock}`} dateTime={new Date(now).toISOString()}>
          {formatClock(now)} WIB
        </time>
        <button
          type="button"
          className={styles.icon}
          onClick={() => setTheme(next)}
          aria-label={`Switch to ${next} theme`}
        >
          {theme === 'dark' ? <Sun size={18} weight="bold" aria-hidden="true" /> : <Moon size={18} weight="bold" aria-hidden="true" />}
        </button>
        <a
          className={styles.icon}
          href="https://github.com/MarvelCollin/Pantau"
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Source code on GitHub, opens in a new tab"
        >
          <GithubLogo size={18} weight="bold" aria-hidden="true" />
        </a>
      </div>
    </header>
  )
}
