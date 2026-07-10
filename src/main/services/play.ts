import type { SyncProgress, SyncResult } from '../../shared/pack'
import type { PlayResult, PlayState } from '../../shared/play'
import { IDLE_PROGRESS } from '../../shared/pack'

/**
 * Orquestador de JUGAR: sincroniza el modpack (M2) y después lanza el juego (M3),
 * emitiendo un estado unificado. Las dos etapas se inyectan para poder testear el
 * flujo sin red, sin Java y sin Minecraft.
 */

export type Emit = (state: PlayState) => void

export interface PlayDeps {
  /** Sincroniza el modpack (M2). */
  sync: (onProgress: (progress: SyncProgress) => void) => Promise<SyncResult>
  /**
   * Lanza el juego (M3). Emite sus propias fases (preparing/installing-loader/
   * launching/running) por `emit`, y resuelve cuando el juego se cierra.
   */
  launch: (emit: Emit, signal: AbortSignal) => Promise<PlayResult>
}

export async function runPlay(emit: Emit, deps: PlayDeps, signal: AbortSignal): Promise<PlayResult> {
  // --- Etapa 1: sincronizar ---
  emit({ phase: 'syncing', sync: { ...IDLE_PROGRESS, phase: 'manifest' } })
  const syncResult = await deps.sync((progress) => emit({ phase: 'syncing', sync: progress }))
  if (!syncResult.ok) {
    emit({ phase: 'error', message: syncResult.error })
    return { ok: false, error: syncResult.error }
  }
  if (signal.aborted) {
    emit({ phase: 'idle' })
    return { ok: false, error: 'Cancelado.' }
  }

  // --- Etapa 2: lanzar (emite sus propias fases) ---
  const launchResult = await deps.launch(emit, signal)
  emit(launchResult.ok ? { phase: 'idle' } : { phase: 'error', message: launchResult.error })
  return launchResult
}
