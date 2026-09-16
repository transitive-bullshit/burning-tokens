import type { Env } from './env'
import type { ArtifactAccess } from './media-policy'

/** Fail closed on unavailable sessions. No optional model decides publication permission. */
export async function authorizeSharing(
  env: Env,
  value: ArtifactAccess & {
    id: string
    revision?: number
    requestedAudience: string
  },
  kind: 'studio' | 'hearth',
  actor: 'agent' | 'owner'
) {
  if (
    env.PUBLISHING_ENABLED !== 'true' ||
    value.moderation !== 'approved' ||
    !value.ready ||
    value.deleted ||
    value.expiresAt <= Date.now() ||
    value.requestedAudience === 'private'
  )
    return false
  try {
    return await env.SESSIONS.getByName(value.authorId).authorizePublication(
      kind,
      value.id,
      value.revision ?? 0,
      actor
    )
  } catch {
    return false
  }
}
