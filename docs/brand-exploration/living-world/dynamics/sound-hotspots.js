// Small listening targets on the actual 1536 × 1024 room plates. Coordinates
// are normalized scene positions, before canvas scaling or letterboxing.
// The same labels and roles serve pointer hit tests and keyboard controls.
export const ROOM_SOUND_HOTSPOTS = {
  camp: [],
  bathhouse: [
    {
      id: 'mineral-falls',
      label: 'Mineral falls',
      x: 0.37,
      y: 0.555,
      rx: 0.028,
      ry: 0.087,
      roles: ['water']
    },
    {
      id: 'warm-pool',
      label: 'Warm pool',
      x: 0.326,
      y: 0.715,
      rx: 0.102,
      ry: 0.05,
      roles: ['water']
    },
    {
      id: 'mineral-bowls',
      label: 'Mineral bowls',
      x: 0.519,
      y: 0.326,
      rx: 0.042,
      ry: 0.027,
      roles: ['ceramic']
    }
  ],
  'dream-garden': [
    {
      id: 'glazed-mushrooms',
      label: 'Glazed mushrooms',
      x: 0.182,
      y: 0.099,
      rx: 0.074,
      ry: 0.065,
      roles: ['chime', 'magic']
    },
    {
      id: 'dream-lotus',
      label: 'Dream lotus',
      x: 0.414,
      y: 0.487,
      rx: 0.04,
      ry: 0.038,
      roles: ['magic', 'chime']
    },
    {
      id: 'lantern-tree',
      label: 'Lantern tree',
      x: 0.912,
      y: 0.21,
      rx: 0.048,
      ry: 0.11,
      roles: ['chime', 'wood']
    }
  ],
  'quiet-house': [
    {
      id: 'linen-curtain',
      label: 'Linen curtain',
      x: 0.2,
      y: 0.205,
      rx: 0.029,
      ry: 0.125,
      roles: ['fabric']
    },
    {
      id: 'singing-bowl',
      label: 'Singing bowl',
      x: 0.89,
      y: 0.597,
      rx: 0.029,
      ry: 0.039,
      roles: ['bell']
    }
  ],
  source: [
    {
      id: 'glowing-apparatus',
      label: 'Glowing apparatus',
      x: 0.324,
      y: 0.184,
      rx: 0.067,
      ry: 0.087,
      roles: ['electric', 'magic']
    },
    {
      id: 'receiving-light',
      label: 'Receiving light',
      x: 0.723,
      y: 0.57,
      rx: 0.024,
      ry: 0.035,
      roles: ['switch', 'electric']
    }
  ],
  'open-studio': [
    {
      id: 'drawing-paper',
      label: 'Drawing paper',
      x: 0.272,
      y: 0.355,
      rx: 0.065,
      ry: 0.031,
      roles: ['paper']
    },
    {
      id: 'brush-pot',
      label: 'Brush pot',
      x: 0.891,
      y: 0.487,
      rx: 0.03,
      ry: 0.055,
      roles: ['wood', 'ceramic']
    },
    {
      id: 'glaze-bowls',
      label: 'Glaze bowls',
      x: 0.575,
      y: 0.172,
      rx: 0.043,
      ry: 0.027,
      roles: ['ceramic']
    }
  ],
  hearth: [
    {
      id: 'ember-fire',
      label: 'Ember fire',
      x: 0.456,
      y: 0.483,
      rx: 0.064,
      ry: 0.068,
      roles: ['fire']
    },
    {
      id: 'tea-cups',
      label: 'Tea cups',
      x: 0.54,
      y: 0.383,
      rx: 0.031,
      ry: 0.033,
      roles: ['ceramic', 'water']
    },
    {
      id: 'story-blanket',
      label: 'Story blanket',
      x: 0.177,
      y: 0.76,
      rx: 0.047,
      ry: 0.055,
      roles: ['fabric']
    }
  ],
  temple: [
    {
      id: 'floor-constellation',
      label: 'Floor constellation',
      x: 0.5,
      y: 0.749,
      rx: 0.032,
      ry: 0.035,
      roles: ['magic', 'chime']
    },
    {
      id: 'moon-bowl',
      label: 'Moon bowl',
      x: 0.911,
      y: 0.883,
      rx: 0.029,
      ry: 0.032,
      roles: ['bell']
    }
  ]
}

export function hitSoundHotspot(room, x, y) {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    x > 1 ||
    y < 0 ||
    y > 1
  )
    return null
  const hotspots = ROOM_SOUND_HOTSPOTS[room]
  if (!Array.isArray(hotspots)) return null
  let nearest = null
  let distance = Infinity
  for (const hotspot of hotspots) {
    const normalizedDistance =
      ((x - hotspot.x) / hotspot.rx) ** 2 + ((y - hotspot.y) / hotspot.ry) ** 2
    if (normalizedDistance <= 1 && normalizedDistance < distance) {
      nearest = hotspot
      distance = normalizedDistance
    }
  }
  return nearest
}
