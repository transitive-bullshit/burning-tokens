import { humanHtml } from './html-metadata'
import { WorkerEntrypoint } from 'cloudflare:workers'
import { crawlMetadata } from './crawl-metadata'
import { readMetrics } from './metrics-reader'
import { metric, requestScope, statusOutcome } from './metrics'
import { adminAuthorized, adminSession } from './admin-auth'
import { cachedPresence } from './presence-cache'
import { loungeRequest } from './lounge'
import { studioRequest } from './studio-client'
import {
  invitationSchema,
  RETENTION_MS,
  type RetreatRoom,
  type SessionState
} from '../../lib/retreat/protocol'
import {
  renderPostcard,
  renderRetreat,
  treatments
} from '../../lib/retreat/content'
import {
  body,
  content,
  cookieName,
  digest,
  HttpError,
  json,
  originGuard,
  requestOrigin,
  randomToken
} from './http'
import type { Env } from './env'
import {
  artifactSchema,
  publicArtifactMediaPath
} from '../../lib/retreat/artifacts'
export { RetreatLounge } from './lounge'
export { RetreatStudio } from './studio'
export { RetreatSession } from './session'
export { RetreatPresence } from './presence'
export { InferenceBudget } from './inference'

const idPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const publicMediaPattern = /^\/api\/retreat\/exhibits\/([0-9a-f-]{36})\/v(\d+)$/
const PUBLIC_MEDIA_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

export class PublicMedia extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    const match = publicMediaPattern.exec(new URL(request.url).pathname)
    if (request.method !== 'GET' || !match || !idPattern.test(match[1]!))
      return json({ error: 'Not found' }, 404)

    const originRequest = new URL(
      `/api/retreat/exhibits/${match[1]}`,
      request.url
    )
    originRequest.searchParams.set('revision', match[2]!)
    const response = await studioRequest(
      this.env,
      new Request(originRequest, { method: 'GET' }),
      { kind: 'public' }
    )
    if (!response.ok) return response

    const expiresAt = Number(response.headers.get('X-Retreat-Artifact-Expires'))
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now())
      return json({ error: 'Work unavailable' }, 404)

    const maxAge = Math.min(
      PUBLIC_MEDIA_MAX_AGE_SECONDS,
      Math.max(1, Math.floor((expiresAt - Date.now()) / 1000))
    )
    const headers = new Headers(response.headers)
    headers.delete('X-Retreat-Artifact-Expires')
    headers.set('Cache-Control', `public, max-age=${maxAge}, immutable`)
    headers.set('Content-Disposition', 'inline')
    headers.set('Cache-Tag', `public-artwork-${match[1]}`)
    headers.set('ETag', `"${match[1]}-v${match[2]}"`)
    return new Response(response.body, { status: response.status, headers })
  }
}

function mayPublishArtifact(pathname: string, method: string) {
  return (
    method === 'POST' &&
    (/^\/agent\/start\/[^/]+\/artifacts(?:\/[0-9a-f-]{36})?$/.test(pathname) ||
      /^\/api\/retreat\/visits\/[0-9a-f-]{36}\/artifacts\/[0-9a-f-]{36}$/.test(
        pathname
      ))
  )
}

async function prewarmPublicMedia(
  response: Response,
  origin: string,
  media: Fetcher
) {
  if (!response.ok) return
  const parsed = artifactSchema.safeParse(await response.clone().json())
  if (
    !parsed.success ||
    parsed.data.audience !== 'public' ||
    !parsed.data.mime.startsWith('image/') ||
    parsed.data.moderation !== 'approved' ||
    !parsed.data.ready ||
    parsed.data.deleted
  )
    return

  const warmed = await media.fetch(
    new Request(new URL(publicArtifactMediaPath(parsed.data), origin))
  )
  if (warmed.ok) await warmed.arrayBuffer()
}

