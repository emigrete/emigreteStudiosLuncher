import { spawn } from 'node:child_process'

/**
 * Runner de subprocesos (el instalador de NeoForge). Streamea la salida por
 * `onLine` (para un log) y guarda una cola acotada para el mensaje de error.
 * Sin dependencias de Electron: testeable con un `java -version` real.
 */

export interface RunResult {
  code: number | null
  /** Últimas líneas de salida (cola acotada), útil para diagnosticar fallos. */
  tail: string
}

export interface RunOptions {
  cwd?: string
  signal?: AbortSignal
  onLine?: (line: string) => void
  /** Máximo de caracteres a retener en `tail`. */
  maxTail?: number
  timeoutMs?: number
}

export function runProcess(command: string, args: string[], options: RunOptions = {}): Promise<RunResult> {
  const maxTail = options.maxTail ?? 4000
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, windowsHide: true })
    let tail = ''
    let settled = false

    const consume = (chunk: Buffer): void => {
      const text = chunk.toString('utf8')
      for (const line of text.split(/\r?\n/)) {
        if (line.length > 0) options.onLine?.(line)
      }
      tail = (tail + text).slice(-maxTail)
    }
    child.stdout.on('data', consume)
    child.stderr.on('data', consume)

    const timer = options.timeoutMs ? setTimeout(() => child.kill(), options.timeoutMs) : undefined
    const onAbort = (): void => {
      child.kill()
    }
    options.signal?.addEventListener('abort', onAbort, { once: true })

    const done = (fn: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', onAbort)
      fn()
    }

    child.on('error', (error) => done(() => reject(error)))
    child.on('close', (code) => done(() => resolve({ code, tail })))
  })
}
