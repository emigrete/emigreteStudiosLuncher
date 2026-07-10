/** Tipos del modpack, compartidos entre main, preload y renderer. */

export interface PackFile {
  /** Ruta relativa dentro de la instancia. Siempre con `/`, nunca `..` ni absoluta. */
  path: string
  url: string
  sha1: string
  size?: number
}

/** Mods que no podemos redistribuir: se bajan de su fuente oficial (M3+). */
export interface PackExternal {
  name: string
  source: string
  projectId?: number
  fileId?: number
  targetPath: string
}

export interface PackManifest {
  packName: string
  packVersion: string
  minecraft: string
  loader: { type: string; version: string }
  java?: { major: number }
  server?: { host: string; port: number }
  files: PackFile[]
  external: PackExternal[]
}

export type SyncPhase = 'idle' | 'manifest' | 'checking' | 'downloading' | 'done' | 'error'

export interface SyncProgress {
  phase: SyncPhase
  /** Archivos ya resueltos (existentes o descargados). */
  filesDone: number
  filesTotal: number
  bytesDone: number
  /** 0 si el manifiesto no declara `size` en los archivos a bajar. */
  bytesTotal: number
  currentFile: string | null
  message?: string
}

export type SyncResult =
  | { ok: true; downloaded: number; skipped: number; external: number }
  | { ok: false; error: string }

export const IDLE_PROGRESS: SyncProgress = {
  phase: 'idle',
  filesDone: 0,
  filesTotal: 0,
  bytesDone: 0,
  bytesTotal: 0,
  currentFile: null
}
