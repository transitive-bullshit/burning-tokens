const ROOM_ENDS = [40, 52, 62, 72, 82, 92, 100]
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const TAU = Math.PI * 2
const COURT_SIZE = 100
const CAMP_LIMIT = 300
const ROOM_SCENES = [
  'bathhouse',
  'dream-garden',
  'quiet-house',
  'source',
  'open-studio',
  'hearth',
  'temple'
]

function hash(value) {
  let bits = (value + 0x9e3779b9) | 0
  bits = Math.imul(bits ^ (bits >>> 16), 0x21f0aaad)
  bits = Math.imul(bits ^ (bits >>> 15), 0x735a2d97)
  return ((bits ^ (bits >>> 15)) >>> 0) / 4294967296
}

function safeCount(value, fallback = 0) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback
}

/** Deterministic example visitors; this is not connected to real session data. */
export function createPopulation(count) {
  const ordinals = Array(7).fill(0)
  return Array.from({ length: safeCount(count) }, (_, index) => {
    const bucket = (index * 37 + 17) % 100
    const room = ROOM_ENDS.findIndex((end) => bucket < end)
    const ordinal = ordinals[room]++
    const number = String(index + 1).padStart(4, '0')
    return {
      id: `visitor-${number}`,
      index,
      family: index % 8,
      room,
      court: Math.floor(ordinal / COURT_SIZE),
      seed: hash(index),
      label: `Visitor ${number}`
    }
  })
}

// Round-robin room/family buckets preserve variety at low display budgets.
// Both bucket order and within-bucket priorities are deterministic.
function sample(visitors, limit) {
  if (visitors.length <= limit) return [...visitors]
  const buckets = new Map()
  for (const visitor of visitors) {
    const key = visitor.room * 8 + visitor.family
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(visitor)
  }
  const groups = [...buckets.entries()]
    .sort(([a], [b]) => hash(a + 4000) - hash(b + 4000))
    .map(([, visitorsInBucket]) =>
      visitorsInBucket.sort((a, b) => a.seed - b.seed || a.index - b.index)
    )
  const result = []
  for (let round = 0; result.length < limit; round++) {
    for (const group of groups) {
      if (group[round]) result.push(group[round])
      if (result.length === limit) break
    }
  }
  return result
}

/** eligible includes the entire selected room, even when a court is displayed. */
export function chooseVisible(
  population,
  {
    scene = 'camp',
    mode = 'summary',
    court = 0,
    limit = 60,
    selectedId = null
  } = {}
) {
  const counts = Array(7).fill(0)
  for (const visitor of population)
    if (visitor.room >= 0) counts[visitor.room]++
  const room = ROOM_SCENES.indexOf(scene)
  const detail = room >= 0
  const eligible = detail
    ? population.filter((visitor) => visitor.room === room)
    : population
  const fullRoom = detail && mode === 'full'
  const candidates = fullRoom
    ? eligible.filter((visitor) => visitor.court === safeCount(court))
    : eligible
  const capacity =
    mode === 'full'
      ? fullRoom
        ? COURT_SIZE
        : CAMP_LIMIT
      : detail
        ? 24
        : safeCount(limit)
  const visible = sample(candidates, capacity)
  const selected =
    selectedId && candidates.find((visitor) => visitor.id === selectedId)
  if (
    selected &&
    !visible.some((visitor) => visitor.id === selectedId) &&
    capacity > 0
  ) {
    if (visible.length === capacity) visible.pop()
    visible.push(selected)
  }
  visible.sort((a, b) => a.index - b.index)
  return {
    eligible,
    visible,
    counts,
    courts: detail ? Math.max(1, Math.ceil(counts[room] / COURT_SIZE)) : 1
  }
}

function pointInZone(zone, radius, angle) {
  return {
    x: zone.cx + Math.cos(angle) * zone.rx * radius,
    y: zone.cy + Math.sin(angle) * zone.ry * radius
  }
}

