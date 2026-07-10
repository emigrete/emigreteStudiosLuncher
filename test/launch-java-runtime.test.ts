import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  componentForMajor,
  javaBinPath,
  executablePaths,
  ensureManagedJava,
  type InstallJavaDeps
} from '../src/main/services/launch/java-runtime.ts'

test('componentForMajor mapea 21/17/8 y falla en lo desconocido', () => {
  assert.equal(componentForMajor(21), 'java-runtime-delta')
  assert.equal(componentForMajor(17), 'java-runtime-gamma')
  assert.equal(componentForMajor(8), 'jre-legacy')
  assert.throws(() => componentForMajor(99))
})

test('javaBinPath usa java.exe en Windows y java en el resto', () => {
  assert.equal(javaBinPath('/r/delta', 'win32'), '/r/delta/bin/java.exe')
  assert.equal(javaBinPath('/r/delta', 'linux'), '/r/delta/bin/java')
})

test('executablePaths devuelve solo los files marcados executable, con ruta absoluta', () => {
  const files = {
    'bin/java': { type: 'file', executable: true },
    'lib/jspawnhelper': { type: 'file', executable: true },
    'lib/rt.jar': { type: 'file', executable: false },
    'legal/README': { type: 'file' },
    bin: { type: 'directory' }
  }
  assert.deepEqual(executablePaths(files, '/dest'), ['/dest/bin/java', '/dest/lib/jspawnhelper'])
})

function depsWith(overrides: Partial<InstallJavaDeps>): InstallJavaDeps {
  return {
    exists: async () => false,
    validate: async () => 21,
    install: async () => undefined,
    ...overrides
  }
}

test('si ya existe un JRE válido, no reinstala (idempotente)', async () => {
  let installed = false
  const deps = depsWith({
    exists: async () => true,
    validate: async () => 21,
    install: async () => {
      installed = true
    }
  })
  const path = await ensureManagedJava(21, '/root', 'linux', () => {}, deps, new AbortController().signal)
  assert.equal(path, '/root/java-runtime-delta/bin/java')
  assert.equal(installed, false)
})

test('si no existe, instala y devuelve la ruta validada', async () => {
  const calls: string[] = []
  const deps = depsWith({
    exists: async () => false,
    install: async ({ component }) => {
      calls.push(component)
    },
    validate: async () => 21
  })
  const path = await ensureManagedJava(21, '/root', 'linux', () => {}, deps, new AbortController().signal)
  assert.deepEqual(calls, ['java-runtime-delta'])
  assert.equal(path, '/root/java-runtime-delta/bin/java')
})

test('si el JRE instalado no valida, tira error (no lanza roto)', async () => {
  const deps = depsWith({ exists: async () => false, install: async () => {}, validate: async () => null })
  await assert.rejects(
    ensureManagedJava(21, '/root', 'linux', () => {}, deps, new AbortController().signal),
    /no es válido/i
  )
})
