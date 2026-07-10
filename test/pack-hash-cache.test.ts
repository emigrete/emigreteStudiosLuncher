import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { utimes, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createCachedHasher, plainHasher } from '../src/main/services/pack/hash-cache.ts'
import { exists, makeTempDir, removeDir } from './helpers/server.ts'

const sha1 = (data: string): string => createHash('sha1').update(data).digest('hex')
/** mtime fijo: así podemos "congelar" el stat y probar que el caché se usa. */
const FROZEN = new Date(1_700_000_000_000)

test('plainHasher siempre lee el archivo', async () => {
  const dir = await makeTempDir()
  try {
    const file = join(dir, 'a.txt')
    await writeFile(file, 'uno', 'utf8')
    assert.equal(await plainHasher.hash(file, 'a.txt'), sha1('uno'))
    await writeFile(file, 'dos', 'utf8')
    assert.equal(await plainHasher.hash(file, 'a.txt'), sha1('dos'))
  } finally {
    await removeDir(dir)
  }
})

test('el caché evita re-hashear cuando tamaño y mtime no cambian', async () => {
  const dir = await makeTempDir()
  try {
    const target = join(dir, 'a.jar')
    await writeFile(target, 'AAA', 'utf8') // mismo largo que 'BBB'
    await utimes(target, FROZEN, FROZEN)

    const first = await createCachedHasher(dir)
    assert.equal(await first.hash(target, 'a.jar'), sha1('AAA'))
    await first.flush()
    assert.equal(await exists(join(dir, '.sync-cache.json')), true)

    // Cambiamos el contenido pero restauramos tamaño + mtime: el caché debe "acertar"
    // y devolver el hash viejo. Esto documenta el trade-off explícitamente.
    await writeFile(target, 'BBB', 'utf8')
    await utimes(target, FROZEN, FROZEN)

    const second = await createCachedHasher(dir)
    assert.equal(await second.hash(target, 'a.jar'), sha1('AAA'), 'usó el caché')
  } finally {
    await removeDir(dir)
  }
})

test('el caché se invalida si cambia el mtime', async () => {
  const dir = await makeTempDir()
  try {
    const target = join(dir, 'a.jar')
    await writeFile(target, 'AAA', 'utf8')
    await utimes(target, FROZEN, FROZEN)

    const first = await createCachedHasher(dir)
    await first.hash(target, 'a.jar')
    await first.flush()

    await writeFile(target, 'BBB', 'utf8')
    await utimes(target, new Date(FROZEN.getTime() + 5000), new Date(FROZEN.getTime() + 5000))

    const second = await createCachedHasher(dir)
    assert.equal(await second.hash(target, 'a.jar'), sha1('BBB'), 're-hasheó')
  } finally {
    await removeDir(dir)
  }
})

test('el caché se invalida si cambia el tamaño', async () => {
  const dir = await makeTempDir()
  try {
    const target = join(dir, 'a.jar')
    await writeFile(target, 'AAA', 'utf8')
    await utimes(target, FROZEN, FROZEN)
    const first = await createCachedHasher(dir)
    await first.hash(target, 'a.jar')
    await first.flush()

    await writeFile(target, 'AAAA', 'utf8')
    await utimes(target, FROZEN, FROZEN)
    const second = await createCachedHasher(dir)
    assert.equal(await second.hash(target, 'a.jar'), sha1('AAAA'))
  } finally {
    await removeDir(dir)
  }
})

test('archivo inexistente devuelve null', async () => {
  const dir = await makeTempDir()
  try {
    const hasher = await createCachedHasher(dir)
    assert.equal(await hasher.hash(join(dir, 'no-existe.jar'), 'no-existe.jar'), null)
  } finally {
    await removeDir(dir)
  }
})

test('un caché corrupto no rompe nada: se reconstruye', async () => {
  const dir = await makeTempDir()
  try {
    await writeFile(join(dir, '.sync-cache.json'), '{no es json', 'utf8')
    const target = join(dir, 'a.jar')
    await writeFile(target, 'AAA', 'utf8')

    const hasher = await createCachedHasher(dir)
    assert.equal(await hasher.hash(target, 'a.jar'), sha1('AAA'))
  } finally {
    await removeDir(dir)
  }
})
