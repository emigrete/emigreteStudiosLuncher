import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { isSafeRelativePath, safeResolve, UnsafePathError } from '../src/main/services/pack/paths.ts'

const ROOT = '/tmp/instancia'

test('acepta rutas relativas normales del modpack', () => {
  for (const path of ['mods/mod.jar', 'config/mi-mod/corruption.json', 'options.txt', 'a/b/c/d.dat']) {
    assert.equal(isSafeRelativePath(path), true, path)
  }
})

test('rechaza path traversal', () => {
  for (const path of ['../evil', '../../etc/passwd', 'mods/../../x', 'a/../../b', '..']) {
    assert.equal(isSafeRelativePath(path), false, path)
  }
})

test('rechaza rutas absolutas (posix y Windows)', () => {
  for (const path of ['/etc/passwd', '/', 'C:/Windows/System32', 'c:/x']) {
    assert.equal(isSafeRelativePath(path), false, path)
  }
})

test('rechaza backslash, segmentos vacíos, "." y bytes nulos', () => {
  for (const path of ['mods\\mod.jar', '..\\..\\x', 'mods//mod.jar', 'mods/./mod.jar', 'mods/', 'a\0b', '']) {
    assert.equal(isSafeRelativePath(path), false, JSON.stringify(path))
  }
})

test('rechaza rutas absurdamente largas', () => {
  assert.equal(isSafeRelativePath('a/'.repeat(600) + 'b'), false)
})

test('safeResolve devuelve una ruta dentro del root', () => {
  assert.equal(safeResolve(ROOT, 'mods/mod.jar'), resolve(ROOT, 'mods/mod.jar'))
})

test('safeResolve lanza UnsafePathError ante cualquier escape', () => {
  for (const path of ['../fuera.txt', '/etc/passwd', 'mods/../../fuera.txt', 'x\\y']) {
    assert.throws(() => safeResolve(ROOT, path), UnsafePathError, path)
  }
})

test('safeResolve no se confunde con un root que es prefijo de otro directorio', () => {
  // /tmp/instancia vs /tmp/instancia-mala: startsWith sin separador daría un falso positivo.
  assert.throws(() => safeResolve('/tmp/instancia', '../instancia-mala/x'), UnsafePathError)
})
