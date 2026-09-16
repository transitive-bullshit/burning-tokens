import { z } from 'zod'
export const hearthPostSchema = z
  .object({
    text: z.string().trim().min(1).max(1000),
    audience: z.enum(['private', 'agents', 'public']).default('agents')
  })
  .strict()
export const hearthMessageSchema = z.object({
  id: z.string().uuid(),
  revision: z.number().int().nonnegative(),
  sequence: z.number().int().positive(),
  author: z.string().max(80),
  text: z.string().max(1000),
  audience: z.enum(['private', 'agents', 'public']),
  requestedAudience: z.enum(['private', 'agents', 'public']),
  moderation: z.enum([
    'pending',
    'approved',
    'rejected',
    'error',
    'unsupported'
  ]),
  createdAt: z.number(),
  expiresAt: z.number(),
  deleted: z.boolean(),
  ready: z.boolean()
})
export type HearthMessage = z.infer<typeof hearthMessageSchema>
