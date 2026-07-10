import { useCallback, useEffect, useRef, useState } from 'react'
import type { SyncProgress, SyncResult } from '@shared/pack'
import { IDLE_PROGRESS } from '@shared/pack'

/** Cuánto queda el "¡LISTO!" en pantalla antes de volver a JUGAR. */
const DONE_LINGER_MS = 1600

export interface UsePackSync {
  progress: SyncProgress
  running: boolean
  error: string | null
  /** Resumen de la última sincronización exitosa. */
  summary: Extract<SyncResult, { ok: true }> | null
  start: () => Promise<void>
  cancel: () => void
}

export function usePackSync(): UsePackSync {
  const [progress, setProgress] = useState<SyncProgress>(IDLE_PROGRESS)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<Extract<SyncResult, { ok: true }> | null>(null)
  const runningRef = useRef(false)

  useEffect(() => {
    const unsubscribe = window.api?.pack?.onProgress(setProgress)
    return () => unsubscribe?.()
  }, [])

  useEffect(() => {
    if (progress.phase !== 'done') return
    const timer = window.setTimeout(() => setProgress(IDLE_PROGRESS), DONE_LINGER_MS)
    return () => window.clearTimeout(timer)
  }, [progress.phase])

  const start = useCallback(async (): Promise<void> => {
    if (runningRef.current) return
    runningRef.current = true
    setRunning(true)
    setError(null)
    setSummary(null)
    setProgress({ ...IDLE_PROGRESS, phase: 'manifest' })

    try {
      const result = await window.api.pack.sync()
      if (result.ok) setSummary(result)
      else {
        setError(result.error)
        setProgress(IDLE_PROGRESS)
      }
    } catch (reason) {
      console.error('[pack] la sincronización falló:', reason)
      setError('No se pudo sincronizar el modpack.')
      setProgress(IDLE_PROGRESS)
    } finally {
      runningRef.current = false
      setRunning(false)
    }
  }, [])

  const cancel = useCallback((): void => {
    void window.api?.pack?.cancel()
  }, [])

  return { progress, running, error, summary, start, cancel }
}