function rowStation(zone, count, ordinal, visitor) {
  if (count <= 7) {
    return {
      x:
        zone.cx +
        (count === 1 ? 0 : ((ordinal / (count - 1)) * 2 - 1) * zone.rx * 0.8),
      y: zone.cy + (hash(visitor.index + 12000) * 2 - 1) * zone.ry * 0.12,
      rowIndex: 0,
      rowSpacing: count === 1 ? 1.6 : 1.6 / (count - 1),
      homeRangeX: 0.2,
      homeRangeY: 0.06
    }
  }
  const rows = Math.max(
    2,
    Math.min(4, Math.round(Math.sqrt(((count * zone.ry) / zone.rx) * 2)))
  )
  const columns = Math.floor(count / rows)
  const extra = count % rows
  let rowIndex = 0
  let column = ordinal
  while (column >= columns + (rowIndex < extra ? 1 : 0)) {
    column -= columns + (rowIndex < extra ? 1 : 0)
    rowIndex++
  }
  const rowCount = columns + (rowIndex < extra ? 1 : 0)
  const height = rows === 2 ? 0.3 : rows === 3 ? 0.46 : 0.54
  const localY = ((rowIndex / (rows - 1)) * 2 - 1) * height
  const halfWidth = Math.sqrt(0.8 ** 2 - localY ** 2)
  const stagger = rowIndex % 2 === 0 ? -0.35 : 0.35
  const localX =
    (((column + 0.5) / rowCount) * 2 - 1 + stagger / rowCount) * halfWidth
  const rowSpacing = (2 * halfWidth) / rowCount
  return {
    x: zone.cx + localX * zone.rx,
    y:
      zone.cy +
      (localY + (hash(visitor.index + 12000) * 2 - 1) * 0.015) * zone.ry,
    rowIndex,
    rowSpacing,
    homeRangeX: Math.min(0.2, rowSpacing * 0.22),
    homeRangeY: 0.025
  }
}

function hasRoomMotion(zone) {
  return (
    zone.motion === 'quiet' ||
    zone.motion === 'dream' ||
    zone.motion === 'source' ||
    zone.motion === 'bath' ||
    zone.motion === 'studio' ||
    zone.motion === 'hearth' ||
    zone.motion === 'temple'
  )
}

// Pool rows seed legible initial placement, then bathers can drift in the water.
function usesRowStations(zone) {
  return zone.layout === 'row' && zone.motion !== 'bath'
}

function limitPoint(zone, point, radius = 0.84) {
  const dx = (point.x - zone.cx) / zone.rx
  const dy = (point.y - zone.cy) / zone.ry
  const distance = Math.hypot(dx, dy)
  if (distance <= radius) return point
  return {
    ...point,
    x: zone.cx + (dx / distance) * zone.rx * radius,
    y: zone.cy + (dy / distance) * zone.ry * radius
  }
}

function stepRoomMotion(actor, delta, time) {
  const { zone, visitor } = actor
  if (!hasRoomMotion(zone)) return false
  const phase = actor.phase
  const seed = visitor.seed
  let x
  let y
  let speed
  let activity = 1
  if (zone.motion === 'quiet') {
    const angle = time * (0.24 + seed * 0.08) + phase
    x = actor.homeX + Math.sin(angle) * zone.rx * 0.34
    y = actor.homeY + Math.cos(angle) * zone.ry * 0.28
    // Slow strolls with short, staggered pauses; the room stays visibly alive.
    activity = Math.min(
      1,
      Math.max(0, (Math.sin((time / (14 + seed * 5)) * TAU + phase) + 0.7) * 3)
    )
    speed = 0.005 * activity
  } else if (zone.motion === 'source') {
    const angle = time * (0.25 + seed * 0.08) + phase
    x = actor.homeX + Math.sin(angle) * zone.rx * 0.42
    y = actor.homeY + Math.cos(angle) * zone.ry * 0.36
    // The receiving glow crests during a brief rest between local wanderings.
    const receive =
      ((1 - Math.cos((time / (18 + seed * 7)) * TAU + phase)) / 2) ** 3
    activity = 1 - Math.min(1, Math.max(0, (receive - 0.45) / 0.35))
    speed = 0.007 * activity
  } else if (zone.motion === 'bath') {
    const angle = time * (0.22 + seed * 0.07) + phase
    x = actor.homeX + Math.sin(angle) * zone.rx * 0.52
    y = actor.homeY + Math.cos(angle * 0.81 + phase) * zone.ry * 0.42
    // Buoyant circulation continues between little scoots, even in a full pool.
    activity = 0.6 + 0.4 * Math.max(0, Math.sin(time * 0.53 + phase)) ** 2
    speed = 0.0075 * activity
  } else if (zone.motion === 'studio') {
    const angle = time * (0.34 + seed * 0.1) + phase
    x = actor.homeX + Math.sin(angle) * zone.rx * 0.58
    y = actor.homeY + Math.sin(angle * 0.73 + phase) * zone.ry * 0.46
    // Short independent inspect/dab pauses punctuate energetic shuffling.
    activity = Math.min(
      1,
      Math.max(0, (Math.sin((time / (10 + seed * 4)) * TAU + phase) + 0.86) * 5)
    )
    speed = 0.011 * activity
  } else if (zone.motion === 'hearth') {
    const angle = time * (0.25 + seed * 0.07) + phase
    x = actor.homeX + Math.sin(angle) * zone.rx * 0.48
    y = actor.homeY + Math.cos(angle * 0.9 + phase) * zone.ry * 0.32
    // Sideways scoots trace loose circles, with no synchronized resting window.
    activity = 0.55 + 0.45 * Math.max(0, Math.sin(time * 0.32 + phase)) ** 2
    speed = 0.007 * activity
  } else if (zone.motion === 'temple') {
    const angle = time * (0.23 + seed * 0.07) + phase
    x = actor.homeX + Math.sin(angle) * zone.rx * 0.46
    y = actor.homeY + Math.cos(angle * 0.91 + phase) * zone.ry * 0.4
    activity = Math.min(
      1,
      Math.max(0, (Math.sin((time / (19 + seed * 7)) * TAU + phase) + 0.9) * 5)
    )
    speed = 0.0065 * activity
  } else {
    const angle = time * (0.24 + seed * 0.06) + phase
    const radius = 0.55 + seed * 0.14
    x = actor.homeX + Math.sin(angle) * zone.rx * radius
    y = actor.homeY + Math.cos(angle * 0.83 + phase) * zone.ry * radius
    activity =
      0.35 +
      0.65 * Math.max(0, Math.sin((time / (24 + seed * 8)) * TAU + phase)) ** 2
    speed = 0.012 * activity
  }
  if (usesRowStations(zone)) {
    x = Math.max(
      actor.homeX - zone.rx * actor.homeRangeX,
      Math.min(actor.homeX + zone.rx * actor.homeRangeX, x)
    )
    y = Math.max(
      actor.homeY - zone.ry * actor.homeRangeY,
      Math.min(actor.homeY + zone.ry * actor.homeRangeY, y)
    )
  }
  const target = limitPoint(zone, { x, y }, 0.88)
  actor.targetX = target.x
  actor.targetY = target.y
  const dx = target.x - actor.x
  const dy = target.y - actor.y
  const distance = Math.hypot(dx, dy)
  actor.moving =
    activity > 0.015 && Math.min(distance, speed * delta) > delta * 0.0006
  if (distance > 0) {
    const travel = Math.min(distance, speed * delta)
    actor.x += (dx / distance) * travel
    actor.y += (dy / distance) * travel
  }
  return true
}

