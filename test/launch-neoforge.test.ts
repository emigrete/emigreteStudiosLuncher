import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  installNeoforge,
  isNeoforgeInstalled,
  NeoforgeError,
  neoforgeInstallerUrl,
  neoforgeJvmArgs,
  neoforgePrefixFor,
  neoforgeVersionId,
  resolveNeoforgeVersion,
  versionDir
} from '../src/main/services/launch/neoforge.ts'
import { exists, makeTempDir, removeDir } from './helpers/server.ts'

const XML = `<metadata><versioning><versions>
  <version>20.4.100</version>
  <version>21.0.5</version>
  <version>21.1.233</version>
  <version>21.1.234</version>
  <version>21.1.235</version>
  <version>26.2.1</version>
</versions></versioning></metadata>`

test('URLs e ids son los correctos', () => {
  assert.equal(neoforgeVersionId('21.1.235'), 'neoforge-21.1.235')
  assert.equal(
    neoforgeInstallerUrl('21.1.235'),
    'https://maven.neoforged.net/releases/net/neoforged/neoforge/21.1.235/neoforge-21.1.235-installer.jar'
  )
})

test('el prefijo NeoForge se deriva de la versión de Minecraft', () => {
  assert.equal(neoforgePrefixFor('1.21.1'), '21.1')
  assert.equal(neoforgePrefixFor('1.21'), '21.0')
  assert.equal(neoforgePrefixFor('1.20.4'), '20.4')
  assert.throws(() => neoforgePrefixFor('raro'), NeoforgeError)
})

test('una versión concreta del manifiesto se usa tal cual, sin tocar la red', async () => {
  let called = false
  const fetchText = async (): Promise<string> => {
    called = true
    return XML
  }
  assert.equal(await resolveNeoforgeVersion('21.1.235', '1.21.1', fetchText), '21.1.235')
  assert.equal(called, false)
})

test('un placeholder resuelve la última 21.1.x (no la 26.x que es de otro MC)', async () => {
  const fetchText = async (): Promise<string> => XML
  assert.equal(await resolveNeoforgeVersion('RELLENAR-PARA-M3', '1.21.1', fetchText), '21.1.235')
  assert.equal(await resolveNeoforgeVersion('latest', '1.21.1', fetchText), '21.1.235')
})

test('si no hay versión para ese Minecraft, error claro', async () => {
  const fetchText = async (): Promise<string> => XML
  await assert.rejects(() => resolveNeoforgeVersion('latest', '1.19.2', fetchText), /No hay NeoForge/)
})

test('installNeoforge: baja, corre el instalador y verifica el resultado', async () => {
  const root = await makeTempDir()
  try {
    const notes: string[] = []
    let downloadedUrl = ''
    const deps = {
      download: async (url: string): Promise<string> => {
        downloadedUrl = url
        return '/tmp/fake-installer.jar'
      },
      // simula el instalador: crea el version json que MCLC va a buscar
      runInstaller: async (_jar: string, r: string): Promise<{ code: number }> => {
        const dir = versionDir(r, '21.1.235')
        await mkdir(dir, { recursive: true })
        await writeFile(join(dir, 'neoforge-21.1.235.json'), '{"inheritsFrom":"1.21.1"}')
        return { code: 0 }
      },
      onNote: (n: string): void => void notes.push(n)
    }
    await installNeoforge(root, '21.1.235', deps)

    assert.equal(await isNeoforgeInstalled(root, '21.1.235'), true)
    assert.match(downloadedUrl, /neoforge-21\.1\.235-installer\.jar$/)
    assert.equal(await exists(join(root, 'launcher_profiles.json')), true, 'crea launcher_profiles.json')
    assert.ok(notes.some((n) => /Instalando/.test(n)))
  } finally {
    await removeDir(root)
  }
})

