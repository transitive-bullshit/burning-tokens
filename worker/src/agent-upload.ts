import { z } from 'zod'
import { HttpError } from './http'
import {
  MAX_ARTIFACT_BYTES,
  MAX_TEXT_BYTES,
  SESSION_ARTIFACT_LIMIT,
  audiences
} from './media-policy'

const PREFIX = 'agent-upload:'
const META = `${PREFIX}meta:`
export const UPLOAD_TTL_MS = 30 * 60 * 1000
const COMMIT_LEASE_MS = 2 * 60 * 1000
export const uploadStartSchema = z
  .object({
    mime: z.enum(['image/jpeg', 'image/webp', 'image/png', 'text/plain']),
    bytes: z.number().int().min(1).max(MAX_ARTIFACT_BYTES),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    partBytes: z
      .union([
        z.literal(1024),
        z.literal(2048),
        z.literal(4096),
        z.literal(8192)
      ])
      .default(4096),
    audience: z.enum(audiences).default('public')
  })
  .strict()
  .refine(
    (value) => value.mime !== 'text/plain' || value.bytes <= MAX_TEXT_BYTES
  )

type UploadStart = z.infer<typeof uploadStartSchema>
type Upload = UploadStart & {
  key: string
  state: 'receiving' | 'committing' | 'complete' | 'aborted' | 'expired'
  expiresAt: number
  received: number[]
  lease?: { id: string; expiresAt: number }
  artifactId?: string
}
type Storage = Pick<DurableObjectStorage, 'kv' | 'transactionSync'>
const partKey = (key: string, part: number) => `${PREFIX}part:${key}:${part}`
const partCount = (upload: Upload) => Math.ceil(upload.bytes / upload.partBytes)

/** One bounded, durable in-flight file per visit; no R2/publication until commit.
 * Completed/expired receipts remain bounded to five and survive retries/restarts.
 */
export class AgentUpload {
  constructor(private storage: Storage) {}

  private all() {
    return [
      ...this.storage.kv.list<Upload>({
        prefix: META,
        limit: SESSION_ARTIFACT_LIMIT
      })
    ].map(([, value]) => value)
  }

  private clearParts(upload: Upload) {
    for (const part of upload.received)
      this.storage.kv.delete(partKey(upload.key, part))
    upload.received = []
    delete upload.lease
  }

  expire(now = Date.now()) {
    this.storage.transactionSync(() => {
      for (const upload of this.all()) {
        if (
          ['receiving', 'committing'].includes(upload.state) &&
          upload.expiresAt <= now &&
          (!upload.lease || upload.lease.expiresAt <= now)
        ) {
          this.clearParts(upload)
          upload.state = 'expired'
          this.storage.kv.put(META + upload.key, upload)
        }
      }
    })
  }

  nextExpiry() {
    return Math.min(
      ...this.all()
        .filter((upload) => ['receiving', 'committing'].includes(upload.state))
        .map((upload) =>
          Math.max(upload.expiresAt, upload.lease?.expiresAt ?? 0)
        )
    )
  }

  get(key: string, now = Date.now()) {
    this.expire(now)
    const upload = this.storage.kv.get<Upload>(META + key)
    if (!upload) throw new HttpError(404, 'Upload transfer not found')
    return upload
  }

  status(key: string, now = Date.now()) {
    const upload = this.get(key, now)
    return {
      key: upload.key,
      state: upload.state,
      bytes: upload.bytes,
      mime: upload.mime,
      requestedAudience: upload.audience,
      sha256: upload.sha256,
      partBytes: upload.partBytes,
      parts: partCount(upload),
      received: upload.received,
      missing:
        upload.state === 'receiving' || upload.state === 'committing'
          ? Array.from({ length: partCount(upload) }, (_, part) => part).filter(
              (part) => !upload.received.includes(part)
            )
          : [],
      expiresAt: upload.expiresAt,
      artifactId: upload.artifactId,
      notice:
        upload.state === 'complete'
          ? 'Transfer committed. Read the artifact receipt to confirm its current audience.'
          : upload.state === 'expired' || upload.state === 'aborted'
            ? 'No staged bytes remain. Start a new transfer with a new key if needed.'
            : 'Bytes are only staged. Nothing has been uploaded to the Studio or published yet.'
    }
  }

  start(key: string, input: UploadStart, now = Date.now()) {
    this.expire(now)
    const existing = this.storage.kv.get<Upload>(META + key)
    if (existing) {
      for (const field of [
        'mime',
        'bytes',
        'sha256',
        'partBytes',
        'audience'
      ] as const)
        if (existing[field] !== input[field])
          throw new HttpError(
            409,
            'Transfer key already used for different file metadata'
          )
      return this.status(key, now)
    }
    const previous = this.all()
    if (
      previous.some((upload) =>
        ['receiving', 'committing'].includes(upload.state)
      )
    )
      throw new HttpError(
        409,
        'Finish or abort the existing transfer before starting another'
      )
    if (previous.length >= SESSION_ARTIFACT_LIMIT)
      throw new HttpError(
        429,
        'This visit has used its five upload-transfer starts, including expired or aborted transfers'
      )
    this.storage.kv.put<Upload>(META + key, {
      ...input,
      key,
      state: 'receiving',
      expiresAt: now + UPLOAD_TTL_MS,
      received: []
    })
    return this.status(key, now)
  }

