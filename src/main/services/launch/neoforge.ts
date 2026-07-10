import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'

/**
 * Instalación de NeoForge para lanzar con MCLC.
 *
 * MCLC NO instala NeoForge (su opción `forge` es solo Forge). El patrón correcto,
 * confirmado corriendo el instalador real:
 *   1. correr `java -jar neoforge-<ver>-installer.jar --install-client <root>`
 *   2. lanzar con `version.custom = 'neoforge-<ver>'`
 * El instalador crea `versions/neoforge-<ver>/neoforge-<ver>.json` (inheritsFrom 1.21.1).
 *
 * Todo lo de IO/red se inyecta para poder testear la orquestación sin descargar 200 MB.
 */

const MAVEN_BASE = 'https://maven.neoforged.net/releases/net/neoforged/neoforge'
const METADATA_URL = `${MAVEN_BASE}/maven-metadata.xml`

const CONCRETE_VERSION = /^\d+\.\d+\.\d+(?:-beta)?$/

export function neoforgeVersionId(version: string): string {
  return `neoforge-${version}`
}

export function neoforgeInstallerUrl(version: string): string {
  return `${MAVEN_BASE}/${version}/neoforge-${version}-installer.jar`
}

/** Prefijo NeoForge para una versión de Minecraft: 1.21.1 -> "21.1", 1.21 -> "21.0". */
export function neoforgePrefixFor(mcVersion: string): string {
  const parts = mcVersion.split('.')
  if (parts[0] !== '1' || parts.length < 2) throw new NeoforgeError(`Versión de Minecraft no soportada: ${mcVersion}`)
  return `${parts[1]}.${parts[2] ?? '0'}`
}

export class NeoforgeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NeoforgeError'
  }
}

export type FetchText = (url: string) => Promise<string>

/**
 * Resuelve la versión concreta de NeoForge.
 *   - si el manifiesto ya trae una versión concreta (21.1.235) -> se usa tal cual
 *   - si trae "latest" o un placeholder -> se busca la última 21.1.x en maven-metadata
 */
export async function resolveNeoforgeVersion(loaderVersion: string, mcVersion: string, fetchText: FetchText): Promise<string> {
  const trimmed = loaderVersion.trim()
  if (CONCRETE_VERSION.test(trimmed)) return trimmed

  const prefix = neoforgePrefixFor(mcVersion)
  let xml: string
  try {
    xml = await fetchText(METADATA_URL)
  } catch (error) {
    throw new NeoforgeError(`No se pudo consultar las versiones de NeoForge: ${asMessage(error)}`)
  }

  const matching = [...xml.matchAll(/<version>([^<]+)<\/version>/g)]
    .map((m) => m[1])
    .filter((v) => v.startsWith(`${prefix}.`) && CONCRETE_VERSION.test(v))
    .sort(compareVersions)

  const latest = matching.at(-1)
  if (!latest) throw new NeoforgeError(`No hay NeoForge para Minecraft ${mcVersion} (prefijo ${prefix}).`)
  return latest
}

export function versionDir(root: string, version: string): string {
  return join(root, 'versions', neoforgeVersionId(version))
}

export async function isNeoforgeInstalled(root: string, version: string): Promise<boolean> {
  const json = join(versionDir(root, version), `${neoforgeVersionId(version)}.json`)
  try {
    await access(json, constants.R_OK)
    return true
  } catch {
    return false
  }
}

/** El instalador de NeoForge (heredado de Forge) exige un launcher_profiles.json presente. */
export async function ensureLauncherProfiles(root: string): Promise<void> {
  await mkdir(root, { recursive: true })
  const file = join(root, 'launcher_profiles.json')
  try {
    await access(file, constants.F_OK)
  } catch {
    await writeFile(file, JSON.stringify({ profiles: {}, version: 3 }), 'utf8')
  }
}

export interface InstallDeps {
  /** Baja el instalador (verificado) y devuelve su ruta local. */
  download: (url: string, version: string) => Promise<string>
  /** Corre `java -jar <jar> --install-client <root>`. Devuelve el código de salida. */
  runInstaller: (jar: string, root: string, signal?: AbortSignal) => Promise<{ code: number | null }>
  onNote?: (note: string) => void
  signal?: AbortSignal
}

/** Deja NeoForge instalado en `root`. No-op si ya estaba. */
export async function installNeoforge(root: string, version: string, deps: InstallDeps): Promise<void> {
  if (await isNeoforgeInstalled(root, version)) {
    deps.onNote?.('NeoForge ya instalado')
    return
  }
  await ensureLauncherProfiles(root)

  deps.onNote?.('Descargando NeoForge')
  const jar = await deps.download(neoforgeInstallerUrl(version), version)

  deps.onNote?.('Instalando NeoForge')
  const { code } = await deps.runInstaller(jar, root, deps.signal)
  if (code !== 0) throw new NeoforgeError(`El instalador de NeoForge terminó con código ${code}.`)

  if (!(await isNeoforgeInstalled(root, version))) {
    throw new NeoforgeError('El instalador de NeoForge no dejó la versión esperada.')
  }
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  }
  return 0
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}


/**
 * NeoForge 1.21.1 usa el sistema de módulos de Java (JPMS): necesita args JVM
 * (--add-opens, -p, --add-modules, ...) que están en `arguments.jvm` del version json.
 * MCLC mergea los args de JUEGO de NeoForge pero NO los de JVM, así que los leemos
 * nosotros y se los pasamos como `customArgs`. (De ahí el InaccessibleObjectException).
 */

export interface JvmArgContext {
  /** Carpeta de librerías: <root>/libraries */
  libraryDir: string
  /** Nombre de la versión custom, p.ej. neoforge-21.1.235 */
  versionName: string
  /** ':' en Linux/Mac, ';' en Windows */
  separator: string
}

export async function readNeoforgeVersionJson(root: string, version: string): Promise<unknown> {
  const file = join(versionDir(root, version), `${neoforgeVersionId(version)}.json`)
  return JSON.parse(await readFile(file, 'utf8'))
}

/** Extrae y resuelve los argumentos JVM de NeoForge (solo los strings; ignora objetos condicionales). */
export function neoforgeJvmArgs(versionJson: unknown, ctx: JvmArgContext): string[] {
  const jvm = (versionJson as { arguments?: { jvm?: unknown } })?.arguments?.jvm
  if (!Array.isArray(jvm)) return []
  return jvm
    .filter((arg): arg is string => typeof arg === 'string')
    .map((arg) =>
      arg
        .split('${library_directory}').join(ctx.libraryDir)
        .split('${classpath_separator}').join(ctx.separator)
        .split('${version_name}').join(ctx.versionName)
    )
}
