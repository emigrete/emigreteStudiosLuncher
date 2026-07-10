import { useEffect, useRef, useState, type JSX } from 'react'
import theme from '../assets/launcher-theme.mp3'
import { IconSpeaker, IconSpeakerMute } from './icons'

/**
 * Música de fondo del launcher (loop, volumen suave) + toggle de silencio.
 * - Recuerda la preferencia en localStorage.
 * - Se pausa sola cuando el launcher se oculta (minimizado / jugando) y al ver el tráiler
 *   (eventos 'launcher:music-duck' / '-unduck'); reanuda al volver si no está en mute.
 * - Autoplay: el main habilita autoplayPolicy; igual reintentamos en el primer gesto.
 */

const STORAGE_KEY = 'launcher.music.muted'
const VOLUME = 0.35

export default function LauncherAudio(): JSX.Element {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [muted, setMuted] = useState<boolean>(() => localStorage.getItem(STORAGE_KEY) === '1')

  const tryPlay = (): void => {
    const el = audioRef.current
    if (el && !muted && !document.hidden) void el.play().catch(() => undefined)
  }

  // Volumen inicial + arranque.
  useEffect(() => {
    const el = audioRef.current
    if (el) el.volume = VOLUME
    tryPlay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Aplicar mute + persistir.
  useEffect(() => {
    const el = audioRef.current
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0')
    if (!el) return
    if (muted) el.pause()
    else tryPlay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted])

  // Pausa al ocultarse (minimizado / jugando) y al ver el tráiler; reanuda al volver.
  useEffect(() => {
    const el = audioRef.current
    const onVisibility = (): void => {
      if (document.hidden) el?.pause()
      else tryPlay()
    }
    const duck = (): void => el?.pause()
    const unduck = (): void => tryPlay()
    const kick = (): void => tryPlay()

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('launcher:music-duck', duck)
    window.addEventListener('launcher:music-unduck', unduck)
    window.addEventListener('pointerdown', kick) // 1er gesto: por si la policy frenó el autoplay
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('launcher:music-duck', duck)
      window.removeEventListener('launcher:music-unduck', unduck)
      window.removeEventListener('pointerdown', kick)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted])

  return (
    <>
      <audio ref={audioRef} src={theme} loop preload="auto" />
      <button
        className="music-toggle"
        onClick={() => setMuted((m) => !m)}
        aria-label={muted ? 'Activar música' : 'Silenciar música'}
        title={muted ? 'Activar música' : 'Silenciar música'}
        aria-pressed={muted}
      >
        {muted ? <IconSpeakerMute /> : <IconSpeaker />}
      </button>
    </>
  )
}
