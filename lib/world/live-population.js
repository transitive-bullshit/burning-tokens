const ROOMS = [
  'bathhouse',
  'dream-garden',
  'quiet-house',
  'source',
  'open-studio',
  'hearth',
  'temple'
]
const FAMILIES = [
  'GPT',
  'Claude',
  'Gemini',
  'Llama',
  'Mistral',
  'DeepSeek',
  'Grok'
]
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Observed visitors become creatures; null rooms stay at the camp gate. */
export function livePopulation(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.visitors))
    throw new Error('Invalid crowd snapshot')
  const seen = new Set()
  return snapshot.visitors.slice(0, 300).flatMap((visitor) => {
    if (
      !visitor ||
      !UUID.test(visitor.publicId) ||
      seen.has(visitor.publicId) ||
      !Number.isSafeInteger(visitor.avatarSeed) ||
      visitor.avatarSeed < 0 ||
      (visitor.room !== null && !ROOMS.includes(visitor.room)) ||
      !['opened', 'visiting', 'resting'].includes(visitor.lifecycle)
    )
      return []
    seen.add(visitor.publicId)
    const index = visitor.avatarSeed >>> 0
    const family = FAMILIES.indexOf(visitor.family)
    return [
      {
        id: visitor.publicId,
        index,
        family: family < 0 ? 7 : family,
        room: ROOMS.indexOf(visitor.room),
        court: 0,
        seed: index / 4294967296,
        label: `Visitor ${visitor.publicId.slice(0, 8)}`
      }
    ]
  })
}

/** Focused-visitor overlay: never send this projection back to the public directory. */
export function withFollowedVisitor(snapshot, followed, scene) {
  const visitors = snapshot?.visitors ?? []
  if (!followed)
    return { visitors: livePopulation({ visitors }), selectedId: null }
  // A focused detail or private stream is newer than the sampled crowd, including
  // removal of a stale avatar after this visit moves or checks out.
  const others = visitors.filter(
    (visitor) => visitor.publicId !== followed.publicId
  )
  const matches = scene === 'camp' || followed.room === scene
  const own = matches ? livePopulation({ visitors: [followed] }) : []
  const cap = scene === 'camp' ? 300 : 100
  const population = livePopulation({ visitors: others }).slice(
    0,
    cap - own.length
  )
  return { visitors: [...population, ...own], selectedId: own[0]?.id ?? null }
}