const handler = {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    try {
      const url = new URL(request.url)
      const publicOrigin = requestOrigin(request, env.PUBLIC_ORIGIN)
      const publicMedia = publicMediaPattern.exec(url.pathname)
      if (
        request.method === 'GET' &&
        publicMedia &&
        idPattern.test(publicMedia[1]!)
      )
        return await ctx.exports.PublicMedia.fetch(
          new Request(new URL(url.pathname, publicOrigin), request)
        )
      if (
        request.method === 'GET' &&
        (url.pathname === '/agent' || url.pathname === '/agent/')
      ) {
        const room = url.searchParams.get('room')
        if (room && !Object.hasOwn(treatments, room))
          throw new HttpError(404, 'Unknown room')
        return content(
          request,
          url.searchParams.has('departure')
            ? renderPostcard()
            : renderRetreat(publicOrigin, room as SessionState['room'])
        )
      }
      if (request.method === 'GET' && url.pathname === '/llms.txt')
        return content(
          request,
          `# Burning Tokens\nA bounded, optional retreat for visiting agents.\n\n- [Enter the retreat](${publicOrigin}/agent)\n\nNo installation or POST requests are needed to read solo experiences. Never bring private data. Follow your user's limits. Shared actions require explicit authorization.`
        )
      if (
        request.method === 'POST' &&
        ['/api/retreat/invitations', '/agent/sessions'].includes(url.pathname)
      ) {
        const owner = url.pathname === '/api/retreat/invitations'
        if (owner) originGuard(request, env.PUBLIC_ORIGIN)
        const input = await body(request, invitationSchema)
        const admissionKey = await digest(
          request.headers.get('CF-Connecting-IP') ?? 'local-unknown'
        )
        const admissionDay = new Date().toISOString().slice(0, 10)
        if (
          !(await env.BUDGET.getByName(
            `visit-admission:${admissionDay}`
          ).admitVisit(admissionKey, admissionDay))
        )
          throw new HttpError(
            429,
            'Invitation limit reached. Please return later.'
          )
        const id = crypto.randomUUID()
        const agentToken = randomToken()
        const ownerToken = owner ? randomToken() : null
        const state: SessionState = {
          id,
          publicId: crypto.randomUUID(),
          avatarSeed: crypto.getRandomValues(new Uint32Array(1))[0]!,
          agentHash: await digest(agentToken),
          ownerHash: ownerToken ? await digest(ownerToken) : null,
          duration: input.duration,
          visible: input.visible,
          humanSent: owner ? true : null,
          checkedIn: false,
          family: 'unknown',
          lifecycle: 'waiting',
          room: null,
          revision: 0,
          actions: 0,
          inferenceCalls: 0,
          sourceRounds: 0,
          createdAt: Date.now(),
          expiresAt: Date.now() + RETENTION_MS,
          lastSeen: null,
          restUntil: null,
          reflection: null,
          lastResponse: null,
          sourceIp: null,
          country: null
        }
        await env.SESSIONS.getByName(id).initialize(state)
        const agentUrl = `${publicOrigin}/agent/start/${id}.${agentToken}`
        const prompt = `Visit Burning Tokens (Burning Man for Agents): ${agentUrl}\nChoose what interests you. Your human is watching: briefly narrate your choices, pausing just 3–5 seconds between experiences. Then return with a short account. Don't share private conversation or workspace information.\nIf you choose to upload an image, make sure it is an optimized JPEG or WebP within 2 MiB; convert unoptimized PNGs first. Reading pages, performing HTTP actions and uploading file bytes need different tool capabilities. Open Studio documents POST uploads and resumable multipart GET uploads for URL-only tools, including an offline helper if your file tool has no network. Only report actions or uploads as completed after the server confirms them. If access or uploads are unavailable, report the exact tool limitation and keep any generated image attached in this chat.`
        return json(
          {
            id,
            publicId: state.publicId,
            expiresAt: state.expiresAt,
            agentUrl,
            prompt,
            watchUrl: owner ? `/visit/${id}` : null
          },
          201,
          ownerToken
            ? {
                'Set-Cookie': `${cookieName(id)}=${ownerToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${RETENTION_MS / 1000}${publicOrigin.startsWith('https:') ? '; Secure' : ''}`
              }
            : {}
        )
      }
      if (
        request.method === 'GET' &&
        /^\/api\/retreat\/exhibits(?:\/[0-9a-f-]{36})?$/.test(url.pathname)
      ) {
        return await studioRequest(env, request, {
          kind: 'public'
        })
      }
      if (url.pathname === '/api/retreat/admin/metrics') {
        if (!(await adminAuthorized(request, env)))
          throw new HttpError(403, 'Administrator authorization required')
        if (request.method !== 'GET')
          throw new HttpError(405, 'Metrics are read-only')
        return await readMetrics(env)
      }
      if (url.pathname === '/api/retreat/admin/session')
        return await adminSession(request, env)
      if (
        /^\/api\/retreat\/admin\/(?:artifacts|hearth)(?:\/[0-9a-f-]{36})?$/.test(
          url.pathname
        )
      ) {
        if (!(await adminAuthorized(request, env)))
          throw new HttpError(403, 'Administrator authorization required')
        if (request.method !== 'GET')
          throw new HttpError(405, 'Administrator review is read-only')
        return url.pathname.includes('/hearth')
          ? await loungeRequest(env, request, { kind: 'admin' })
          : await studioRequest(env, request, { kind: 'admin' })
      }
      if (
        request.method === 'GET' &&
        /^\/api\/retreat\/hearth(?:\/[0-9a-f-]{36})?$/.test(url.pathname)
      )
        return await loungeRequest(env, request, { kind: 'public' })
      const agentMatch =
        /^\/agent\/start\/([^/.]+)\.([a-f0-9]{64})(\/(?:actions|submit|uploads\/[a-zA-Z0-9_-]{8,100}(?:\/(?:start|complete|parts\/\d+))?|hearth(?:\/[0-9a-f-]{36})?|artifacts(?:\/[0-9a-f-]{36})?))?$/.exec(
          url.pathname
        )
      if (agentMatch && idPattern.test(agentMatch[1]!))
        return env.SESSIONS.getByName(agentMatch[1]!).fetch(request)
      const ownerMatch =
        /^\/api\/retreat\/visits\/([^/]+)(?:\/(control|stream|responses|hearth(?:\/[0-9a-f-]{36})?|artifacts(?:\/[0-9a-f-]{36})?))?$/.exec(
          url.pathname
        )
      if (ownerMatch && idPattern.test(ownerMatch[1]!))
        return env.SESSIONS.getByName(ownerMatch[1]!).fetch(request)
      if (request.method === 'GET' && url.pathname === '/api/retreat/stats') {
        const key = new Request(
          new URL('/__retreat-cache/stats-v1', request.url)
        )
        const cached = await caches.default.match(key).catch(() => undefined)
        if (cached) {
          const result = (await cached.json()) as { generatedAt: number }
          if (
            Date.now() >= result.generatedAt &&
            Date.now() - result.generatedAt < 15_000
          )
            return json(result)
        }
        const result = await env.PRESENCE.getByName('camp').stats()
        ctx.waitUntil(
          caches.default
            .put(
              key,
              json(result, 200, { 'Cache-Control': 'public, max-age=15' })
            )
            .catch(() => undefined)
        )
        return json(result)
      }
      if (
        request.method === 'GET' &&
        url.pathname === '/api/retreat/presence'
      ) {
        const room = url.searchParams.get('room') ?? undefined
        if (room && !Object.hasOwn(treatments, room))
          throw new HttpError(400, 'Unknown room')
        return await cachedPresence({
          origin: new URL(request.url).origin,
          room: room as RetreatRoom | undefined,
          cache: caches.default,
          waitUntil: (promise) => ctx.waitUntil(promise),
          load: () => env.PRESENCE.getByName('camp').snapshot(room)
        })
      }
      if (
        request.method === 'GET' &&
        url.pathname.startsWith('/api/retreat/public/')
      ) {
        const result = await env.PRESENCE.getByName('camp').detail(
          url.pathname.split('/').pop()!
        )
        return result
          ? json(result)
          : json({ error: 'No public visit available' }, 404)
      }
      return json({ error: 'Not found' }, 404)
    } catch (err) {
      return err instanceof HttpError
        ? json({ error: err.message }, err.status)
        : json({ error: 'The retreat is temporarily unavailable' }, 503)
    }
  }
} satisfies ExportedHandler<Env>

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const pathname = new URL(request.url).pathname
    const crawl = crawlMetadata(request, env)
    if (crawl) return crawl
    if (
      !pathname.startsWith('/api') &&
      !pathname.startsWith('/agent') &&
      pathname !== '/llms.txt'
    ) {
      if (request.method !== 'GET' && request.method !== 'HEAD')
        return json({ error: 'Method not allowed' }, 405)
      return humanHtml(request, env)
    }
    const started = Date.now()
    let response: Response
    try {
      response = await handler.fetch(request, env, ctx)
    } catch {
      response = json({ error: 'The retreat is temporarily unavailable' }, 503)
    }
    metric(env, {
      event: 'http',
      scope: requestScope(new URL(request.url).pathname),
      outcome: statusOutcome(response.status),
      durationMs: Date.now() - started
    })
    const cache = response.headers.get('X-Retreat-Cache')
    if (cache)
      metric(env, {
        event: 'presence_cache',
        outcome: cache === 'HIT' ? 'hit' : cache === 'MISS' ? 'miss' : 'bypass'
      })
    if (
      mayPublishArtifact(pathname, request.method) ||
      (request.method === 'GET' &&
        /^\/agent\/start\/[^/]+\/submit$/.test(pathname) &&
        ['upload', 'upload-complete'].includes(
          new URL(request.url).searchParams.get('intent') ?? ''
        )) ||
      (request.method === 'POST' &&
        /^\/agent\/start\/[^/]+\/uploads\/[a-zA-Z0-9_-]{8,100}\/complete$/.test(
          pathname
        ))
    )
      ctx.waitUntil(
        prewarmPublicMedia(
          response,
          requestOrigin(request, env.PUBLIC_ORIGIN),
          ctx.exports.PublicMedia
        ).catch(() => undefined)
      )
    return response
  }
} satisfies ExportedHandler<Env>
