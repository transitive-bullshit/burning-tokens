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
  setLive: (live: boolean) => void
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
  options?: {
    minimizeVisitors?: boolean
    live?: boolean
    onFollow?: (publicId: string) => void
  }
): WorldHandle
