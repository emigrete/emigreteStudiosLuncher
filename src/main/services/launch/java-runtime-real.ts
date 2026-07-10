import { access } from 'node:fs/promises'
import { fetchJavaRuntimeManifest, installJavaRuntimeTask } from '@xmcl/installer'
import type { InstallJavaDeps } from './java-runtime'
import { execJavaVersion, parseJavaMajor } from './java'

/**
 * Adaptador real de @xmcl/installer (v6.x). Baja el JRE con parity Mojang: sha1 por
 * archivo lo verifica la lib. Omitimos `lzma` a propósito -> baja los archivos RAW
 * (sin descompresión propia). Es fino: la lógica de decisión vive en ensureManagedJava.
 *
 * API real (verificada en node_modules): `installJavaRuntimeTask` devuelve un Task de
 * @xmcl/task; se corre con `startAndWait(context)` y el progreso sale de task.progress/total.
 */
export const realInstallJavaDeps: InstallJavaDeps = {
  exists: async (path) => {
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  },

  validate: async (path) => {
    const { ok, output } = await execJavaVersion(path)
    if (!ok) return null
    return parseJavaMajor(output)
  },

  install: async ({ component, destination, onProgress, signal }) => {
    if (signal.aborted) throw new Error('Cancelado.')
    const manifest = await fetchJavaRuntimeManifest({ target: component })
    const task = installJavaRuntimeTask({ destination, manifest })

    const onAbort = (): void => {
      void task.cancel()
    }
    signal.addEventListener('abort', onAbort)

    let lastPercent = -1
    try {
      await task.startAndWait({
        onUpdate: () => {
          const total = task.total
          if (total <= 0) return
          const percent = Math.min(100, Math.round((task.progress / total) * 100))
          if (percent !== lastPercent) {
            lastPercent = percent
            onProgress(percent)
          }
        }
      })
    } finally {
      signal.removeEventListener('abort', onAbort)
    }
  }
}
