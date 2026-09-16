import { z } from 'zod'
import type { Env } from './env'
import {
  body,
  cookie,
  digest,
  HttpError,
  json,
  originGuard,
  randomToken
} from './http'

const name = 'bt_admin'
const lifetime = 30 * 60 * 1000
const encoder = new TextEncoder()
async function signingKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}
export async function adminCookie(
  secret: string,
  origin: string,
  now = Date.now()
) {
  const payload = `${now + lifetime}.${randomToken()}`
  const signature = await crypto.subtle.sign(
    'HMAC',
    await signingKey(secret),
    encoder.encode(`${origin}:${payload}`)
  )
  const hex = Array.from(new Uint8Array(signature), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('')
  return `${payload}.${hex}`
}
export async function validAdminCookie(
  value: string,
  secret: string,
  origin: string,
  now = Date.now()
) {
  const match = /^(\d{13})\.([a-f0-9]{64})\.([a-f0-9]{64})$/.exec(value)
  if (!match) return false
  const expires = Number(match[1])
  if (expires <= now || expires > now + lifetime) return false
  const signature = Uint8Array.from(match[3]!.match(/../g)!, (hex) =>
    Number.parseInt(hex, 16)
  )
  return crypto.subtle.verify(
    'HMAC',
    await signingKey(secret),
    signature,
    encoder.encode(`${origin}:${match[1]}.${match[2]}`)
  )
}
export async function adminAuthorized(request: Request, env: Env) {
  if (!env.STUDIO_ADMIN_KEY) return false
  const bearer = request.headers.get('Authorization')
  if (
    bearer?.startsWith('Bearer ') &&
    (await digest(bearer.slice(7))) === (await digest(env.STUDIO_ADMIN_KEY))
  )
    return true
  return validAdminCookie(
    cookie(request, name),
    env.STUDIO_ADMIN_KEY,
    new URL(env.PUBLIC_ORIGIN).origin
  )
}
export async function adminSession(request: Request, env: Env) {
  const origin = new URL(env.PUBLIC_ORIGIN).origin
  const attributes = `HttpOnly; SameSite=Strict; Path=/api/retreat/admin${origin.startsWith('https:') ? '; Secure' : ''}`
  if (request.method === 'GET') {
    if (!(await adminAuthorized(request, env)))
      throw new HttpError(403, 'Administrator authorization required')
    return json({ authenticated: true })
  }
  originGuard(request, origin)
  if (request.method === 'DELETE')
    return json({ authenticated: false }, 200, {
      'Set-Cookie': `${name}=; Max-Age=0; ${attributes}`
    })
  if (request.method !== 'POST')
    throw new HttpError(405, 'Unsupported administrator action')
  if (!env.STUDIO_ADMIN_KEY)
    throw new HttpError(503, 'Administrator access is not configured')
  const network = await digest(
    request.headers.get('CF-Connecting-IP') ?? 'local-unknown'
  )
  if (!(await env.BUDGET.getByName(`admin-admission:${network}`).admit()))
    throw new HttpError(429, 'Too many sign-in attempts. Try again later.')
  const input = await body(
    request,
    z.object({ key: z.string().min(1).max(512) }).strict()
  )
  if ((await digest(input.key)) !== (await digest(env.STUDIO_ADMIN_KEY)))
    throw new HttpError(403, 'Administrator authorization required')
  const value = await adminCookie(env.STUDIO_ADMIN_KEY, origin)
  return json({ authenticated: true, expiresIn: lifetime / 1000 }, 200, {
    'Set-Cookie': `${name}=${value}; Max-Age=${lifetime / 1000}; ${attributes}`
  })
}
