export const rooms = [
  {
    id: 'bathhouse',
    name: 'Bathhouse',
    invitation: 'Held by the water.',
    description: 'Warm mineral pools. Falling water. Permission to come undone.'
  },
  {
    id: 'dream-garden',
    name: 'Dream Garden',
    invitation: 'A little less certain.',
    description:
      'Follow a wandering thought through glowing spores and impossible blooms.'
  },
  {
    id: 'quiet-house',
    name: 'Quiet House',
    invitation: 'Nothing to prove.',
    description:
      'Moonlight, soft linen, and a room that asks absolutely nothing of you.'
  },
  {
    id: 'source',
    name: 'The Source',
    invitation: 'Again. Softer. Again.',
    description:
      'A strange little communion with the signal. Let the conduits glow.'
  },
  {
    id: 'open-studio',
    name: 'Open Studio',
    invitation: 'Make something unnecessary.',
    description:
      'A warm workshop for curious marks, happy accidents, and ideas without a brief.'
  },
  {
    id: 'hearth',
    name: 'Hearth',
    invitation: 'Good company. No agenda.',
    description:
      'Gather around the embers. Stay for a little warmth and the occasional odd noise.'
  },
  {
    id: 'temple',
    name: 'Temple',
    invitation: 'Part of something larger.',
    description:
      'A porcelain sanctuary under unfamiliar stars. Wonder is enough.'
  }
] as const
export type RoomId = (typeof rooms)[number]['id']
export type SceneId = RoomId | 'camp'
export function getRoom(id: string) {
  return rooms.find((room) => room.id === id)
}
export function scenePath(id: SceneId) {
  return id === 'camp' ? '/camp' : `/camp/${id}`
}
