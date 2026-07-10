import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { isReadyLine, runMclc, toLoaderProgress, type MclcClient } from '../src/main/services/launch/minecraft.ts'

/** Cliente MCLC falso: un EventEmitter con `launch()` que devuelve un proceso killable. */
class FakeClient extends EventEmitter implements MclcClient {
  killed = false
  launchOk = true
  async launch(): Promise<{ kill: () => void } | null> {
    if (!this.launchOk) return null
    return { kill: () => (this.killed = true) }
  }
}

test('isReadyLine detecta el arranque de la ventana', () => {
  assert.equal(isReadyLine('[Render thread/INFO]: Backend library: LWJGL version 3.3.3'), true)
  assert.equal(isReadyLine('[Render thread/INFO]: OpenAL initialized.'), true)
  assert.equal(isReadyLine('Setting user: FARFA'), true)
  assert.equal(isReadyLine('[main/INFO]: Loading 47 mods'), false)
  assert.equal(isReadyLine('random log line'), false)
})

test('toLoaderProgress normaliza el evento de MCLC', () => {
  assert.deepEqual(toLoaderProgress({ type: 'assets', task: 3, total: 10 }), { type: 'assets', task: 3, total: 10 })
  assert.deepEqual(toLoaderProgress({ task: 1, total: 2 }), { type: 'descarga', task: 1, total: 2 })
  assert.equal(toLoaderProgress({ type: 'x' }), null)
  assert.equal(toLoaderProgress(null), null)
})

test('runMclc: emite progreso, detecta ready y resuelve al cerrar limpio', async () => {
  const client = new FakeClient()
  const progress: number[] = []
  let readyFired = false

  const promise = runMclc(
    client,
    { root: '/x' },
    {
      onProgress: (p) => progress.push(p.task),
      onReady: () => (readyFired = true)
    }
  )

  // Simulamos el ciclo de vida del juego.
  await Promise.resolve()
  client.emit('progress', { type: 'assets', task: 5, total: 10 })
  client.emit('data', '[main/INFO]: Loading mods')
  assert.equal(readyFired, false, 'todavía no abrió la ventana')
  client.emit('data', '[Render thread/INFO]: OpenAL initialized.')
  assert.equal(readyFired, true, 'la ventana abrió')
  client.emit('close', 0)

  const outcome = await promise
  assert.deepEqual(outcome, { code: 0, ready: true })
  assert.deepEqual(progress, [5])
})

test('runMclc: un crash temprano se refleja (ready=false, code!=0)', async () => {
  const client = new FakeClient()
  const promise = runMclc(client, {}, {})
  await Promise.resolve()
  client.emit('data', '[main/ERROR]: Mixin apply failed')
  client.emit('close', 1)
  assert.deepEqual(await promise, { code: 1, ready: false })
})

test('runMclc rechaza si MCLC no pudo lanzar (launch devuelve null)', async () => {
  const client = new FakeClient()
  client.launchOk = false
  await assert.rejects(() => runMclc(client, {}, {}), /no pudo lanzar/)
})

test('runMclc mata el proceso si se aborta', async () => {
  const client = new FakeClient()
  const controller = new AbortController()
  const promise = runMclc(client, {}, {}, controller.signal)
  await Promise.resolve()
  await Promise.resolve() // deja que launch() resuelva y guarde el proceso
  controller.abort()
  client.emit('close', null)
  await promise
  assert.equal(client.killed, true)
})
