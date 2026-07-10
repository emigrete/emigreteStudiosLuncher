import type { PlayResult, PlayState } from '../../shared/play'
import { runPlay } from './play'
import { cancelSync, runSync } from './pack'
import { runLaunch } from './launch'

/**
 * Glue de Electron para JUGAR: single-flight sobre `runPlay`, componiendo la
 * sincronización (M2) con el lanzamiento (M3). Cancelable.
 */

let inFlight: Promise<PlayResult> | null = null
let controller: AbortController | null = null

export function isPlaying(): boolean {
  return inFlight !== null
}

export function cancelPlay(): void {
  controller?.abort()
  cancelSync() // la fase de sync tiene su propio controller; también hay que cortarla
}

export function runGamePlay(emit: (state: PlayState) => void): Promise<PlayResult> {
  if (inFlight) return Promise.resolve({ ok: false, error: 'Ya hay algo en curso.' })

  controller = new AbortController()
  inFlight = runPlay(emit, { sync: runSync, launch: runLaunch }, controller.signal).finally(() => {
    inFlight = null
    controller = null
  })
  return inFlight
}
