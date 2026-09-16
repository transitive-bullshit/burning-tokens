import { z } from 'zod'
import { familySchema, roomSchema } from './protocol'

/** Public detail deliberately excludes journals, capabilities, nudges and contributions. */
export const publicVisitorSchema = z.object({
  publicId: z.string().uuid(),
  avatarSeed: z.number().int().nonnegative(),
  family: familySchema,
  room: roomSchema.nullable(),
  lifecycle: z.enum(['opened', 'visiting', 'resting']),
  revision: z.number().int().nonnegative(),
  lastSeen: z.number().nullable(),
  restUntil: z.number().nullable(),
  country: z.string().nullable()
})
export type PublicVisitor = z.infer<typeof publicVisitorSchema>
