import { createContext, useContext, useEffect, useRef, useState, type JSX, type ReactNode } from 'react'
import theme from '../assets/launcher-theme.mp3'

/**
 * Música de fondo del launcher (loop, volumen suave). El provider posee el elemento
 * <audio> y el estado de mute; el botón vive en la TitleBar (control de chrome).
 * - Recuerda la preferencia en localStorage.
 * - Se pausa sola al ocultarse (minimizado / jugando) y al ver el tráiler
 *   ('launcher:music-duck' / '-unduck'); reanuda al volver si no está en mute.
 */

const STORAGE_KEY = 'launcher.music.muted'
const VOLUME = 0.35

interface MusicApi {
  muted: boolean
  toggleMuted: () => void
}

const MusicContext = createContext<MusicApi>({ muted: false, toggleMuted: () => {} })

export function MusicProvider({ children }: { children: ReactNode }): JSX.Element {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [muted, setMuted] = useState<boolean>(() => localStorage.getItem(STORAGE_KEY) === '1')

  const tryPlay = (): void => {
    const el = audioRef.current
    if (el && !muted && !document.hidden) void el.play().catch(() => undefined)
  }

  useEffect(() => {
    const el = audioRef.current
    if (el) el.volume = VOLUME
    tryPlay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0')
    if (muted) audioRef.current?.pause()
    else tryPlay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted])

  useEffect(() => {
    const el = audioRef.current
    const onVisibility = (): void => {
      if (document.hidden) el?.pause()
      else tryPlay()
    }
    const duck = (): void => el?.pause()
    const unduck = (): void => tryPlay()
    const kick = (): void => tryPlay() // 1er gesto: por si la policy frenó el autoplay

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('launcher:music-duck', duck)
    window.addEventListener('launcher:music-unduck', unduck)
    window.addEventListener('pointerdown', kick)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('launcher:music-duck', duck)
      window.removeEventListener('launcher:music-unduck', unduck)
      window.removeEventListener('pointerdown', kick)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted])

  return (
    <MusicContext.Provider value={{ muted, toggleMuted: () => setMuted((m) => !m) }}>
      {children}
      <audio ref={audioRef} src={theme} loop preload="auto" />
    </MusicContext.Provider>
  )
}

export function useMusic(): MusicApi {
  return useContext(MusicContext)
}
