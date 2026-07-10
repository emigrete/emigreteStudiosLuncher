import { execFile } from 'node:child_process'
import { join } from 'node:path'

/**
 * Detección de un runtime de Java apto para NeoForge 1.21.1 (necesita Java 21).
 * MCLC no descarga Java: usa `javaPath` o `java` del PATH. Acá buscamos un Java >= 21.
 *
 * `parseJavaMajor` es pura (testeada); `detectJava` inyecta el runner para poder testear
 * la selección sin ejecutar procesos reales.
 */

export const MIN_JAVA = 21

export interface JavaInfo {
  path: string
  major: number
}

/**
 * `java -version` escribe en STDERR. Formatos:
 *   openjdk version "21.0.2" 2024-01-16   -> 21
 *   java version "1.8.0_401"              -> 8   (esquema viejo 1.x)
 *   openjdk version "17"                  -> 17
 */
export function parseJavaMajor(versionOutput: string): number | null {
  const match = versionOutput.match(/version\s+"?(\d+)(?:\.(\d+))?/i)
  if (!match) return null
  const first = Number(match[1])
  if (first === 1 && match[2] !== undefined) return Number(match[2]) // 1.8 -> 8
  return Number.isFinite(first) ? first : null
}

export type JavaRunner = (path: string) => Promise<{ ok: boolean; output: string }>

/** Runner real: corre `<path> -version` y devuelve su salida combinada. */
export const execJavaVersion: JavaRunner = (path) =>
  new Promise((resolve) => {
    execFile(path, ['-version'], { timeout: 8000 }, (error, stdout, stderr) => {
      const output = `${stderr}${stdout}`
      resolve({ ok: !error, output })
    })
  })

/** Devuelve el primer candidato que sea Java >= requiredMajor, o null. */
export async function detectJava(
  candidates: readonly string[],
  run: JavaRunner = execJavaVersion,
  requiredMajor: number = MIN_JAVA
): Promise<JavaInfo | null> {
  const tried = new Set<string>()
  for (const path of candidates) {
    if (!path || tried.has(path)) continue
    tried.add(path)
    const { ok, output } = await run(path)
    if (!ok) continue
    const major = parseJavaMajor(output)
    if (major !== null && major >= requiredMajor) return { path, major }
  }
  return null
}

/**
 * Candidatos a probar, en orden de preferencia:
 *   1. override explícito (env PACK_JAVA_PATH)
 *   2. JAVA_HOME
 *   3. `java` del PATH
 *   4. ubicaciones típicas por SO
 */
export function javaCandidates(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string[] {
  const exe = platform === 'win32' ? 'java.exe' : 'java'
  const candidates: string[] = []

  if (env.PACK_JAVA_PATH) candidates.push(env.PACK_JAVA_PATH)
  if (env.JAVA_HOME) candidates.push(join(env.JAVA_HOME, 'bin', exe))
  candidates.push(exe) // PATH

  if (platform === 'linux') {
    for (const base of ['/usr/lib/jvm', '/usr/lib64/jvm']) {
      for (const name of ['java-21-openjdk', 'java-21', 'temurin-21-jdk', 'java-21-openjdk-amd64']) {
        candidates.push(join(base, name, 'bin', exe))
      }
    }
  } else if (platform === 'darwin') {
    for (const name of ['temurin-21.jdk', 'zulu-21.jdk', 'openjdk-21.jdk']) {
      candidates.push(join('/Library/Java/JavaVirtualMachines', name, 'Contents/Home/bin', exe))
    }
  } else if (platform === 'win32') {
    for (const root of ['C:\\Program Files\\Eclipse Adoptium', 'C:\\Program Files\\Java', 'C:\\Program Files\\Microsoft']) {
      for (const name of ['jdk-21', 'jre-21', 'jdk-21.0.5']) {
        candidates.push(join(root, name, 'bin', exe))
      }
    }
  }
  return candidates
}
