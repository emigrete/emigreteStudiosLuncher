import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { access } from 'node:fs/promises'

export interface TestServer {
  url: string
  close: () => Promise<void>
}

export async function startServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void
): Promise<TestServer> {
  const server = createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address !== null ? address.port : 0
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections?.()
        server.close(() => resolve())
      })
  }
}

export async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'ecn-pack-'))
}

export async function removeDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true })
}

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
