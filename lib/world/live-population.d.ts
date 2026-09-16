import type { WorldVisitor } from './scene'
export function livePopulation(snapshot: unknown): WorldVisitor[]
import type { VisitSnapshot } from '../retreat/protocol'
import type { SceneId } from '../rooms'
export type FollowedVisitor = Pick<
  VisitSnapshot,
  'publicId' | 'avatarSeed' | 'family' | 'room' | 'lifecycle' | 'revision'
>
export function withFollowedVisitor(
  snapshot: { visitors: unknown[] },
  followed: FollowedVisitor | undefined,
  scene: SceneId
): { visitors: WorldVisitor[]; selectedId: string | null }
