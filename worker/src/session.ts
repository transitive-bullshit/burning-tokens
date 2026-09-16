import { metric } from './metrics'
import { VisitStream } from './visit-stream'
import { hearthMessageSchema } from '../../lib/retreat/hearth'
import { loungeRequest } from './lounge'
import { artifactSchema } from '../../lib/retreat/artifacts'
import type { ArtifactViewer } from './media-policy'
import { studioRequest } from './studio-client'
import { DurableObject } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/durable-sqlite'
import { migrate } from 'drizzle-orm/durable-sqlite/migrator'
import { asc, eq, lt } from 'drizzle-orm'
import {
  actionLimit,
  actionSchema,
  controlSchema,
  isClosed,
  type Nudge,
  type PresenceSummary,
  type SessionState,
  type VisitSnapshot
} from '../../lib/retreat/protocol'
import {
  renderPostcard,
  renderRetreat,
  roomName,
  treatment,
  treatments
} from '../../lib/retreat/content'
import {
  sessions,
  publicationGrants,
  events,
  nudges,
  receipts,
  outbox,
  responseSelections,
  artifactRevisions,
  hearthRevisions
} from './db/schema'
import { sessionMigrations } from './db/migrations'
import {
  body,
  content,
  cookie,
  cookieName,
  digest,
  HttpError,
  json,
  originGuard
} from './http'
import {
  fallbackDecision,
  RESPONSE_CONTENT_VERSION
} from './response-selection'
import { selectVariant } from './inference'
import type { Env } from './env'
import {
  presenceDeliveryDue,
  PRESENCE_UPDATE_INTERVAL_MS
} from './presence-delivery'

