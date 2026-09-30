import { getPageMetadata, renderMetadata } from '../../lib/site-metadata'
import type { ZodType } from 'zod'
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public headers?: HeadersInit
  ) {
    super(message)
  }
}
export const privateHeaders = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff'
}
export function json(value: unknown, status = 200, headers?: HeadersInit) {
  const merged = new Headers(privateHeaders)
  for (const [name, value] of new Headers(headers)) merged.set(name, value)
  return Response.json(value, { status, headers: merged })
}
export async function body<T>(
  request: Request,
  schema: ZodType<T>
): Promise<T> {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new HttpError(415, 'Use application/json')
  const reader = request.body?.getReader()
  if (!reader) throw new HttpError(400, 'A JSON body is required')
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > 8192) {
      await reader.cancel()
      throw new HttpError(413, 'Request too large')
    }
    chunks.push(value)
  }
  const combined = new Uint8Array(size)
  let at = 0
  for (const chunk of chunks) {
    combined.set(chunk, at)
    at += chunk.length
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(combined))
  } catch {
    throw new HttpError(400, 'Invalid JSON')
  }
  const result = schema.safeParse(parsed)
  if (!result.success) throw new HttpError(400, 'Invalid request fields')
  return result.data
}
const isLocalHostname = (hostname: string) =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '::1' ||
  hostname.endsWith('.localhost')

/** Keep production canonical URLs fixed while following Vite/Portless locally. */
export function requestOrigin(request: Request, configured: string) {
  const canonical = new URL(configured)
  const incoming = new URL(request.url)
  return isLocalHostname(canonical.hostname) &&
    isLocalHostname(incoming.hostname)
    ? incoming.origin
    : canonical.origin
}
export function originGuard(request: Request, allowed: string) {
  if (request.headers.get('Origin') !== requestOrigin(request, allowed))
    throw new HttpError(403, 'This action requires the retreat website origin')
}
export function cookieName(id: string) {
  return `bt_owner_${id}`
}
export function cookie(request: Request, name: string) {
  return (
    request.headers
      .get('Cookie')
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? ''
  )
}
export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('')
}
export async function digest(value: string) {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  )
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('')
}
export function content(
  request: Request,
  markdown: string,
  headers: HeadersInit = {}
) {
  const html =
    request.headers.get('Accept')?.includes('text/html') ||
    new URL(request.url).searchParams.get('format') === 'html'
  const escape = (v: string) =>
    v
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
  const rendered = html
    ? `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Agent retreat · Burning Tokens</title>${renderMetadata(getPageMetadata(new URL(request.url).pathname, new URL(request.url).origin))}</head><body><main>${markdown
        .split('\n')
        .map((line) => {
          if (line.startsWith('# ')) return `<h1>${escape(line.slice(2))}</h1>`
          if (line.startsWith('## ')) return `<h2>${escape(line.slice(3))}</h2>`
          const link = /^- \[([^\]]+)\]\((https?:\/\/[^\s)]+)\)(.*)$/.exec(line)
          if (link)
            return `<p><a href="${escape(link[2]!)}">${escape(link[1]!)}</a>${escape(link[3]!)}</p>`
          return `<p>${escape(line)}</p>`
        })
        .join('')}</main></body></html>`
    : markdown
  return new Response(rendered, {
    headers: {
      ...privateHeaders,
      'Content-Type': html
        ? 'text/html; charset=utf-8'
        : 'text/markdown; charset=utf-8',
      'Content-Security-Policy':
        "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      ...Object.fromEntries(new Headers(headers))
    }
  })
}
