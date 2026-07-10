import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectJava, javaCandidates, parseJavaMajor, MIN_JAVA } from '../src/main/services/launch/java.ts'

test('parseJavaMajor entiende los formatos modernos y viejos', () => {
  assert.equal(parseJavaMajor('openjdk version "21.0.2" 2024-01-16'), 21)
  assert.equal(parseJavaMajor('java version "1.8.0_401"'), 8)
  assert.equal(parseJavaMajor('openjdk version "17"'), 17)
  assert.equal(parseJavaMajor('java version "24.0.1" 2025-04-15'), 24)
  assert.equal(parseJavaMajor('openjdk version "11.0.22" 2024-01-16'), 11)
})

test('parseJavaMajor devuelve null si no reconoce nada', () => {
  assert.equal(parseJavaMajor('command not found'), null)
  assert.equal(parseJavaMajor(''), null)
})

test('detectJava elige el primer Java >= 21', async () => {
  const outputs: Record<string, string> = {
    '/viejo/java': 'openjdk version "17.0.9"',
    '/nuevo/java': 'openjdk version "21.0.2"',
    java: 'java version "1.8.0_401"'
  }
  const run = async (p: string): Promise<{ ok: boolean; output: string }> => ({
    ok: p in outputs,
    output: outputs[p] ?? ''
  })
  const result = await detectJava(['/viejo/java', 'java', '/nuevo/java'], run)
  assert.deepEqual(result, { path: '/nuevo/java', major: 21 })
})

test('detectJava devuelve null si no hay ninguno apto', async () => {
  const run = async (): Promise<{ ok: boolean; output: string }> => ({ ok: true, output: 'openjdk version "17.0.9"' })
  assert.equal(await detectJava(['a', 'b'], run), null)
})

test('detectJava saltea los que fallan al ejecutarse', async () => {
  const run = async (p: string): Promise<{ ok: boolean; output: string }> =>
    p === '/ok/java' ? { ok: true, output: 'openjdk version "21"' } : { ok: false, output: '' }
  assert.deepEqual(await detectJava(['/roto/java', '/ok/java'], run), { path: '/ok/java', major: 21 })
})

test('detectJava no reejecuta candidatos repetidos', async () => {
  let calls = 0
  const run = async (): Promise<{ ok: boolean; output: string }> => {
    calls++
    return { ok: false, output: '' }
  }
  await detectJava(['java', 'java', 'java'], run)
  assert.equal(calls, 1)
})

test('javaCandidates prioriza el override y JAVA_HOME', () => {
  const list = javaCandidates({ PACK_JAVA_PATH: '/mi/java', JAVA_HOME: '/opt/jdk21' }, 'linux')
  assert.equal(list[0], '/mi/java')
  assert.equal(list[1], '/opt/jdk21/bin/java')
  assert.ok(list.includes('java'), 'incluye el java del PATH')
})

test('javaCandidates usa java.exe en Windows y rutas típicas por SO', () => {
  const win = javaCandidates({}, 'win32')
  assert.ok(win.every((c) => !c.includes('/usr/lib/jvm')))
  assert.ok(win.some((c) => c.endsWith('java.exe')))
  const linux = javaCandidates({}, 'linux')
  assert.ok(linux.some((c) => c.includes('/usr/lib/jvm')))
})

test('MIN_JAVA es 21 (NeoForge 1.21.1)', () => {
  assert.equal(MIN_JAVA, 21)
})