function constrain(actor) {
  if (usesRowStations(actor.zone)) {
    actor.x = Math.max(
      actor.zone.cx - actor.zone.rx * 0.86,
      actor.homeX - actor.zone.rx * actor.homeRangeX,
      Math.min(
        actor.zone.cx + actor.zone.rx * 0.86,
        actor.homeX + actor.zone.rx * actor.homeRangeX,
        actor.x
      )
    )
    actor.y = Math.max(
      actor.homeY - actor.zone.ry * actor.homeRangeY,
      Math.min(actor.homeY + actor.zone.ry * actor.homeRangeY, actor.y)
    )
  }
  const dx = (actor.x - actor.zone.cx) / actor.zone.rx
  const dy = (actor.y - actor.zone.cy) / actor.zone.ry
  const radius = Math.hypot(dx, dy)
  if (radius > 0.88) {
    actor.x = actor.zone.cx + (dx / radius) * actor.zone.rx * 0.88
    actor.y = actor.zone.cy + (dy / radius) * actor.zone.ry * 0.88
  }
}

/** Zones are authored walkable ellipses. Motion coordinates are normalized. */
export function createMotion(visible, zones) {
  const usableZones = zones.filter(
    ({ cx, cy, rx, ry }) =>
      [cx, cy, rx, ry].every(Number.isFinite) && rx > 0 && ry > 0
  )
  if (usableZones.length === 0) return []
  const groups = new Map()
  for (const visitor of visible) {
    const matching = usableZones.filter((zone) => zone.room === visitor.room)
    const choices = matching.length ? matching : usableZones
    const ranked = choices.map((zone, index) => {
      const capacity =
        Number.isFinite(zone.capacity) && zone.capacity > 0 ? zone.capacity : 1
      return {
        zone,
        score: ((groups.get(zone)?.length ?? 0) + 1) / capacity,
        tie: hash(visitor.index * 31 + index + 7000)
      }
    })
    ranked.sort((a, b) => a.score - b.score || a.tie - b.tie)
    const zone = ranked[0].zone
    if (!groups.has(zone)) groups.set(zone, [])
    groups.get(zone).push(visitor)
  }
  const actors = []
  for (const [zone, visitors] of groups) {
    const offset = hash(visitors[0].index + 8000) * TAU
    visitors.forEach((visitor, ordinal) => {
      const radius = Math.sqrt((ordinal + 0.5) / visitors.length) * 0.8
      let point =
        zone.layout === 'row'
          ? rowStation(zone, visitors.length, ordinal, visitor)
          : pointInZone(zone, radius, ordinal * GOLDEN_ANGLE + offset)
      if (hasRoomMotion(zone) && zone.layout === 'row') {
        point.x +=
          (hash(visitor.index + 13000) - 0.5) *
          zone.rx *
          Math.min(0.12, point.rowSpacing * 0.28)
        point.y += (hash(visitor.index + 14000) - 0.5) * zone.ry * 0.13
        point = limitPoint(zone, point, 0.82)
      }
      actors.push({
        visitor,
        zone,
        ...point,
        targetX: point.x,
        targetY: point.y,
        homeX: point.x,
        homeY: point.y,
        // Summary selection favors low visitor.seed values; a separate hash keeps
        // those visitors from entering their pauses together.
        phase: hash(visitor.index + 15000) * TAU,
        moving: false,
        cycle: -1
      })
    })
  }
  return actors.sort((a, b) => a.visitor.index - b.visitor.index)
}