  part(key: string, part: number, bytes: Uint8Array, now = Date.now()) {
    const upload = this.get(key, now)
    if (!['receiving', 'committing'].includes(upload.state))
      throw new HttpError(409, `Transfer is ${upload.state}`)
    if (!Number.isSafeInteger(part) || part < 0 || part >= partCount(upload))
      throw new HttpError(400, 'Part index is outside this transfer')
    const expected = Math.min(
      upload.partBytes,
      upload.bytes - part * upload.partBytes
    )
    if (bytes.byteLength !== expected)
      throw new HttpError(400, `Part must contain exactly ${expected} bytes`)
    const previous = this.storage.kv.get<Uint8Array>(partKey(key, part))
    if (previous) {
      if (
        previous.length !== bytes.length ||
        previous.some((value, index) => value !== bytes[index])
      )
        throw new HttpError(
          409,
          'This part already contains different bytes; abort and restart with a new key'
        )
      return this.status(key, now)
    }
    if (upload.state === 'committing')
      throw new HttpError(409, 'Transfer commit is in progress')
    this.storage.transactionSync(() => {
      this.storage.kv.put(partKey(key, part), bytes)
      upload.received.push(part)
      upload.received.sort((a, b) => a - b)
      this.storage.kv.put(META + key, upload)
    })
    return this.status(key, now)
  }

  async prepare(key: string, now = Date.now()) {
    const upload = this.get(key, now)
    if (!['receiving', 'committing'].includes(upload.state))
      throw new HttpError(409, `Transfer is ${upload.state}`)
    if (upload.lease && upload.lease.expiresAt > now)
      throw new HttpError(
        409,
        'Transfer commit is in progress; retry the same commit later'
      )
    if (upload.received.length !== partCount(upload))
      throw new HttpError(
        409,
        'Transfer is incomplete; read its status and send the missing parts'
      )
    const bytes = new Uint8Array(upload.bytes)
    for (let part = 0; part < partCount(upload); part++) {
      const value = this.storage.kv.get<Uint8Array>(partKey(key, part))
      if (!value)
        throw new HttpError(
          409,
          'A stored part is missing; abort and restart this transfer'
        )
      bytes.set(value, part * upload.partBytes)
    }
    const lease = crypto.randomUUID()
    upload.state = 'committing'
    upload.lease = { id: lease, expiresAt: now + COMMIT_LEASE_MS }
    this.storage.kv.put(META + key, upload)
    try {
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
        (byte) => byte.toString(16).padStart(2, '0')
      ).join('')
      if (hash !== upload.sha256)
        throw new HttpError(
          422,
          'File checksum does not match. Abort this transfer and restart with the correct bytes and SHA-256.'
        )
      const current = this.get(key)
      if (current.lease?.id !== lease || current.state !== 'committing')
        throw new HttpError(
          409,
          'Transfer changed before commit; check its status'
        )
      return { upload, bytes, lease }
    } catch (err) {
      this.release(key, lease)
      throw err
    }
  }

  release(key: string, lease: string) {
    const upload = this.storage.kv.get<Upload>(META + key)
    if (upload?.state === 'committing' && upload.lease?.id === lease) {
      upload.state = 'receiving'
      delete upload.lease
      this.storage.kv.put(META + key, upload)
    }
  }

  complete(key: string, lease: string, artifactId: string) {
    const upload = this.storage.kv.get<Upload>(META + key)
    if (upload?.state !== 'committing' || upload.lease?.id !== lease) return
    this.storage.transactionSync(() => {
      this.clearParts(upload)
      upload.state = 'complete'
      upload.artifactId = artifactId
      this.storage.kv.put(META + key, upload)
    })
  }

  abort(key: string, now = Date.now()) {
    const upload = this.get(key, now)
    if (upload.state === 'complete')
      throw new HttpError(
        409,
        'Transfer is complete; use the artifact delete endpoint to remove the work'
      )
    if (upload.lease && upload.lease.expiresAt > now)
      throw new HttpError(
        409,
        'Commit is in progress; check the receipt before removing the resulting work'
      )
    this.storage.transactionSync(() => {
      this.clearParts(upload)
      upload.state = 'aborted'
      this.storage.kv.put(META + key, upload)
    })
    return this.status(key, now)
  }
}

export async function readUploadPart(request: Request) {
  if (request.headers.get('Content-Type') !== 'application/octet-stream')
    throw new HttpError(
      415,
      'Use application/octet-stream for raw transfer parts'
    )
  if (Number(request.headers.get('Content-Length')) > 8192)
    throw new HttpError(413, 'A transfer part cannot exceed 8 KiB')
  const reader = request.body?.getReader()
  if (!reader) throw new HttpError(400, 'Part bytes are required')
  const bytes = new Uint8Array(8192)
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (size + value.byteLength > bytes.length) {
        await reader.cancel().catch(() => undefined)
        throw new HttpError(413, 'A transfer part cannot exceed 8 KiB')
      }
      bytes.set(value, size)
      size += value.byteLength
    }
  } finally {
    reader.releaseLock()
  }
  return bytes.slice(0, size)
}
