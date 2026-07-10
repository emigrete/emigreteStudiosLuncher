import { join } from 'node:path'

/**
 * JRE gestionado (fallback cuando no hay Java del sistema). La lógica es pura y
 * se testea con deps inyectadas; el adaptador real de @xmcl vive aparte
 * (java-runtime-real.ts) y se verifica a mano.
 */

const JAVA_COMPONENTS: Record<number, string> = {
  8: 'jre-legacy',
  17: 'java-runtime-gamma',
  21: 'java-runtime-delta'
}

export function componentForMajor(major: number): string {
  const component = JAVA_COMPONENTS[major]
  if (!component) throw new Error(`No hay componente de Java conocido para el major ${major}.`)
  return component
}

export function javaBinPath(runtimeDir: string, platform: NodeJS.Platform): string {
  const exe = platform === 'win32' ? 'java.exe' : 'java'
  return join(runtimeDir, 'bin', exe)
}

export interface InstallJavaDeps {
  /** ¿Existe ya el ejecutable? */
  exists: (path: string) => Promise<boolean>
  /** Corre `<path> -version` y devuelve el major, o null si no valida. */
  validate: (path: string) => Promise<number | null>
  /** Descarga+extrae el JRE del componente dado en `destination`. */
  install: (args: {
    component: string
    destination: string
    platform: NodeJS.Platform
    onProgress: (percent: number) => void
    signal: AbortSignal
  }) => Promise<void>
}

/**
 * Garantiza un JRE >= requiredMajor en `runtimeRoot/<component>` y devuelve la ruta
 * a `bin/java`. Idempotente: si ya está y valida, no re-descarga.
 */
export async function ensureManagedJava(
  requiredMajor: number,
  runtimeRoot: string,
  platform: NodeJS.Platform,
  onProgress: (percent: number) => void,
  deps: InstallJavaDeps,
  signal: AbortSignal
): Promise<string> {
  const component = componentForMajor(requiredMajor)
  const destination = join(runtimeRoot, component)
  const javaPath = javaBinPath(destination, platform)

  if (await deps.exists(javaPath)) {
    const major = await deps.validate(javaPath)
    if (major !== null && major >= requiredMajor) return javaPath
  }

  await deps.install({ component, destination, platform, onProgress, signal })

  const major = await deps.validate(javaPath)
  if (major === null || major < requiredMajor) {
    throw new Error('El Java descargado no es válido. Reintentá o instalá Java 21 manualmente.')
  }
  return javaPath
}
