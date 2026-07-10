import type { UpdaterStatus } from '../../shared/updater'

/**
 * Cablea los eventos de electron-updater a un UpdaterStatus tipado. El mapeo es puro
 * y se testea con un EventEmitter falso; el main le pasa el autoUpdater real y un emit
 * que empuja el status al renderer. Tolerante a payloads inesperados: nunca tira.
 */

export interface AutoUpdaterLike {
  on(event: string, listener: (...args: unknown[]) => void): unknown
}

function readVersion(info: unknown): string {
  if (info && typeof info === 'object' && 'version' in info) {
    const v = (info as { version: unknown }).version
    if (typeof v === 'string') return v
  }
  return '?'
}

function readPercent(progress: unknown): number {
  if (progress && typeof progress === 'object' && 'percent' in progress) {
    const p = (progress as { percent: unknown }).percent
    if (typeof p === 'number' && Number.isFinite(p)) return Math.round(p)
  }
  return 0
}

function readError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Error desconocido del updater.'
}

export function wireUpdater(updater: AutoUpdaterLike, emit: (status: UpdaterStatus) => void): void {
  updater.on('checking-for-update', () => emit({ state: 'checking' }))
  updater.on('update-available', (info) => emit({ state: 'available', version: readVersion(info) }))
  updater.on('update-not-available', () => emit({ state: 'none' }))
  updater.on('download-progress', (progress) => emit({ state: 'downloading', percent: readPercent(progress) }))
  updater.on('update-downloaded', (info) => emit({ state: 'ready', version: readVersion(info) }))
  updater.on('error', (err) => emit({ state: 'error', message: readError(err) }))
}
