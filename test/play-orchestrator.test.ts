import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { SyncResult } from '../src/shared/pack.ts'
import type { PlayResult, PlayState } from '../src/shared/play.ts'
import { runPlay } from '../src/main/services/play.ts'

const okSync = async (): Promise<SyncResult> => ({ ok: true, downloaded: 2, skipped: 1, external: 0 })

test('flujo feliz: sincroniza, lanza y termina en idle', async () => {
  const states: PlayState[] = []
  const launch = async (emit: (s: PlayState) => void): Promise<PlayResult> => {
    emit({ phase: 'preparing' })
    emit({ phase: 'installing-loader' })
    emit({ phase: 'launching' })
    emit({ phase: 'running' })
    return { ok: true }
  }
  const result = await runPlay((s) => states.push(s), { sync: okSync, launch }, new AbortController().signal)

  assert.deepEqual(result, { ok: true })
  const phases = states.map((s) => s.phase)
  assert.deepEqual(phases, ['syncing', 'preparing', 'installing-loader', 'launching', 'running', 'idle'])
})

test('si la sync falla, no se intenta lanzar', async () => {
  const states: PlayState[] = []
  let launchCalled = false
  const result = await runPlay(
    (s) => states.push(s),
    {
      sync: async () => ({ ok: false, error: 'sin internet' }),
      launch: async () => {
        launchCalled = true
        return { ok: true }
      }
    },
    new AbortController().signal
  )

  assert.equal(launchCalled, false)
  assert.deepEqual(result, { ok: false, error: 'sin internet' })
  assert.equal(states.at(-1)?.phase, 'error')
})

test('si el launch falla (p. ej. sin Java), termina en error', async () => {
  const states: PlayState[] = []
  const result = await runPlay(
    (s) => states.push(s),
    { sync: okSync, launch: async () => ({ ok: false, error: 'Necesitás Java 21' }) },
    new AbortController().signal
  )
  assert.deepEqual(result, { ok: false, error: 'Necesitás Java 21' })
  const last = states.at(-1)
  assert.equal(last?.phase, 'error')
  assert.equal(last && 'message' in last ? last.message : '', 'Necesitás Java 21')
})

test('el progreso de sync se propaga como fase "syncing"', async () => {
  const states: PlayState[] = []
  const sync = async (onProgress: (p: never) => void): Promise<SyncResult> => {
    onProgress({ phase: 'downloading', filesDone: 1, filesTotal: 2, bytesDone: 50, bytesTotal: 100, currentFile: 'a' } as never)
    return { ok: true, downloaded: 1, skipped: 0, external: 0 }
  }
  await runPlay((s) => states.push(s), { sync, launch: async () => ({ ok: true }) }, new AbortController().signal)
  const syncing = states.find((s) => s.phase === 'syncing' && s.sync.phase === 'downloading')
  assert.ok(syncing, 'reenvía el progreso de la sync')
})

test('cancelar entre sync y launch no lanza el juego', async () => {
  const controller = new AbortController()
  let launchCalled = false
  const result = await runPlay(
    () => undefined,
    {
      sync: async () => {
        controller.abort() // se canceló justo al terminar la sync
        return { ok: true, downloaded: 0, skipped: 3, external: 0 }
      },
      launch: async () => {
        launchCalled = true
        return { ok: true }
      }
    },
    controller.signal
  )
  assert.equal(launchCalled, false)
  assert.equal(result.ok, false)
})
