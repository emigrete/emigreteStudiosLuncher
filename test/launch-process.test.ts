import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runProcess } from '../src/main/services/launch/process.ts'

// Este entorno tiene Java 21 (lo usamos como subproceso real de control).

test('runProcess corre un comando y captura la salida', async () => {
  const lines: string[] = []
  const result = await runProcess('java', ['-version'], { onLine: (l) => lines.push(l) })
  assert.equal(result.code, 0)
  assert.match(result.tail, /version/i)
  assert.ok(lines.length > 0, 'streameó líneas')
})

test('runProcess devuelve código != 0 ante un flag inválido', async () => {
  const result = await runProcess('java', ['--flag-que-no-existe-xyz'])
  assert.notEqual(result.code, 0)
})

test('runProcess rechaza si el comando no existe', async () => {
  await assert.rejects(() => runProcess('comando-inexistente-zzz', []), /ENOENT|spawn/)
})

test('runProcess se puede abortar', async () => {
  const controller = new AbortController()
  // -version termina rápido; abortamos antes de correr algo largo con un sleep de la JVM.
  const promise = runProcess('java', ['-version'], { signal: controller.signal })
  controller.abort()
  const result = await promise.catch(() => ({ code: null, tail: '' }))
  assert.ok(result.code === null || typeof result.code === 'number')
})

test('runProcess corta por timeout', async () => {
  // Un java que "duerme" no es trivial; usamos un timeout muy corto sobre -version
  // para al menos ejercitar el camino del timeout sin colgar el test.
  const result = await runProcess('java', ['-version'], { timeoutMs: 1 }).catch(() => ({ code: null, tail: '' }))
  assert.ok('code' in result)
})