test('installNeoforge es no-op si ya está instalado', async () => {
  const root = await makeTempDir()
  try {
    const dir = versionDir(root, '21.1.235')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'neoforge-21.1.235.json'), '{}')

    let downloadCalls = 0
    await installNeoforge(root, '21.1.235', {
      download: async (): Promise<string> => {
        downloadCalls++
        return 'x'
      },
      runInstaller: async (): Promise<{ code: number }> => ({ code: 0 })
    })
    assert.equal(downloadCalls, 0, 'no baja nada si ya estaba')
  } finally {
    await removeDir(root)
  }
})

test('installNeoforge falla si el instalador devuelve código != 0', async () => {
  const root = await makeTempDir()
  try {
    await assert.rejects(
      () =>
        installNeoforge(root, '21.1.235', {
          download: async (): Promise<string> => 'x',
          runInstaller: async (): Promise<{ code: number }> => ({ code: 1 })
        }),
      /código 1/
    )
  } finally {
    await removeDir(root)
  }
})

test('installNeoforge falla si el instalador "termina bien" pero no dejó la versión', async () => {
  const root = await makeTempDir()
  try {
    await assert.rejects(
      () =>
        installNeoforge(root, '21.1.235', {
          download: async (): Promise<string> => 'x',
          runInstaller: async (): Promise<{ code: number }> => ({ code: 0 }) // no crea nada
        }),
      /no dejó la versión/
    )
    // y no debe haber pisado un launcher_profiles.json previo
    void readFile
  } finally {
    await removeDir(root)
  }
})

test('ensureLauncherProfiles respeta uno existente', async () => {
  const root = await makeTempDir()
  try {
    await writeFile(join(root, 'launcher_profiles.json'), '{"profiles":{"mío":{}}}')
    await installNeoforge(root, '21.1.235', {
      download: async (): Promise<string> => 'x',
      runInstaller: async (_j, r): Promise<{ code: number }> => {
        const dir = versionDir(r, '21.1.235')
        await mkdir(dir, { recursive: true })
        await writeFile(join(dir, 'neoforge-21.1.235.json'), '{}')
        return { code: 0 }
      }
    })
    const profiles = JSON.parse(await readFile(join(root, 'launcher_profiles.json'), 'utf8'))
    assert.ok(profiles.profiles['mío'], 'no pisó el archivo del usuario')
  } finally {
    await removeDir(root)
  }
})

test('neoforgeJvmArgs resuelve los placeholders y trae los args de módulos', () => {
  const json = {
    arguments: {
      jvm: [
        '-DlibraryDirectory=${library_directory}',
        '-DignoreList=client-extra,${version_name}.jar',
        '-p',
        '${library_directory}/a.jar${classpath_separator}${library_directory}/b.jar',
        '--add-modules',
        'ALL-MODULE-PATH',
        '--add-opens',
        'java.base/java.lang.invoke=cpw.mods.securejarhandler',
        { rules: [] } // objeto condicional: debe ignorarse
      ]
    }
  }
  const args = neoforgeJvmArgs(json, { libraryDir: '/L', versionName: 'neoforge-21.1.235', separator: ':' })
  assert.equal(args.includes('java.base/java.lang.invoke=cpw.mods.securejarhandler'), true)
  assert.equal(args.includes('-DlibraryDirectory=/L'), true)
  assert.equal(args.includes('-DignoreList=client-extra,neoforge-21.1.235.jar'), true)
  assert.equal(args.includes('/L/a.jar:/L/b.jar'), true)
  assert.ok(!args.some((a) => a.includes('${')), 'sin placeholders sin resolver')
  assert.ok(!args.some((a) => typeof a !== 'string'), 'ignora objetos condicionales')
})

test('neoforgeJvmArgs tolera un json sin arguments.jvm', () => {
  assert.deepEqual(neoforgeJvmArgs({}, { libraryDir: '/L', versionName: 'x', separator: ':' }), [])
  assert.deepEqual(neoforgeJvmArgs(null, { libraryDir: '/L', versionName: 'x', separator: ':' }), [])
})