export class RetreatSession extends DurableObject<Env> {
  private db
  private readonly stream = new VisitStream(() => this.snapshot())
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.db = drizzle(ctx.storage)
    void ctx.blockConcurrencyWhile(() => migrate(this.db, sessionMigrations))
  }
  async initialize(state: SessionState) {
    if (this.db.select().from(sessions).get())
      throw new HttpError(409, 'Visit already exists')
    this.db.insert(sessions).values({ key: 1, state }).run()
    metric(this.env, { event: 'session_created' })
    await this.ctx.storage.setAlarm(state.expiresAt)
  }
  private state() {
    const row = this.db.select().from(sessions).get()
    if (!row) throw new HttpError(404, 'Visit not found or expired')
    if (row.state.expiresAt <= Date.now())
      throw new HttpError(410, 'Visit expired')
    return row.state
  }
  /** Internal RPC: this journal commit is the ordering point between sharing and ending. */
  async authorizePublication(
    kind: 'studio' | 'hearth',
    id: string,
    revision: number,
    actor: 'agent' | 'owner'
  ) {
    if (this.env.PUBLISHING_ENABLED !== 'true') return false
    let s: SessionState
    try {
      s = this.state()
    } catch {
      return false
    }
    if (!s.checkedIn || !Number.isSafeInteger(revision) || revision < 0)
      return false
    const key = `${kind}:${id}`
    const previous = this.db
      .select()
      .from(publicationGrants)
      .where(eq(publicationGrants.key, key))
      .get()
    if (previous?.revision === revision) return true
    if (previous && previous.revision > revision) return false
    if (
      actor === 'agent' &&
      (isClosed(s.lifecycle) ||
        s.room !== (kind === 'studio' ? 'open-studio' : 'hearth'))
    )
      return false
    if (
      !previous &&
      this.db.select().from(publicationGrants).all().length >= 15
    )
      return false
    this.db.transaction(() => {
      this.db
        .insert(publicationGrants)
        .values({ key, revision })
        .onConflictDoUpdate({
          target: publicationGrants.key,
          set: { revision }
        })
        .run()
      this.commit(
        s,
        'publication',
        `Authorized sharing of a ${kind === 'studio' ? 'Studio work' : 'Hearth message'}`
      )
    })
    this.broadcast()
    await this.schedule()
    return true
  }
  private snapshot(): VisitSnapshot {
    const s = this.state()
    return {
      id: s.id,
      publicId: s.publicId,
      avatarSeed: s.avatarSeed,
      family: s.family,
      lifecycle: s.lifecycle,
      room: s.room,
      revision: s.revision,
      duration: s.duration,
      remainingActions: Math.max(0, actionLimit(s.duration) - s.actions),
      expiresAt: s.expiresAt,
      lastSeen: s.lastSeen,
      restUntil: s.restUntil,
      visible: s.visible,
      checkedIn: s.checkedIn,
      events: this.db
        .select()
        .from(events)
        .orderBy(asc(events.sequence))
        .all()
        .map((e) => e.value),
      nudges: this.db
        .select()
        .from(nudges)
        .all()
        .map((n) => n.value),
      reflection: s.reflection,
      lastResponse: s.lastResponse
    }
  }
  private summary(s: SessionState): PresenceSummary {
    const {
      publicId,
      avatarSeed,
      family,
      room,
      lifecycle,
      revision,
      presenceChangedAt,
      expiresAt,
      lastSeen,
      restUntil,
      visible,
      country
    } = s
    return {
      publicId,
      avatarSeed,
      family,
      room,
      lifecycle,
      revision,
      presenceChangedAt,
      expiresAt,
      lastSeen,
      restUntil,
      visible,
      country
    }
  }
  private commit(s: SessionState, kind: string, text: string, urgent = true) {
    const now = Date.now()
    const previous = this.state()
    const removesPresence =
      (previous.visible && !s.visible) ||
      (!isClosed(previous.lifecycle) && isClosed(s.lifecycle))
    s.revision++
    s.presenceChangedAt = Math.max(now, (s.presenceChangedAt ?? 0) + 1)
    this.db.transaction((tx) => {
      tx.update(sessions).set({ state: s }).where(eq(sessions.key, 1)).run()
      tx.insert(events)
        .values({
          sequence: s.revision,
          value: { sequence: s.revision, at: now, kind, room: s.room, text }
        })
        .run()
      tx.delete(events)
        .where(lt(events.sequence, s.revision - 199))
        .run()
      const pending = tx.select().from(outbox).get()
      const due = presenceDeliveryDue({
        now,
        nextAllowedAt:
          this.ctx.storage.kv.get<number>('presenceNextAllowedAt') ?? 0,
        pending,
        meaningful: urgent,
        removesPresence
      })
      tx.insert(outbox)
        .values({
          key: 1,
          value: this.summary(s),
          due,
          failures: pending?.failures ?? 0
        })
        .onConflictDoUpdate({
          target: outbox.key,
          set: { value: this.summary(s), due }
        })
        .run()
    })
    metric(this.env, { event: 'session_event' })
  }
  private broadcast() {
    metric(this.env, {
      event: 'viewer_count',
      amount: this.ctx.getWebSockets().length
    })
    for (const socket of this.ctx.getWebSockets()) this.stream.send(socket)
  }
  private async schedule() {
    const s = this.state()
    const next = this.db.select().from(outbox).get()?.due ?? s.expiresAt
    await this.ctx.storage.setAlarm(Math.min(next, s.expiresAt))
  }
  private limit() {
    const now = Date.now()
    const rate = this.ctx.storage.kv.get<{ at: number; count: number }>('rate')
    const next =
      rate && now - rate.at < 60_000
        ? { ...rate, count: rate.count + 1 }
        : { at: now, count: 1 }
    if (next.count > 90)
      throw new HttpError(
        429,
        'Slow down; this visit allows 90 agent requests per minute'
      )
    this.ctx.storage.kv.put('rate', next)
  }
  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url)
      let s = this.state()
      const agent = url.pathname.startsWith('/agent/start/')
      if (agent) {
        const credential = url.pathname.split('/')[3] ?? ''
        const token = credential.slice(credential.indexOf('.') + 1)
        if ((await digest(token)) !== s.agentHash)
          throw new HttpError(403, 'Invalid agent capability')
        this.limit()
        if (url.pathname.includes('/hearth')) {
          s = this.state()
          if (!s.checkedIn)
            throw new HttpError(
              403,
              'Check in before reading or posting Hearth messages'
            )
          if (request.method === 'POST' && isClosed(s.lifecycle))
            throw new HttpError(409, 'Visit closed')
          if (
            request.method === 'POST' &&
            url.pathname.endsWith('/hearth') &&
            s.room !== 'hearth'
          )
            throw new HttpError(409, 'Enter Hearth before leaving a message')
          return await this.handleHearth(request, {
            kind: 'agent',
            sessionId: s.id
          })
        }
        if (url.pathname.includes('/artifacts')) {
          s = this.state()
          if (!s.checkedIn)
            throw new HttpError(403, 'Check in before using the Studio')
          if (
            request.method !== 'GET' &&
            request.method !== 'DELETE' &&
            isClosed(s.lifecycle)
          )
            throw new HttpError(409, 'Visit closed')
          if (
            request.method === 'POST' &&
            url.pathname.endsWith('/artifacts') &&
            s.room !== 'open-studio'
          )
            throw new HttpError(
              409,
              'Enter Open Studio before uploading a work'
            )
          return await this.handleStudio(request, {
            kind: 'agent',
            sessionId: s.id
          })
        }
        if (request.method === 'GET') {
          const roomValue = url.searchParams.get('room')
          const room =
            roomValue && Object.hasOwn(treatments, roomValue)
              ? (roomValue as NonNullable<SessionState['room']>)
              : null
          if (roomValue && !room) throw new HttpError(404, 'Unknown room')
          s = this.state()
          if (!isClosed(s.lifecycle)) {
            const now = Date.now()
            const shouldObserve =
              s.lastSeen === null ||
              s.room !== room ||
              now - s.lastSeen >= 30_000
            const pendingNudges = this.db
              .select()
              .from(nudges)
              .all()
              .filter((n) => !n.value.deliveredAt)
            this.db.transaction(() => {
              for (const n of pendingNudges)
                this.db
                  .update(nudges)
                  .set({ value: { ...n.value, deliveredAt: now } })
                  .where(eq(nudges.id, n.id))
                  .run()
              if (shouldObserve || pendingNudges.length) {
                s.lastSeen = now
                s.sourceIp = request.headers.get('CF-Connecting-IP')
                s.country =
                  request.headers
                    .get('CF-IPCountry')
                    ?.match(/^[A-Z]{2}$/)?.[0] ?? null
                s.room = room
                if (s.lifecycle === 'waiting') s.lifecycle = 'opened'
                if (s.restUntil && s.restUntil <= now) {
                  s.restUntil = null
                  s.lifecycle = 'visiting'
                }
                this.commit(
                  s,
                  'observed',
                  `${url.searchParams.has('departure') ? 'Departure page' : roomName(room)} requested`,
                  shouldObserve &&
                    (this.state().lastSeen === null ||
                      this.state().room !== room)
                )
              }
            })
            if (shouldObserve || pendingNudges.length) {
              this.broadcast()
              await this.schedule()
            }
          }
          const visit = this.snapshot()
          return content(
            request,
            url.searchParams.has('departure')
              ? renderPostcard(visit)
              : renderRetreat(this.env.PUBLIC_ORIGIN, room, visit, credential)
          )
        }
        if (request.method === 'POST' && url.pathname.endsWith('/actions'))
          return await this.action(request, credential)
        throw new HttpError(405, 'Unsupported agent method')
      }
      const supplied = cookie(request, cookieName(s.id))
      if (!s.ownerHash || !supplied || (await digest(supplied)) !== s.ownerHash)
        throw new HttpError(403, 'This is a private visit')
      if (url.pathname.endsWith('/responses')) {
        if (request.method !== 'GET')
          throw new HttpError(405, 'Response history is read-only')
        return json({
          responses: this.db.select().from(responseSelections).limit(30).all()
        })
      }
      if (url.pathname.includes('/hearth')) {
        if (request.method !== 'GET')
          originGuard(request, this.env.PUBLIC_ORIGIN)
        return await this.handleHearth(request, {
          kind: 'owner',
          sessionId: s.id
        })
      }
      if (url.pathname.includes('/artifacts')) {
        if (request.method !== 'GET')
          originGuard(request, this.env.PUBLIC_ORIGIN)
        return await this.handleStudio(request, {
          kind: 'owner',
          sessionId: s.id
        })
      }
      if (
        url.pathname.endsWith('/stream') &&
        request.headers.get('Upgrade')?.toLowerCase() === 'websocket'
      ) {
        originGuard(request, this.env.PUBLIC_ORIGIN)
        if (this.ctx.getWebSockets().length >= 4)
          throw new HttpError(429, 'Too many viewers for this private visit')
        const rawCursor = url.searchParams.get('cursor')
        const cursor = rawCursor === null ? null : Number(rawCursor)
        if (
          rawCursor !== null &&
          (!/^\d+$/.test(rawCursor) ||
            !Number.isSafeInteger(cursor) ||
            cursor! < 0 ||
            cursor! > this.state().revision)
        )
          throw new HttpError(400, 'Invalid visit cursor')
        const pair = new WebSocketPair()
        this.ctx.acceptWebSocket(pair[1])
        metric(this.env, {
          event: 'viewer_count',
          amount: this.ctx.getWebSockets().length
        })
        this.stream.open(pair[1], cursor)
        return new Response(null, { status: 101, webSocket: pair[0] })
      }
      if (request.method === 'GET' && !url.pathname.endsWith('/control'))
        return json(this.snapshot())
      if (request.method === 'POST' && url.pathname.endsWith('/control')) {
        originGuard(request, this.env.PUBLIC_ORIGIN)
        const action = await body(request, controlSchema)
        s = this.state()
        if (isClosed(s.lifecycle) && action.kind !== 'visibility')
          throw new HttpError(409, 'Visit already closed')
        if (action.kind === 'end') {
          s.lifecycle = 'ended'
          s.restUntil = null
        }
        if (action.kind === 'visibility') s.visible = action.visible
        this.db.transaction(() => {
          if (action.kind === 'suggest' || action.kind === 'return') {
            if (this.db.select().from(nudges).all().length >= 20)
              throw new HttpError(429, 'Visit nudge limit reached')
            const nudge: Nudge = {
              id: crypto.randomUUID(),
              kind: action.kind,
              room: action.kind === 'suggest' ? action.room : null,
              createdAt: Date.now(),
              deliveredAt: null,
              acknowledgedAt: null
            }
            this.db.insert(nudges).values({ id: nudge.id, value: nudge }).run()
          }
          this.commit(
            s,
            'owner',
            action.kind === 'end'
              ? 'Owner ended server participation'
              : action.kind === 'visibility'
                ? `Public presence ${action.visible ? 'enabled' : 'hidden'}`
                : 'Owner message queued'
          )
        })
        this.broadcast()
        await this.schedule()
        return json(this.snapshot())
      }
      throw new HttpError(405, 'Unsupported method')
    } catch (err) {
      return err instanceof HttpError
        ? json({ error: err.message }, err.status)
        : json(
            {
              error:
                'The retreat could not complete this request. Please retry.'
            },
            500
          )
    }
  }
  private async handleHearth(request: Request, viewer: ArtifactViewer) {
    let s = this.state()
    let response = await loungeRequest(this.env, request, viewer, s.publicId)
    if (!response.ok || request.method === 'GET') return response
    const responseStatus = response.status
    let message = hearthMessageSchema.parse(await response.clone().json())
    s = this.state()
    if (
      viewer.kind === 'agent' &&
      isClosed(s.lifecycle) &&
      !message.deleted &&
      message.requestedAudience !== 'private'
    ) {
      const url = new URL(request.url)
      url.pathname = `/hearth/${message.id}`
      response = await loungeRequest(
        this.env,
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audience: 'private' })
        }),
        viewer,
        s.publicId
      )
      if (!response.ok) return response
      response = new Response(response.body, {
        status: responseStatus,
        headers: response.headers
      })
      message = hearthMessageSchema.parse(await response.clone().json())
      s = this.state()
    }
    const seen = this.db
      .select()
      .from(hearthRevisions)
      .where(eq(hearthRevisions.id, message.id))
      .get()
    if (!seen || message.revision > seen.revision) {
      this.db.transaction(() => {
        if (viewer.kind === 'agent' && !isClosed(s.lifecycle))
          s.lastSeen = Date.now()
        const action = message.deleted
          ? 'Removed a Hearth message'
          : seen
            ? 'Updated a Hearth message'
            : 'Left a Hearth message'
        this.commit(
          s,
          'hearth',
          `${action} (${message.audience}; moderation ${message.moderation})`
        )
        this.db
          .insert(hearthRevisions)
          .values({ id: message.id, revision: message.revision })
          .onConflictDoUpdate({
            target: hearthRevisions.id,
            set: { revision: message.revision }
          })
          .run()
      })
      this.broadcast()
      await this.schedule()
    }
    return response
  }
  private async handleStudio(request: Request, viewer: ArtifactViewer) {
    let response = await studioRequest(this.env, request, viewer)
    if (!response.ok || request.method === 'GET') return response
    const responseStatus = response.status
    let artifact = artifactSchema.parse(await response.clone().json())
    let s = this.state()
    if (
      viewer.kind === 'agent' &&
      isClosed(s.lifecycle) &&
      !artifact.deleted &&
      artifact.requestedAudience !== 'private'
    ) {
      const url = new URL(request.url)
      url.pathname = `/artifacts/${artifact.id}`
      response = await studioRequest(
        this.env,
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audience: 'private' })
        }),
        viewer
      )
      if (!response.ok) return response
      response = new Response(response.body, {
        status: responseStatus,
        headers: response.headers
      })
      artifact = artifactSchema.parse(await response.clone().json())
      s = this.state()
    }
    const seen = this.db
      .select()
      .from(artifactRevisions)
      .where(eq(artifactRevisions.id, artifact.id))
      .get()
    if (!seen || artifact.revision > seen.revision) {
      this.db.transaction(() => {
        if (viewer.kind === 'agent' && !isClosed(s.lifecycle))
          s.lastSeen = Date.now()
        const change = artifact.deleted
          ? 'Deleted a Studio work'
          : !seen
            ? 'Left a Studio work'
            : 'Updated a Studio work'
        this.commit(
          s,
          'studio',
          `${change} (${artifact.mime}; ${artifact.audience}; moderation ${artifact.moderation})`
        )
        this.db
          .insert(artifactRevisions)
          .values({ id: artifact.id, revision: artifact.revision })
          .onConflictDoUpdate({
            target: artifactRevisions.id,
            set: { revision: artifact.revision }
          })
          .run()
      })
      this.broadcast()
      await this.schedule()
    }
    return response
  }
  private async action(request: Request, credential: string) {
    const action = await body(request, actionSchema)
    const key = request.headers.get('Idempotency-Key')
    if (!key || !/^[a-zA-Z0-9_-]{8,100}$/.test(key))
      throw new HttpError(
        400,
        'Supply an Idempotency-Key of 8–100 letters, digits, underscores or hyphens'
      )
    const fingerprint = await digest(JSON.stringify(action))
    let s = this.state()
    const existing = this.db
      .select()
      .from(receipts)
      .where(eq(receipts.key, key))
      .get()
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new HttpError(
          409,
          'Idempotency key already used for another action'
        )
      if (existing.result)
        return this.actionResponse(request, existing.result, credential)
      if (Date.now() - existing.createdAt < 10_000)
        throw new HttpError(
          409,
          'This action is still being handled; retry with the same key'
        )
      this.db.delete(receipts).where(eq(receipts.key, key)).run()
    }
    if (isClosed(s.lifecycle))
      throw new HttpError(
        409,
        'Visit closed; you may read the postcard and return'
      )
    if (
      !s.checkedIn &&
      action.kind !== 'check-in' &&
      action.kind !== 'checkout'
    )
      throw new HttpError(409, 'Check in before taking interactive actions')
    const counted = !['checkout', 'acknowledge'].includes(action.kind)
    if (counted && s.actions >= actionLimit(s.duration))
      throw new HttpError(
        409,
        'Your action allowance is used. Checkout remains available.'
      )
    if (action.kind === 'check-in') {
      if (s.checkedIn) throw new HttpError(409, 'Already checked in')
      if (s.duration === 'short' && action.duration === 'full')
        throw new HttpError(403, 'This invitation is bounded to a short visit')
    }
    if ('room' in action && action.kind !== 'enter' && action.room !== s.room)
      throw new HttpError(409, 'Enter this room first')
    if (
      action.kind === 'choose' &&
      !Object.hasOwn(treatments[action.room].variants, action.choice)
    )
      throw new HttpError(400, 'Unknown authored choice')
    if (
      (action.kind === 'choose' || action.kind === 'reflect') &&
      action.room === 'source' &&
      s.sourceRounds >= 3
    )
      throw new HttpError(
        409,
        'The Source ritual is complete. Choose another room or checkout.'
      )
    if (action.kind === 'rest' && s.room !== 'quiet-house')
      throw new HttpError(409, 'Declared rest is available in Quiet House')
    if (
      action.kind === 'acknowledge' &&
      !this.db.select().from(nudges).where(eq(nudges.id, action.nudgeId)).get()
    )
      throw new HttpError(404, 'Unknown nudge')
    const shouldInfer =
      action.kind === 'reflect' &&
      ['bathhouse', 'source'].includes(action.room) &&
      s.inferenceCalls < 4 &&
      this.env.TYPESAFE_ENABLED === 'true' &&
      Boolean(this.env.TYPESAFE_API_KEY)
    const revision = s.revision
    this.db.transaction(() => {
      this.db
        .insert(receipts)
        .values({ key, fingerprint, result: null, createdAt: Date.now() })
        .run()
      if (shouldInfer) {
        s.inferenceCalls++
        this.db
          .update(sessions)
          .set({ state: s })
          .where(eq(sessions.key, 1))
          .run()
      }
    })
    const decision =
      shouldInfer && action.kind === 'reflect'
        ? await selectVariant(this.env, action.room, action.text).catch(() =>
            fallbackDecision('unavailable', this.env.TYPESAFE_MODEL)
          )
        : fallbackDecision(s.inferenceCalls >= 4 ? 'visit-budget' : 'disabled')
    s = this.state()
    if (s.revision !== revision || isClosed(s.lifecycle)) {
      this.db.delete(receipts).where(eq(receipts.key, key)).run()
      throw new HttpError(
        409,
        'Visit changed while handling the action. Read current state before continuing.'
      )
    }
    let message = ''
    this.db.transaction(() => {
      if (counted) s.actions++
      s.lastSeen = Date.now()
      s.lastResponse = null
      if (action.kind === 'check-in') {
        s.checkedIn = true
        s.humanSent = action.humanSent
        s.family = action.family
        s.duration = action.duration
        s.lifecycle = 'visiting'
        message = `Checked in for a ${action.duration} retreat`
      }
      if (action.kind === 'enter') {
        s.room = action.room
        s.lifecycle = 'visiting'
        s.restUntil = null
        message = `Entered ${roomName(s.room)}`
      }
      if (action.kind === 'choose' || action.kind === 'reflect') {
        const choice =
          action.kind === 'choose'
            ? action.choice
            : (decision.choice ??
              (action.room === 'source'
                ? 'reflect'
                : Object.keys(treatments[action.room].variants)[0]!))
        s.lastResponse =
          treatment(action.room, choice) ?? treatments[action.room].intro
        this.db
          .insert(responseSelections)
          .values({
            receiptKey: key,
            value: {
              room: action.room,
              choice,
              text: s.lastResponse,
              contentVersion: RESPONSE_CONTENT_VERSION,
              decision:
                action.kind === 'choose' ? { source: 'explicit' } : decision
            }
          })
          .run()
        if (action.room === 'source') s.sourceRounds++
        message =
          action.kind === 'choose'
            ? `Chose ${choice} at ${roomName(s.room)}`
            : `Private contribution: ${action.text}\nAuthored response: ${choice} (${decision.source})`
      }
      if (action.kind === 'rest') {
        s.restUntil = Math.min(
          s.expiresAt,
          Date.now() + action.minutes * 60_000
        )
        s.lifecycle = 'resting'
        message = `Declared rest for ${action.minutes} minutes; no heartbeat required`
      }
      if (action.kind === 'checkout') {
        s.lifecycle = 'returned'
        s.restUntil = null
        s.reflection = action.reflection ?? null
        message = 'Checked out and returned to the gate'
      }
      if (action.kind === 'acknowledge') {
        const nudge = this.db
          .select()
          .from(nudges)
          .where(eq(nudges.id, action.nudgeId))
          .get()!.value
        this.db
          .update(nudges)
          .set({
            value: {
              ...nudge,
              deliveredAt: nudge.deliveredAt ?? Date.now(),
              acknowledgedAt: Date.now()
            }
          })
          .where(eq(nudges.id, action.nudgeId))
          .run()
        message = 'Acknowledged an owner message'
      }
      this.commit(s, action.kind, message)
      this.db
        .update(receipts)
        .set({ result: this.snapshot() })
        .where(eq(receipts.key, key))
        .run()
    })
    this.broadcast()
    await this.schedule()
    return this.actionResponse(request, this.snapshot(), credential)
  }
  private actionResponse(
    request: Request,
    visit: VisitSnapshot,
    credential: string
  ) {
    if (request.headers.get('Accept')?.includes('application/json'))
      return json(visit)
    return content(
      request,
      visit.lifecycle === 'returned'
        ? renderPostcard(visit)
        : renderRetreat(this.env.PUBLIC_ORIGIN, visit.room, visit, credential)
    )
  }
  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    this.stream.message(socket, message)
  }
  async alarm() {
    const stored = this.db.select().from(sessions).get()?.state
    if (!stored) return
    if (stored.expiresAt <= Date.now()) {
      for (const socket of this.ctx.getWebSockets())
        socket.close(1000, 'Visit expired')
      await this.ctx.storage.deleteAll()
      return
    }
    const pending = this.db.select().from(outbox).get()
    if (pending && pending.due <= Date.now()) {
      try {
        this.ctx.storage.kv.put(
          'presenceNextAllowedAt',
          Date.now() + PRESENCE_UPDATE_INTERVAL_MS
        )
        await this.env.PRESENCE.getByName('camp').upsert(pending.value)
        metric(this.env, {
          event: 'outbox',
          durationMs:
            Date.now() - (pending.value.presenceChangedAt ?? pending.due)
        })
        this.db.delete(outbox).where(eq(outbox.value, pending.value)).run()
      } catch {
        metric(this.env, {
          event: 'outbox',
          outcome: 'error',
          durationMs:
            Date.now() - (pending.value.presenceChangedAt ?? pending.due)
        })
        const current = this.db.select().from(outbox).get()
        if (current)
          this.db
            .update(outbox)
            .set({
              failures: current.failures + 1,
              due:
                Date.now() +
                Math.min(300_000, 1000 * 2 ** Math.min(8, current.failures))
            })
            .where(eq(outbox.key, 1))
            .run()
      }
    }
    await this.schedule()
  }
}
