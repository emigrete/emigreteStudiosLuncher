import { z } from 'zod'
import type { PackManifest } from '../../../shared/pack'
import { isSafeRelativePath } from './paths'

/**
 * Validación del manifiesto. Es dato remoto: se valida forma, esquema de URL
 * (solo http/https, nunca file://) y seguridad de las rutas.
 */

export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

const MAX_FILES = 10_000
const MAX_MANIFEST_BYTES = 8 * 1024 * 1024 // 8 MB: un manifiesto honesto es de KB

const httpUrl = z.string().refine(isHttpUrl, { message: 'la URL debe ser http(s)' })
const sha1 = z.string().regex(/^[0-9a-fA-F]{40}$/, { message: 'sha1 debe ser 40 dígitos hex' })
const safePath = z.string().refine(isSafeRelativePath, { message: 'ruta relativa insegura' })

const fileSchema = z.object({
  path: safePath,
  url: httpUrl,
  sha1,
  size: z.number().int().nonnegative().optional()
})

const externalSchema = z.object({
  name: z.string().min(1),
  source: z.string().min(1),
  projectId: z.number().int().optional(),
  fileId: z.number().int().optional(),
  targetPath: safePath
})

export const manifestSchema = z.object({
  packName: z.string().min(1),
  packVersion: z.string().min(1),
  minecraft: z.string().min(1),
  loader: z.object({ type: z.string().min(1), version: z.string().min(1) }),
  java: z.object({ major: z.number().int().positive() }).optional(),
  server: z.object({ host: z.string(), port: z.number().int().min(1).max(65535) }).optional(),
  files: z.array(fileSchema).max(MAX_FILES),
  external: z.array(externalSchema).default([])
})
  .superRefine((manifest, ctx) => {
    // Dos archivos con la misma ruta se escribirían al mismo destino a la vez.
    const seen = new Set<string>()
    manifest.files.forEach((file, index) => {
      const key = file.path.toLowerCase()
      if (seen.has(key)) {
        ctx.addIssue({ code: 'custom', path: ['files', index, 'path'], message: `ruta duplicada: ${file.path}` })
      }
      seen.add(key)
    })
  })

export class ManifestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ManifestError'
  }
}

/** Valida el JSON crudo. Lanza `ManifestError` con el primer problema legible. */
export function parseManifest(raw: unknown): PackManifest {
  const result = manifestSchema.safeParse(raw)
  if (result.success) return result.data

  const issue = result.error.issues[0]
  const where = issue.path.length > 0 ? issue.path.join('.') : 'manifiesto'
  throw new ManifestError(`Manifiesto inválido en "${where}": ${issue.message}`)
}

export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal; redirect?: 'follow' | 'error' | 'manual' }
) => Promise<Response>

export async function fetchManifest(
  url: string,
  fetchFn: FetchLike,
  signal?: AbortSignal
): Promise<PackManifest> {
  if (!isHttpUrl(url)) throw new ManifestError(`URL de manifiesto inválida: ${url}`)

  const response = await fetchFn(url, { signal })
  if (!response.ok) throw new ManifestError(`No se pudo bajar el manifiesto (HTTP ${response.status})`)

  let raw: unknown
  try {
    raw = JSON.parse(await readCappedText(response, MAX_MANIFEST_BYTES))
  } catch (error) {
    if (error instanceof ManifestError) throw error
    throw new ManifestError('El manifiesto no es JSON válido')
  }
  return parseManifest(raw)
}

/** Lee el cuerpo con un tope de bytes: un servidor no puede hacernos tragar GB. */
async function readCappedText(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) throw new ManifestError('El manifiesto es demasiado grande')

  const body = response.body
  if (!body) return response.text()

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined)
      throw new ManifestError('El manifiesto es demasiado grande')
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8')
}
