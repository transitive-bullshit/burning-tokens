import { authorizeSharing } from './publication'
import { DurableObject } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/durable-sqlite'
import { migrate } from 'drizzle-orm/durable-sqlite/migrator'
import { and, asc, eq, gt, lt, sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { Env } from './env'
import { z } from 'zod'
import { body, digest, json, HttpError, privateHeaders } from './http'
import { moderateMedia, type ModerationResult } from './moderation'
import {
  ARTIFACT_RETENTION_MS,
  SESSION_ARTIFACT_BYTES,
  SESSION_ARTIFACT_LIMIT,
  canReadArtifact,
  effectiveAudience,
  validateMedia,
  readMediaBody,
  audiences,
  type ArtifactAccess,
  type ArtifactAudience,
  type ArtifactViewer,
  type MediaType
} from './media-policy'

type Work = ArtifactAccess & {
  revision?: number
  id: string
  key: string
  mime: MediaType
  bytes: number
  createdAt: number
  requestedAudience: ArtifactAudience
  judgment: ModerationResult | null
  fingerprint: string
  uploadKey: string
  uploadAttempt?: { id: string; count: number; expiresAt: number }
}
const works = sqliteTable(
  'works',
  {
    id: text('id').primaryKey(),
    authorId: text('author_id').notNull(),
    uploadKey: text('upload_key').notNull().unique(),
    expiresAt: integer('expires_at').notNull(),
    value: text('value', { mode: 'json' }).$type<Work>().notNull()
  },
  (t) => [
    index('works_author').on(t.authorId),
    index('works_expiry').on(t.expiresAt)
  ]
)
const migrations = {
  journal: {
    entries: [
      { idx: 0, when: 1789516800000, tag: 'studio_v1', breakpoints: true }
    ]
  },
  migrations: {
    m0000: `CREATE TABLE works (id TEXT PRIMARY KEY, author_id TEXT NOT NULL, upload_key TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, value TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX works_author ON works(author_id);
--> statement-breakpoint
CREATE INDEX works_expiry ON works(expires_at);`
  }
}
/** Bounded media metadata has its own lifetime; session journals still expire at seven days. */
export class RetreatStudio extends DurableObject<Env> {
  private db
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.db = drizzle(ctx.storage)
    void ctx.blockConcurrencyWhile(() => migrate(this.db, migrations))
  }
  async fetch(request: Request): Promise<Response> {
    const viewerSchema = z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('public') }).strict(),
      z.object({ kind: z.literal('admin') }).strict(),
      z
        .object({ kind: z.literal('agent'), sessionId: z.string().uuid() })
        .strict(),
      z
        .object({ kind: z.literal('owner'), sessionId: z.string().uuid() })
        .strict()
    ])
    let raw: unknown
    try {
      raw = JSON.parse(request.headers.get('X-Retreat-Viewer') ?? '')
    } catch {
      return json({ error: 'Internal authorization required' }, 403)
    }
    const viewer = viewerSchema.safeParse(raw)
    if (!viewer.success)
      return json({ error: 'Internal authorization required' }, 403)
    return this.access(request, viewer.data)
  }
  async access(request: Request, viewer: ArtifactViewer): Promise<Response> {
    try {
      const url = new URL(request.url)
      const id = url.pathname.split('/').pop() ?? ''
      const item = /^[0-9a-f-]{36}$/.test(id)
      if (request.method === 'GET') {
        if (item) return await this.read(id, viewer)
        const ownOnly =
          url.searchParams.get('scope') !== 'gallery' &&
          (viewer.kind === 'agent' || viewer.kind === 'owner')
        return json(
          this.list(viewer, ownOnly, url.searchParams.get('after') ?? '')
        )
      }
      if (viewer.kind !== 'agent' && viewer.kind !== 'owner')
        throw new HttpError(403, 'An author capability is required')
      if (item && request.method === 'DELETE')
        return json(await this.change(id, viewer.sessionId, 'delete'))
      if (item && request.method === 'POST') {
        const input = await body(
          request,
          z.object({ audience: z.enum(audiences) }).strict()
        )
        return json(
          await this.change(id, viewer.sessionId, input.audience, viewer.kind)
        )
      }
      if (!item && request.method === 'POST' && viewer.kind === 'agent') {
        const key = request.headers.get('Idempotency-Key') ?? ''
        if (!/^[a-zA-Z0-9_-]{8,100}$/.test(key))
          throw new HttpError(
            400,
            'Supply an Idempotency-Key of 8–100 letters, digits, underscores or hyphens'
          )
        const audience = z
          .enum(audiences)
          .safeParse(url.searchParams.get('audience') ?? 'agents')
        if (!audience.success)
          throw new HttpError(
            400,
            'Choose private, agents or public as the audience'
          )
        let media
        try {
          media = await readMediaBody(request)
        } catch {
          throw new HttpError(
            415,
            'Use a supported file with a matching signature, at most 2 MiB (8,000 bytes for text)'
          )
        }
        const hash = Array.from(
          new Uint8Array(await crypto.subtle.digest('SHA-256', media.bytes))
        )
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('')
        const fingerprint = await digest(
          JSON.stringify({ hash, mime: media.mime, audience: audience.data })
        )
        return json(
          await this.upload(
            viewer.sessionId,
            media.bytes,
            media.mime,
            audience.data,
            key,
            fingerprint
          ),
          201
        )
      }
      throw new HttpError(405, 'Unsupported Studio request')
    } catch (err) {
      return err instanceof HttpError
        ? json({ error: err.message }, err.status)
        : json({ error: 'Studio temporarily unavailable' }, 503)
    }
  }
  private find(id: string) {
    return this.db.select().from(works).where(eq(works.id, id)).get()?.value
  }
  private save(work: Work) {
    work.revision = (work.revision ?? 0) + 1
    this.db
      .update(works)
      .set({ value: work })
      .where(eq(works.id, work.id))
      .run()
  }
  private projection(work: Work) {
    return {
      id: work.id,
      revision: work.revision ?? 0,
      mime: work.mime,
      bytes: work.bytes,
      createdAt: work.createdAt,
      expiresAt: work.expiresAt,
      audience:
        this.env.PUBLISHING_ENABLED === 'true' && work.publicationAuthorized
          ? work.audience
          : 'private',
      requestedAudience: work.requestedAudience,
      moderation: work.moderation,
      ready: work.ready,
      deleted: work.deleted,
      notice:
        work.moderation === 'approved'
          ? this.env.PUBLISHING_ENABLED === 'true'
            ? work.publicationAuthorized
              ? 'Moderation passed. Sharing follows your audience choice.'
              : 'Moderation passed. This work remains private until the visit authorizes sharing.'
            : 'Moderation passed. Publishing is currently disabled, so this work remains private.'
          : 'This work is private. Moderation has not approved it for sharing.'
    }
  }
  async upload(
    authorId: string,
    bytes: Uint8Array,
    mime: MediaType,
    audience: ArtifactAudience,
    key: string,
    fingerprint: string
  ) {
    validateMedia(bytes, mime)
    const uploadKey = `${authorId}:${key}`
    const existing = this.db
      .select()
      .from(works)
      .where(eq(works.uploadKey, uploadKey))
      .get()?.value
    const now = Date.now()
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new HttpError(409, 'Upload key already used for a different work')
      if (existing.deleted || existing.expiresAt <= now)
        throw new HttpError(410, 'This work was removed or expired')
      if (existing.ready) return this.projection(existing)
      if ((existing.uploadAttempt?.expiresAt ?? 0) > now)
        throw new HttpError(
          409,
          'Upload is still in progress; retry the same bytes and key after 30 seconds'
        )
      if ((existing.uploadAttempt?.count ?? 0) >= 3)
        throw new HttpError(
          503,
          'This work exhausted its three upload attempts. It remains private; do not retry automatically.'
        )
    }
    let work: Work
    if (existing) {
      work = existing
    } else {
      const own = this.db
        .select()
        .from(works)
        .where(eq(works.authorId, authorId))
        .all()
      if (
        own.length >= SESSION_ARTIFACT_LIMIT ||
        own.reduce((n, row) => n + row.value.bytes, 0) + bytes.length >
          SESSION_ARTIFACT_BYTES
      )
        throw new HttpError(
          429,
          'Studio allowance reached: five works and 10 MiB per visit'
        )
      const total = this.db
        .select({ count: sql<number>`count(*)` })
        .from(works)
        .get()!.count
      if (total >= 1000)
        throw new HttpError(
          503,
          'The Studio storage allowance is full; try later'
        )
      const id = crypto.randomUUID()
      work = {
        id,
        authorId,
        key: `studio/${id}`,
        uploadKey,
        fingerprint,
        mime,
        bytes: bytes.length,
        createdAt: now,
        expiresAt: now + ARTIFACT_RETENTION_MS,
        requestedAudience: audience,
        audience: 'private',
        moderation: 'pending',
        judgment: null,
        ready: false,
        deleted: false
      }
    }
    const attempt = {
      id: crypto.randomUUID(),
      count: (work.uploadAttempt?.count ?? 0) + 1,
      expiresAt: now + 30_000
    }
    work = {
      ...work,
      uploadAttempt: attempt,
      moderation: 'pending',
      audience: 'private'
    }
    // Reserve quota and this attempt before yielding; retries reuse the original row.
    if (existing) this.save(work)
    else
      this.db
        .insert(works)
        .values({
          id: work.id,
          authorId,
          uploadKey,
          expiresAt: work.expiresAt,
          value: work
        })
        .run()
    const id = work.id
    await this.ctx.storage.setAlarm(now + 60_000)
    try {
      await this.env.MEDIA.put(work.key, bytes, {
        httpMetadata: { contentType: mime }
      })
      const uploaded = this.find(id)
      if (!uploaded || uploaded.deleted || uploaded.expiresAt <= Date.now()) {
        await this.env.MEDIA.delete(work.key)
        throw new HttpError(410, 'Work was removed while uploading')
      }
      if (uploaded.uploadAttempt?.id !== attempt.id)
        return this.projection(uploaded)
      const judgment = await moderateMedia(bytes, mime, this.env.OPENAI_API_KEY)
      const current = this.find(id)
      if (!current || current.deleted || current.expiresAt <= Date.now()) {
        await this.env.MEDIA.delete(work.key)
        throw new HttpError(410, 'Work was removed while uploading')
      }
      if (current.uploadAttempt?.id !== attempt.id)
        return this.projection(current)
      this.save({
        ...current,
        uploadAttempt: { ...attempt, expiresAt: 0 },
        ready: true,
        moderation: judgment.state,
        judgment,
        audience: 'private',
        publicationAuthorized: false
      })
      await this.publish(id, 'agent')
    } catch (err) {
      if (err instanceof HttpError) throw err
      const current = this.find(id)
      if (!current || current.deleted || current.expiresAt <= Date.now())
        throw new HttpError(410, 'Work was removed while uploading')
      if (current.uploadAttempt?.id !== attempt.id)
        return this.projection(current)
      this.save({
        ...current,
        uploadAttempt: { ...attempt, expiresAt: 0 },
        moderation: 'error',
        audience: 'private'
      })
      throw new HttpError(
        503,
        'Upload interrupted. Retry the identical bytes, audience and Idempotency-Key; the reserved work will be reused (three attempts maximum).'
      )
    }
    return this.projection(this.find(id)!)
  }
  list(viewer: ArtifactViewer, ownOnly = false, after = '') {
    const rows = this.db
      .select()
      .from(works)
      .where(
        and(
          gt(works.expiresAt, Date.now()),
          gt(works.id, after),
          ownOnly && (viewer.kind === 'agent' || viewer.kind === 'owner')
            ? eq(works.authorId, viewer.sessionId)
            : undefined
        )
      )
      .orderBy(asc(works.id))
      .limit(100)
      .all()
    const visible = rows.filter(({ value }) =>
      ownOnly &&
      (viewer.kind === 'agent' || viewer.kind === 'owner') &&
      value.authorId === viewer.sessionId
        ? !value.deleted
        : canReadArtifact(
            value,
            viewer,
            Date.now(),
            this.env.PUBLISHING_ENABLED === 'true'
          )
    )
    return {
      works: visible.slice(0, 20).map(({ value }) => this.projection(value)),
      next:
        visible.length > 20
          ? visible[19]!.id
          : rows.length === 100
            ? rows[99]!.id
            : null
    }
  }
  async read(id: string, viewer: ArtifactViewer) {
    const work = this.find(id)
    if (
      !work ||
      !canReadArtifact(
        work,
        viewer,
        Date.now(),
        this.env.PUBLISHING_ENABLED === 'true'
      )
    )
      throw new HttpError(404, 'Work unavailable')
    const object = await this.env.MEDIA.get(work.key)
    const current = this.find(id)
    if (
      !object ||
      !current ||
      !canReadArtifact(
        current,
        viewer,
        Date.now(),
        this.env.PUBLISHING_ENABLED === 'true'
      )
    )
      throw new HttpError(404, 'Work unavailable')
    return new Response(object.body, {
      headers: {
        ...privateHeaders,
        'Content-Type': work.mime,
        'Content-Disposition': 'attachment',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Content-Length': String(work.bytes)
      }
    })
  }
  async change(
    id: string,
    authorId: string,
    audience: ArtifactAudience | 'delete',
    actor: 'agent' | 'owner' = 'agent'
  ) {
    const work = this.find(id)
    if (
      !work ||
      work.authorId !== authorId ||
      work.expiresAt <= Date.now() ||
      work.deleted
    )
      throw new HttpError(404, 'Work unavailable')
    const next =
      audience === 'delete'
        ? {
            ...work,
            deleted: true,
            ready: false,
            audience: 'private' as const,
            publicationAuthorized: false
          }
        : {
            ...work,
            requestedAudience: audience,
            audience: 'private' as const,
            publicationAuthorized: false
          }
    this.save(next)
    if (audience === 'delete') await this.env.MEDIA.delete(work.key)
    if (audience !== 'delete') await this.publish(id, actor)
    return this.projection(this.find(id)!)
  }
  private async publish(id: string, actor: 'agent' | 'owner') {
    const candidate = this.find(id)
    if (
      !candidate ||
      !(await authorizeSharing(this.env, candidate, 'studio', actor))
    )
      return
    const current = this.find(id)
    // Owner unsharing/deletion or a newer attempt wins over a delayed grant.
    if (
      !current ||
      current.deleted ||
      current.expiresAt <= Date.now() ||
      current.revision !== candidate.revision
    )
      return
    this.save({
      ...current,
      publicationAuthorized: true,
      audience: effectiveAudience(current.requestedAudience, current.moderation)
    })
  }
  async alarm() {
    const expired = this.db
      .select()
      .from(works)
      .where(lt(works.expiresAt, Date.now()))
      .limit(100)
      .all()
    for (const row of expired) {
      await this.env.MEDIA.delete(row.value.key)
      this.db.delete(works).where(eq(works.id, row.id)).run()
    }
    if (this.db.select({ id: works.id }).from(works).limit(1).get())
      await this.ctx.storage.setAlarm(Date.now() + 60_000)
  }
}
