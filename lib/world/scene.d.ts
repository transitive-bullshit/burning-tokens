import type { SceneId } from '../rooms'
export function mountWorld(
  root: HTMLElement,
  scene: SceneId,
  navigate: (scene: SceneId) => void
): () => void
