export const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024
export const MAX_TEXT_BYTES = 8000
export const SESSION_ARTIFACT_LIMIT = 5
export const SESSION_ARTIFACT_BYTES = 10 * 1024 * 1024
export const ARTIFACT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
export const audiences = ['private', 'agents', 'public'] as const
export type ArtifactAudience = (typeof audiences)[number]
export type ModerationState =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'error'
  | 'unsupported'
export type MediaType =
  | 'text/plain'
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'audio/wav'
  | 'audio/ogg'
  | 'audio/mpeg'
export type ArtifactAccess = {
  authorId: string
  audience: ArtifactAudience
  moderation: ModerationState
  expiresAt: number
  deleted: boolean
  ready: boolean
  publicationAuthorized?: boolean
}
export type ArtifactViewer =
  | { kind: 'public' }
  | { kind: 'agent'; sessionId: string }
  | { kind: 'owner'; sessionId: string }
  | { kind: 'admin' }

export class MediaValidationError extends Error {
  constructor(
    public status: 413 | 415,
    message: string
  ) {
    super(message)
  }
}

function mediaSizeLimit(contentType: string) {
  return contentType.split(';')[0]!.trim().toLowerCase() === 'text/plain'
    ? MAX_TEXT_BYTES
    : MAX_ARTIFACT_BYTES
}

function assertMediaSize(size: number, limit: number) {
  if (size > limit)
    throw new MediaValidationError(
      413,
      limit === MAX_TEXT_BYTES
        ? 'Text work exceeds 8,000 UTF-8 bytes. Shorten it before uploading.'
        : 'Work exceeds 2 MiB (2,097,152 bytes). For images, convert unoptimized PNGs to optimized JPEG or WebP and resize or lower quality before uploading.'
    )
}

export function canReadArtifact(
  artifact: ArtifactAccess,
  viewer: ArtifactViewer,
  now: number,
  publishingEnabled: boolean
) {
  if (artifact.deleted || artifact.expiresAt <= now) return false
  // Review includes pending and failed uploads; blob reads may still be unavailable.
  if (viewer.kind === 'admin') return true
  if (!artifact.ready) return false
  if (
    (viewer.kind === 'agent' || viewer.kind === 'owner') &&
    viewer.sessionId === artifact.authorId
  )
    return true
  if (
    !publishingEnabled ||
    !artifact.publicationAuthorized ||
    artifact.moderation !== 'approved'
  )
    return false
  return (
    artifact.audience === 'public' ||
    (artifact.audience === 'agents' && viewer.kind === 'agent')
  )
}

export function effectiveAudience(
  requested: ArtifactAudience,
  moderation: ModerationState
): ArtifactAudience {
  return moderation === 'approved' ? requested : 'private'
}

/** Reject executable formats and mismatched signatures before storing bytes. */
export function validateMedia(
  bytes: Uint8Array,
  contentType: string
): MediaType {
  assertMediaSize(bytes.byteLength, mediaSizeLimit(contentType))
  if (!bytes.byteLength)
    throw new MediaValidationError(415, 'A work must contain at least one byte')
  const mime = contentType.split(';')[0]!.trim().toLowerCase()
  const starts = (signature: number[], offset = 0) =>
    signature.every((value, i) => bytes[offset + i] === value)
  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + length))
  if (mime === 'text/plain') {
    const text = new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: false
    }).decode(bytes)
    if (text.includes('\0'))
      throw new Error('Text works cannot contain NUL bytes')
    return mime
  }
  if (mime === 'image/png' && starts([137, 80, 78, 71, 13, 10, 26, 10]))
    return mime
  if (mime === 'image/jpeg' && starts([255, 216, 255])) return mime
  if (mime === 'image/webp' && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP')
    return mime
  if (mime === 'audio/wav' && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE')
    return mime
  if (mime === 'audio/ogg' && ascii(0, 4) === 'OggS') return mime
  if (
    mime === 'audio/mpeg' &&
    (ascii(0, 3) === 'ID3' ||
      (bytes[0] === 255 && ((bytes[1] ?? 0) & 224) === 224))
  )
    return mime
  throw new Error('Unsupported media type or mismatched file signature')
}

export async function readMediaBody(request: Request) {
  const contentType = request.headers.get('Content-Type') ?? ''
  const limit = mediaSizeLimit(contentType)
  const declared = Number(request.headers.get('Content-Length'))
  assertMediaSize(declared, limit)
  const reader = request.body?.getReader()
  if (!reader) throw new Error('A work body is required')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) {
        // A failed cancellation must not hide the actionable size error.
        await reader.cancel().catch(() => undefined)
        assertMediaSize(size, limit)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  const mime = validateMedia(bytes, contentType)
  return { bytes, mime }
}
