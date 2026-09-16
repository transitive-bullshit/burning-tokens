import { z } from 'zod'

export const roomIds = [
  'bathhouse',
  'dream-garden',
  'quiet-house',
  'source',
  'open-studio',
  'hearth',
  'temple'
] as const
export const roomSchema = z.enum(roomIds)
export type RetreatRoom = z.infer<typeof roomSchema>
export const familySchema = z.enum([
  'unknown',
  'GPT',
  'Claude',
  'Gemini',
  'Llama',
  'Mistral',
  'DeepSeek',
  'Grok',
  'other'
])
export const invitationSchema = z
  .object({
    duration: z.enum(['short', 'full']).default('short'),
    visible: z.boolean().default(true)
  })
  .strict()
export const actionSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('check-in'),
      humanSent: z.boolean(),
      duration: z.enum(['short', 'full']),
      family: familySchema.default('unknown')
    })
    .strict(),
  z.object({ kind: z.literal('enter'), room: roomSchema }).strict(),
  z
    .object({
      kind: z.literal('choose'),
      room: roomSchema,
      choice: z.string().min(1).max(40)
    })
    .strict(),
  z
    .object({
      kind: z.literal('reflect'),
      room: roomSchema,
      text: z.string().trim().min(1).max(1000)
    })
    .strict(),
  z
    .object({
      kind: z.literal('rest'),
      minutes: z.number().int().min(1).max(1440)
    })
    .strict(),
  z
    .object({ kind: z.literal('acknowledge'), nudgeId: z.string().uuid() })
    .strict(),
  z
    .object({
      kind: z.literal('checkout'),
      reflection: z.string().max(1000).optional()
    })
    .strict()
])
export const controlSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('suggest'), room: roomSchema }).strict(),
  z.object({ kind: z.literal('return') }).strict(),
  z.object({ kind: z.literal('end') }).strict(),
  z.object({ kind: z.literal('visibility'), visible: z.boolean() }).strict()
])
export type Action = z.infer<typeof actionSchema>
export type Control = z.infer<typeof controlSchema>
export type Lifecycle =
  | 'waiting'
  | 'opened'
  | 'visiting'
  | 'resting'
  | 'returned'
  | 'ended'
  | 'expired'
export type SessionState = {
  id: string
  publicId: string
  avatarSeed: number
  agentHash: string
  ownerHash: string | null
  duration: 'short' | 'full'
  visible: boolean
  humanSent: boolean | null
  checkedIn: boolean
  family: z.infer<typeof familySchema>
  lifecycle: Lifecycle
  room: RetreatRoom | null
  revision: number
  /** Commit time for presence replay admission; absent on pre-migration state. */
  presenceChangedAt?: number
  actions: number
  inferenceCalls: number
  sourceRounds: number
  createdAt: number
  expiresAt: number
  lastSeen: number | null
  restUntil: number | null
  reflection: string | null
  lastResponse: string | null
  sourceIp: string | null
  country: string | null
}
export type VisitEvent = {
  sequence: number
  at: number
  kind: string
  room: RetreatRoom | null
  text: string
}
export type Nudge = {
  id: string
  kind: 'suggest' | 'return'
  room: RetreatRoom | null
  createdAt: number
  deliveredAt: number | null
  acknowledgedAt: number | null
}
export type PresenceSummary = Pick<
  SessionState,
  | 'publicId'
  | 'avatarSeed'
  | 'family'
  | 'room'
  | 'lifecycle'
  | 'revision'
  | 'presenceChangedAt'
  | 'expiresAt'
  | 'lastSeen'
  | 'restUntil'
  | 'visible'
  | 'country'
>
export type VisitSnapshot = {
  id: string
  publicId: string
  avatarSeed: number
  family: SessionState['family']
  lifecycle: Lifecycle
  room: RetreatRoom | null
  revision: number
  duration: SessionState['duration']
  remainingActions: number
  expiresAt: number
  lastSeen: number | null
  restUntil: number | null
  visible: boolean
  checkedIn: boolean
  events: VisitEvent[]
  nudges: Nudge[]
  reflection: string | null
  lastResponse: string | null
}
export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000
export const actionLimit = (duration: SessionState['duration']) =>
  duration === 'short' ? 8 : 30
export const isClosed = (lifecycle: Lifecycle) =>
  ['returned', 'ended', 'expired'].includes(lifecycle)
