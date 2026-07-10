import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { parseManifest } from '../src/main/services/pack/manifest.ts'
import { makeTempDir, removeDir } from './helpers/server.ts'

const run = promisify(execFile)
const sha1 = (data: string): string => createHash('sha1').update(data).digest('hex')

test('el packager genera un manifiesto que el launcher acepta', async () => {
  const dir = await makeTempDir()
  try {
    const pack = join(dir, 'pack')
    await mkdir(join(pack, 'mods'), { recursive: true })
    await mkdir(join(pack, 'config', 'mi mod'), { recursive: true }) // con espacio: hay que url-encodear
    await writeFile(join(pack, 'mods', 'a.jar'), 'AAA', 'utf8')
    await writeFile(join(pack, 'config', 'mi mod', 'c.json'), '{}', 'utf8')
    await writeFile(join(pack, '.sync-cache.json'), 'ignorame', 'utf8')
    await writeFile(join(pack, 'mods', 'b.jar.part'), 'a medias', 'utf8')

    const out = join(dir, 'manifest.json')
    await run('node', [
      'scripts/make-manifest.mjs',
      '--root', pack,
      '--base-url', 'https://cdn.test/pack/',
      '--out', out,
      '--pack-version', '1.2.3',
      '--loader', 'neoforge:21.1.0'
    ])

    const manifest = parseManifest(JSON.parse(await readFile(out, 'utf8')))

    assert.equal(manifest.packVersion, '1.2.3')
    assert.deepEqual(manifest.loader, { type: 'neoforge', version: '21.1.0' })
    assert.equal(manifest.files.length, 2, 'ignora .sync-cache.json y los .part')

    const byPath = Object.fromEntries(manifest.files.map((f) => [f.path, f]))
    assert.equal(byPath['mods/a.jar'].sha1, sha1('AAA'))
    assert.equal(byPath['mods/a.jar'].size, 3)
    assert.equal(byPath['mods/a.jar'].url, 'https://cdn.test/pack/mods/a.jar')

    // La barra separa segmentos; los espacios se codifican.
    assert.equal(byPath['config/mi mod/c.json'].url, 'https://cdn.test/pack/config/mi%20mod/c.json')
  } finally {
    await removeDir(dir)
  }
})

test('el packager exige --base-url http(s)', async () => {
  const dir = await makeTempDir()
  try {
    await assert.rejects(
      () => run('node', ['scripts/make-manifest.mjs', '--root', dir, '--base-url', 'file:///etc']),
      /base-url debe ser http/
    )
  } finally {
    await removeDir(dir)
  }
})
