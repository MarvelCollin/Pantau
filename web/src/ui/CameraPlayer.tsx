import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getEnvelope } from '../lib/api'
import styles from './CameraPlayer.module.css'

interface Stream {
  kind: 'hls' | 'youtube' | 'image' | 'page'
  url: string
}

type PlayState = 'loading' | 'playing' | 'failed'

function HlsVideo({ url, title, onState }: { url: string; title: string; onState: (s: PlayState) => void }) {
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = video.current
    if (!el) return
    let destroyed = false
    let cleanup = () => {}
    const playing = () => onState('playing')
    const failed = () => onState('failed')
    el.addEventListener('playing', playing)
    el.addEventListener('error', failed)
    const timeout = setTimeout(() => {
      if (el.readyState < 2) failed()
    }, 15_000)

    if (el.canPlayType('application/vnd.apple.mpegurl')) {
      el.src = url
      el.play().catch(() => undefined)
    } else {
      import('hls.js').then(({ default: Hls }) => {
        if (destroyed) return
        if (!Hls.isSupported()) return failed()
        const hls = new Hls({ lowLatencyMode: true, maxBufferLength: 10, backBufferLength: 0 })
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) failed()
        })
        hls.loadSource(url)
        hls.attachMedia(el)
        el.play().catch(() => undefined)
        cleanup = () => hls.destroy()
      })
    }

    return () => {
      destroyed = true
      clearTimeout(timeout)
      el.removeEventListener('playing', playing)
      el.removeEventListener('error', failed)
      cleanup()
      el.removeAttribute('src')
      el.load()
    }
  }, [url, onState])

  return <video ref={video} className={styles.media} muted playsInline autoPlay controls aria-label={title} />
}

export function CameraPlayer({ id, title, image, page }: { id: string; title: string; image?: string; page?: string }) {
  const [state, setState] = useState<PlayState>('loading')
  const needsResolve = !image
  const { data, isError } = useQuery({
    queryKey: ['stream', id],
    queryFn: ({ signal }) => getEnvelope<Stream>(`/api/cameras/stream?id=${encodeURIComponent(id)}`, signal),
    enabled: needsResolve,
    staleTime: 3 * 3600_000,
    meta: { persist: true },
  })

  useEffect(() => setState('loading'), [id])

  const stream: Stream | undefined = image ? { kind: 'image', url: image } : data?.items
  const failed = isError || state === 'failed' || stream?.kind === 'page'

  return (
    <figure className={styles.frame}>
      <div className={styles.stage}>
        {stream?.kind === 'image' && (
          <img className={styles.media} src={stream.url} alt={`Latest snapshot from ${title}`} width={640} height={360} onLoad={() => setState('playing')} onError={() => setState('failed')} />
        )}
        {stream?.kind === 'youtube' && (
          <iframe
            className={styles.media}
            src={stream.url}
            title={`Live stream from ${title}`}
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
            onLoad={() => setState('playing')}
          />
        )}
        {stream?.kind === 'hls' && !failed && <HlsVideo url={stream.url} title={`Live stream from ${title}`} onState={setState} />}
        {!failed && state === 'loading' && <span className={`skeleton ${styles.loading}`} aria-label="Loading camera" />}
        {failed && (
          <div className={styles.failed} role="status">
            <p>This camera is not answering right now. Public feeds often go offline for maintenance.</p>
            {page && (
              <a href={page} target="_blank" rel="noreferrer noopener">
                Try the operator page
              </a>
            )}
          </div>
        )}
      </div>
      <figcaption className={styles.caption}>
        {stream?.kind === 'image' ? 'Snapshot, refreshed every minute' : stream?.kind ? 'Live stream, muted' : 'Finding the stream'}
      </figcaption>
    </figure>
  )
}
