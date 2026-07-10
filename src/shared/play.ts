import type { SyncProgress } from './pack'
import { phaseLabel, syncPercent } from './progress'

/**
 * Estado unificado del botón JUGAR: sincronizar (M2) -> preparar -> instalar loader
 * -> lanzar -> jugando. Modelado como unión discriminada; las derivaciones para la UI
 * son puras y testeadas.
 */

/** Progreso de descarga que emite MCLC al bajar Minecraft (assets, libs, natives). */
export interface LoaderProgress {
  type: string
  task: number
  total: number
}

export type PlayState =
  | { phase: 'idle' }
  | { phase: 'syncing'; sync: SyncProgress }
  | { phase: 'preparing' } // detectando Java
  | { phase: 'downloading-java'; percent: number } // bajando el JRE gestionado
  | { phase: 'installing-loader' }
  | { phase: 'launching'; loader?: LoaderProgress } // MCLC bajando Minecraft
  | { phase: 'running' } // ventana del juego abierta
  | { phase: 'error'; message: string }

export const IDLE_PLAY: PlayState = { phase: 'idle' }

export type PlayResult = { ok: true } | { ok: false; error: string }

/** Texto del botón según estado + sesión. */
export function playLabel(state: PlayState, authed: boolean): string {
  switch (state.phase) {
    case 'idle':
      return authed ? 'JUGAR' : 'INICIAR SESIÓN'
    case 'syncing':
      return phaseLabel(state.sync)
    case 'preparing':
      return 'PREPARANDO...'
    case 'downloading-java':
      return `JAVA ${Math.round(state.percent)}%`
    case 'installing-loader':
      return 'INSTALANDO NEOFORGE'
    case 'launching':
      return state.loader ? `${Math.round(loaderPercent(state.loader))}%` : 'INICIANDO JUEGO'
    case 'running':
      return 'JUGANDO'
    case 'error':
      return 'ERROR'
  }
}

/**
 * Porcentaje 0-100 para la barra, o `null` si el paso es indeterminado
 * (preparar/instalar): ahí la UI muestra una barra pulsante en vez de un %.
 */
export function playPercent(state: PlayState): number | null {
  switch (state.phase) {
    case 'syncing':
      return syncPercent(state.sync)
    case 'downloading-java':
      return state.percent
    case 'launching':
      return state.loader ? loaderPercent(state.loader) : null
    case 'running':
      return 100
    case 'preparing':
    case 'installing-loader':
      return null
    default:
      return 0
  }
}

/** ¿El botón está ocupado (deshabilitado, mostrando progreso)? */
export function isPlayBusy(state: PlayState): boolean {
  return state.phase !== 'idle' && state.phase !== 'error'
}

function loaderPercent(loader: LoaderProgress): number {
  if (loader.total <= 0) return 0
  const pct = (loader.task / loader.total) * 100
  return pct < 0 ? 0 : pct > 100 ? 100 : pct
}
