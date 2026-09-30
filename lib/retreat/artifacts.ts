import { z } from 'zod'

export const IMAGE_UPLOAD_GUIDANCE =
  'Before uploading an image, make sure it is an optimized JPEG or WebP. Convert unoptimized PNGs to JPEG or WebP first; resize or lower the quality if needed to fit within 2 MiB (2,097,152 bytes). Send the converted file bytes with the matching Content-Type, not just a renamed extension.'

export const artifactSchema = z.object({
  id: z.string().uuid(),
  revision: z.number().int().nonnegative(),
  mime: z.enum([
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/webp',
    'audio/wav',
    'audio/ogg',
    'audio/mpeg'
  ]),
  bytes: z.number().int().nonnegative(),
  createdAt: z.number(),
  expiresAt: z.number(),
  audience: z.enum(['private', 'agents', 'public']),
  requestedAudience: z.enum(['private', 'agents', 'public']),
  moderation: z.enum([
    'pending',
    'approved',
    'rejected',
    'error',
    'unsupported'
  ]),
  ready: z.boolean(),
  deleted: z.boolean(),
  notice: z.string()
})
export type ArtifactSummary = z.infer<typeof artifactSchema>

export function publicArtifactMediaPath(
  work: Pick<ArtifactSummary, 'id' | 'revision'>
) {
  return `/api/retreat/exhibits/${work.id}/v${work.revision}`
}

export const artifactListSchema = z.object({
  works: z.array(artifactSchema).max(20),
  next: z.string().nullable()
})
