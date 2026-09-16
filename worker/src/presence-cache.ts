import { roomSchema, type RetreatRoom } from '../../lib/retreat/protocol'
import type { RetreatPresence } from './presence'
import { HttpError, json } from './http'

export const PRESENCE_CACHE_SECONDS = 15
const storedAtHeader = 'X-Retreat-Cached-At'
type Snapshot = ReturnType<RetreatPresence['snapshot']>
type EdgeCache = Pick<Cache, 'match' | 'put'>

/** Exactly eight keys per deployment origin, with no visitor headers or credentials. */
export function presenceCacheKey(origin: string, room?: RetreatRoom) {
  if (room !== undefined && !roomSchema.safeParse(room).success)
    throw new HttpError(400, 'Unknown room')
  const url = new URL('/__retreat-cache/presence-v1', origin)
  if (room) url.searchParams.set('room', room)
  return new Request(url, { method: 'GET' })
}

export async function cachedPresence({
  origin,
  room,
  cache,
  waitUntil,
  load,
  now = Date.now
}: {
  origin: string
  room?: RetreatRoom
  cache: EdgeCache
  waitUntil: (promise: Promise<unknown>) => void
  load: () => Promise<Snapshot>
  now?: () => number
}): Promise<Response> {
  const key = presenceCacheKey(origin, room)
  let cacheAvailable = true
  try {
    const hit = await cache.match(key)
    if (hit?.status === 200) {
      const stamp = Number(hit.headers.get(storedAtHeader) ?? NaN)
      const age = now() - stamp
      if (
        Number.isFinite(stamp) &&
        age >= 0 &&
        age < PRESENCE_CACHE_SECONDS * 1000
      )
        return clientResponse(hit, 'HIT', age)
    }
  } catch {
    cacheAvailable = false
  }
  // Never return an expired crowd on failure: hidden/ended visitors must age out.
  const snapshot = await load()
  const response = json(snapshot, 200, {
    'Cache-Control': `public, max-age=${PRESENCE_CACHE_SECONDS}`,
    [storedAtHeader]: String(snapshot.generatedAt)
  })
  if (cacheAvailable)
    waitUntil(cache.put(key, response.clone()).catch(() => undefined))
  return clientResponse(
    response,
    cacheAvailable ? 'MISS' : 'BYPASS',
    Math.max(0, now() - snapshot.generatedAt)
  )
}

function clientResponse(response: Response, status: string, age: number) {
  const headers = new Headers(response.headers)
  headers.delete(storedAtHeader)
  // Keep the shared cache inside the Worker; browser/proxy caches must not extend
  // the removal window or serve a private watch page's old crowd indefinitely.
  headers.set('Cache-Control', 'no-store')
  headers.set('X-Retreat-Cache', status)
  headers.set('X-Retreat-Snapshot-Age', String(Math.floor(age / 1000)))
  return new Response(response.body, { status: response.status, headers })
}
