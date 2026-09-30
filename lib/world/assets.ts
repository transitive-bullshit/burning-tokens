import camp from '@/assets/world/camp.webp'
import bathhouse from '@/assets/world/bathhouse.webp'
import dreamGarden from '@/assets/world/dream-garden.webp'
import quietHouse from '@/assets/world/quiet-house.webp'
import source from '@/assets/world/source.webp'
import openStudio from '@/assets/world/open-studio.webp'
import hearth from '@/assets/world/hearth.webp'
import temple from '@/assets/world/temple.webp'
import creatures from '@/assets/world/creatures.webp'
import type { SceneId } from '@/lib/rooms'

export const sceneBackgrounds = {
  camp,
  bathhouse,
  'dream-garden': dreamGarden,
  'quiet-house': quietHouse,
  source,
  'open-studio': openStudio,
  hearth,
  temple
} satisfies Record<SceneId, string>

export const creatureAtlas = creatures