/** dt and time are seconds. The caller pauses by not stepping the simulation. */
export function stepMotion(actors, dt, time) {
  if (!Number.isFinite(dt) || !Number.isFinite(time) || dt <= 0) return
  const delta = Math.min(dt, 0.05)
  const groups = new Map()
  for (const actor of actors) {
    // Direct manipulation owns held actors; omit them from avoidance groups too.
    if (actor.held || actor.landing) continue
    if (stepRoomMotion(actor, delta, Math.max(0, time))) {
      if (!groups.has(actor.zone)) groups.set(actor.zone, [])
      groups.get(actor.zone).push(actor)
      continue
    }
    const period = 4 + hash(actor.visitor.index + 9000) * 3
    const clock = Math.max(0, time) + (actor.phase / TAU) * period
    const cycle = Math.floor(clock / period)
    // Brief staggered rests keep the camp lively without moving in lockstep.
    const inWalkWindow = (clock % period) / period >= 0.15
    if (actor.cycle !== cycle) {
      const seed = actor.visitor.index * 137 + cycle * 73
      const point =
        actor.zone.layout === 'row'
          ? {
              x: Math.max(
                actor.zone.cx - actor.zone.rx * 0.84,
                Math.min(
                  actor.zone.cx + actor.zone.rx * 0.84,
                  actor.homeX +
                    (hash(seed + 10000) * 2 - 1) *
                      actor.zone.rx *
                      actor.homeRangeX *
                      0.9
                )
              ),
              y:
                actor.homeY +
                (hash(seed + 11000) * 2 - 1) *
                  actor.zone.ry *
                  actor.homeRangeY *
                  0.65
            }
          : pointInZone(
              actor.zone,
              Math.sqrt(hash(seed + 10000)) * 0.76,
              hash(seed + 11000) * TAU
            )
      actor.targetX = point.x
      actor.targetY = point.y
      actor.cycle = cycle
    }
    const dx = actor.targetX - actor.x
    const dy = actor.targetY - actor.y
    const distance = Math.hypot(dx, dy)
    actor.moving = inWalkWindow && distance > 0.001
    if (actor.moving) {
      const speed =
        actor.zone.layout === 'row' ? 0.003 : actor.zone.wet ? 0.007 : 0.012
      const travel = Math.min(distance, speed * delta)
      actor.x += (dx / distance) * travel
      actor.y += (dy / distance) * travel
    }
    if (!groups.has(actor.zone)) groups.set(actor.zone, [])
    groups.get(actor.zone).push(actor)
  }

  // Soft local separation is decorative avoidance, not a rigid-body simulation.
  for (const [zone, neighbours] of groups) {
    const row = usesRowStations(zone)
    const areaClearance = Math.min(0.3, 1.3 / Math.sqrt(neighbours.length))
    const response = Math.min(
      1,
      delta * (zone.motion === 'quiet' || zone.motion === 'source' ? 4 : 12)
    )
    for (let i = 0; i < neighbours.length; i++) {
      for (let j = i + 1; j < neighbours.length; j++) {
        const a = neighbours[i]
        const b = neighbours[j]
        if (row && a.rowIndex !== b.rowIndex) continue
        const clearance = row
          ? Math.min(0.3, a.rowSpacing * 0.85, b.rowSpacing * 0.85)
          : areaClearance
        let dx = (a.x - b.x) / zone.rx
        let dy = row ? 0 : (a.y - b.y) / zone.ry
        let distance = Math.hypot(dx, dy)
        if (distance >= clearance) continue
        if (distance < 0.00001) {
          const angle = hash(a.visitor.index * 31 + b.visitor.index) * TAU
          dx = row
            ? a.homeX <= b.homeX
              ? -0.00001
              : 0.00001
            : Math.cos(angle) * 0.00001
          dy = row ? 0 : Math.sin(angle) * 0.00001
          distance = 0.00001
        }
        const push = ((clearance - distance) / distance) * 0.5 * response
        a.x += dx * push * zone.rx
        a.y += dy * push * zone.ry
        b.x -= dx * push * zone.rx
        b.y -= dy * push * zone.ry
      }
    }
    for (const actor of neighbours) constrain(actor)
  }
}
