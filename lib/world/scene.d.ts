import type { SceneId } from '../rooms'
export type WorldVisitor = {
  id: string
  index: number
  family: number
  room: number
  court: number
  seed: number
  label: string
}
export type WorldHandle = (() => void) & {
  updatePopulation: (
    visitors: WorldVisitor[],
    total: number,
    selectedId?: string | null
  ) => void
}
export function mountWorld(
  root: HTMLElement,
  scene: SceneId,
  navigate: (scene: SceneId) => void,
  options?: { live?: boolean; onFollow?: (publicId: string) => void }
): WorldHandle
