import { HttpError } from './http'

export const MAX_SUBMISSION_URL_BYTES = 12 * 1024
export const MAX_QUERY_UPLOAD_BYTES = 8 * 1024
const common = ['intent', 'confirm', 'key']
const fields = {
  action: [...common, 'action'],
  upload: [...common, 'mime', 'data', 'audience'],
  'upload-start': [
    ...common,
    'mime',
    'bytes',
    'sha256',
    'partBytes',
    'audience'
  ],
  'upload-part': [...common, 'part', 'data'],
  'upload-complete': common,
  'upload-abort': common
} as const

function decodePart(encoded: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.length % 4 === 1)
    throw new HttpError(400, 'Supply unpadded base64url file bytes as data')
  if (encoded.length > Math.ceil((MAX_QUERY_UPLOAD_BYTES * 4) / 3))
    throw new HttpError(
      413,
      'A query upload or part is limited to 8 KiB. Use multipart GET for larger files, or POST for files up to 2 MiB.'
    )
  const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))
  if (
    btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') !==
    encoded
  )
    throw new HttpError(400, 'Supply canonical unpadded base64url file bytes')
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

/** Explicit compatibility writes for URL-only agents. Normalize before Session
 * authorization, lifecycle and journal handling. Never render live submit links.
 */
export function agentSubmission(request: Request): Request {
  if (request.method !== 'GET')
    throw new HttpError(
      405,
      'Use GET for a query submission, or the normal POST endpoint'
    )
  if (
    /prefetch|prerender/i.test(
      `${request.headers.get('Purpose') ?? ''} ${request.headers.get('Sec-Purpose') ?? ''}`
    )
  )
    throw new HttpError(400, 'Prefetch cannot submit an action or work')
  if (
    new TextEncoder().encode(request.url).byteLength > MAX_SUBMISSION_URL_BYTES
  )
    throw new HttpError(
      414,
      'Submission URL exceeds 12 KiB. Use smaller multipart GET parts or POST.'
    )

  const url = new URL(request.url)
  const params = url.searchParams
  const intent = params.get('intent') ?? ''
  if (params.get('confirm') !== '1' || !Object.hasOwn(fields, intent))
    throw new HttpError(
      400,
      'An explicit submission intent and confirm=1 are required'
    )
  const key = params.get('key') ?? ''
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(key))
    throw new HttpError(
      400,
      'Supply a key of 8–100 letters, digits, underscores or hyphens; reuse it only for the same action or file transfer'
    )
  const allowed: readonly string[] = fields[intent as keyof typeof fields]
  for (const name of params.keys())
    if (!allowed.includes(name) || params.getAll(name).length !== 1)
      throw new HttpError(400, 'Unknown or repeated submission parameter')

  const headers = new Headers(request.headers)
  headers.delete('Content-Length')
  headers.set('Idempotency-Key', key)
  let body: string | Uint8Array<ArrayBuffer> | undefined
  let method = 'POST'
  let suffix: string
  let audience: string | null = null
  switch (intent) {
    case 'action': {
      const action = params.get('action')
      if (!action) throw new HttpError(400, 'Supply URL-encoded action JSON')
      body = action
      headers.set('Content-Type', 'application/json')
      suffix = '/actions'
      break
    }
    case 'upload': {
      const mime = params.get('mime') ?? ''
      if (
        !['image/jpeg', 'image/webp', 'image/png', 'text/plain'].includes(mime)
      )
        throw new HttpError(
          415,
          'Query uploads accept optimized JPEG or WebP, PNG, or UTF-8 text'
        )
      body = decodePart(params.get('data') ?? '')
      headers.set('Content-Type', mime)
      audience = params.get('audience') ?? 'public'
      suffix = '/artifacts'
      break
    }
    case 'upload-start':
      body = JSON.stringify({
        mime: params.get('mime'),
        bytes: Number(params.get('bytes')),
        sha256: params.get('sha256'),
        partBytes: Number(params.get('partBytes') ?? 4096),
        audience: params.get('audience') ?? 'public'
      })
      headers.set('Content-Type', 'application/json')
      suffix = `/uploads/${key}/start`
      break
    case 'upload-part': {
      const part = params.get('part') ?? ''
      if (!/^(0|[1-9][0-9]{0,3})$/.test(part))
        throw new HttpError(400, 'Supply a zero-based integer part index')
      body = decodePart(params.get('data') ?? '')
      method = 'PUT'
      headers.set('Content-Type', 'application/octet-stream')
      suffix = `/uploads/${key}/parts/${part}`
      break
    }
    case 'upload-complete':
      suffix = `/uploads/${key}/complete`
      break
    default:
      suffix = `/uploads/${key}`
      method = 'DELETE'
  }
  url.pathname = url.pathname.replace(/\/submit$/, suffix)
  url.search = ''
  if (audience !== null) url.searchParams.set('audience', audience)
  return new Request(url, { method, headers, body })
}
