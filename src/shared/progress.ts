import type { SyncProgress } from './pack'

/** Porcentaje 0-100 de la sincronización. Bytes si el manifiesto los declara; si no, archivos. */
export function syncPercent(progress: SyncProgress): number {
  if (progress.phase === 'done') return 100
  if (progress.phase === 'downloading' && progress.bytesTotal > 0) {
    return clamp((progress.bytesDone / progress.bytesTotal) * 100)
  }
  if (progress.filesTotal > 0) return clamp((progress.filesDone / progress.filesTotal) * 100)
  return 0
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
  const value = bytes / 1024 ** exponent
  const decimals = exponent === 0 || value >= 100 ? 0 : 1
  return `${value.toFixed(decimals)} ${UNITS[exponent]}`
}

/** Aviso de mods externos, bien pluralizado. `''` si no hay ninguno. */
export function externalNotice(count: number): string {
  if (count <= 0) return ''
  return count === 1
    ? '1 mod externo requiere descarga manual'
    : `${count} mods externos requieren descarga manual`
}

export function phaseLabel(progress: SyncProgress): string {
  switch (progress.phase) {
    case 'manifest':
      return 'LEYENDO MANIFIESTO'
    case 'checking':
      return `VERIFICANDO ${progress.filesDone}/${progress.filesTotal}`
    case 'downloading':
      return `${Math.round(syncPercent(progress))}%`
    case 'done':
      return '¡LISTO!'
    case 'error':
      return 'ERROR'
    default:
      return ''
  }
}

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, value))
}
