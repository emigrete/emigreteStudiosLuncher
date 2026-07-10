import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlayState } from '@shared/play'

export interface UsePlay {
  state: PlayState
  /** true desde el click hasta que termina (cubre el hueco antes del primer evento). */
  busy: boolean
  error: string | null
  play: () => Promise<void>
  cancel: () => void
}

/** Estado del botón JUGAR: sincroniza + lanza. El trabajo ocurre en el main. */
export function usePlay(): UsePlay {
  const [state, setState] = useState<PlayState>({ phase: 'idle' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const running = useRef(false)

  useEffect(() => {
    const unsubscribe = window.api?.game?.onProgress((next) => {
      // El error se muestra en la línea de estado; el botón vuelve a "JUGAR".
      if (next.phase === 'error') {
        setError(next.message)
        setState({ phase: 'idle' })
      } else {
        setState(next)
        if (next.phase !== 'idle') setError(null)
      }
    })
    return () => unsubscribe?.()
  }, [])

  const play = useCallback(async (): Promise<void> => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setError(null)
    try {
      const result = await window.api.game.play()
      if (!result.ok) setError(result.error)
    } catch (reason) {
      console.error('[play] falló:', reason)
      setError('No se pudo iniciar el juego.')
    } finally {
      running.current = false
      setBusy(false)
    }
  }, [])

  const cancel = useCallback((): void => {
    void window.api?.game?.cancel()
  }, [])

  return { state, busy, error, play, cancel }
}
