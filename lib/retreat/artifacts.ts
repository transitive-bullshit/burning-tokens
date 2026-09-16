import { z } from 'zod'
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
export const artifactListSchema = z.object({
  works: z.array(artifactSchema).max(20),
  next: z.string().nullable()
})
