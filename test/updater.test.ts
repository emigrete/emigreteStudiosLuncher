import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { wireUpdater } from '../src/main/services/updater.ts'
import type { UpdaterStatus } from '../src/shared/updater.ts'

test('wireUpdater mapea cada evento de electron-updater a un status', () => {
  const em = new EventEmitter()
  const seen: UpdaterStatus[] = []
  wireUpdater(em, (s) => seen.push(s))

  em.emit('checking-for-update')
  em.emit('update-available', { version: '0.2.0' })
  em.emit('update-not-available', { version: '0.1.0' })
  em.emit('download-progress', { percent: 42.7 })
  em.emit('update-downloaded', { version: '0.2.0' })
  em.emit('error', new Error('boom'))

  assert.deepEqual(seen, [
    { state: 'checking' },
    { state: 'available', version: '0.2.0' },
    { state: 'none' },
    { state: 'downloading', percent: 43 },
    { state: 'ready', version: '0.2.0' },
    { state: 'error', message: 'boom' }
  ])
})

test('wireUpdater tolera payloads raros sin romperse', () => {
  const em = new EventEmitter()
  const seen: UpdaterStatus[] = []
  wireUpdater(em, (s) => seen.push(s))

  em.emit('update-available', undefined)
  em.emit('download-progress', {})
  em.emit('error', 'texto suelto')

  assert.deepEqual(seen, [
    { state: 'available', version: '?' },
    { state: 'downloading', percent: 0 },
    { state: 'error', message: 'texto suelto' }
  ])
})
