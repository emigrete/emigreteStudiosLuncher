/** Config del launcher, compartida main <-> preload <-> renderer. */

export interface LauncherConfig {
  /** URL http(s) del manifiesto del modpack. */
  manifestUrl: string
  /** RAM máxima/mínima para el juego, en MB. */
  ramMaxMb: number
  ramMinMb: number
}

export const DEFAULT_CONFIG: LauncherConfig = {
  manifestUrl: '',
  ramMaxMb: 4096,
  ramMinMb: 2048
}

const RAM_MIN = 1024
const RAM_MAX = 32768

/** Normaliza/valida config venga de donde venga (archivo en disco o IPC del renderer). */
export function sanitizeConfig(raw: unknown): LauncherConfig {
  const obj = (raw ?? {}) as Record<string, unknown>
  const manifestUrl = typeof obj.manifestUrl === 'string' ? obj.manifestUrl.trim() : ''
  const ramMaxMb = clampRam(obj.ramMaxMb, DEFAULT_CONFIG.ramMaxMb)
  // el mínimo nunca puede superar al máximo
  const ramMinMb = Math.min(clampRam(obj.ramMinMb, DEFAULT_CONFIG.ramMinMb), ramMaxMb)
  return { manifestUrl, ramMaxMb, ramMinMb }
}

function clampRam(value: unknown, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
  return Math.max(RAM_MIN, Math.min(RAM_MAX, n))
}

/** ¿La URL es utilizable como manifiesto? (vacía es válida: significa "sin configurar"). */
export function isValidManifestUrl(url: string): boolean {
  if (url.length === 0) return true
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}
