import { Sun, Moon, GithubLogo } from '@phosphor-icons/react'
import { useStore } from '../state/store'
import { formatClock } from '../lib/format'
import { useNow } from '../lib/useNow'
import styles from './TopBar.module.css'
import { useEffect, useState, type ReactNode } from 'react'

export function TopBar({ children }: { children?: ReactNode }) {
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const now = useNow(15_000)
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <header className={styles.bar}>
      <a className={styles.brand} href={import.meta.env.BASE_URL} aria-label="Pantau home">
        <svg viewBox="0 0 256 256" width="26" height="26" aria-hidden="true">
          <g transform="translate(0 -4.14)">
            <path fill="var(--brand-lid)" fillRule="evenodd" d="M16.7 150.7L116.7 50.7A16 16 0 0 1 139.3 50.7L239.3 150.7A16 16 0 0 1 237 175.2Q128 249.3 19 175.2A16 16 0 0 1 16.7 150.7ZM128 84.6L203 159.6Q128 210.7 53 159.6Z" />
            <path fill="var(--brand-pupil)" d="M98 147a30 30 0 1 0 60 0a30 30 0 1 0 -60 0Z" />
          </g>
        </svg>
        <span className={styles.word}>Pantau</span>
      </a>
      <p className={styles.tagline}>Live open data across Indonesia</p>
      <div className={styles.center}>{children}</div>
      <div className={styles.actions}>
        <span className={styles.live} data-online={online} role="status">
          <span className={styles.liveDot} aria-hidden="true" />
          {online ? 'Live' : 'Offline, showing saved data'}
        </span>
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
