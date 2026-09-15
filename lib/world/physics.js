/** Local decorative dragging; it never changes visitor room or session state. */
export function createPhysics(
  actors,
  {
    width = 1536,
    height = 1024,
    radius = 14,
    floorScale = 0.45,
    zones = [],
    allowZoneTransfer = false
  } = {}
) {
  const positive = (value, fallback) =>
    Number.isFinite(value) && value > 0 ? value : fallback
  const worldWidth = positive(width, 1536)
  const sceneHeight = positive(height, 1024)
  const verticalScale = positive(floorScale, 0.45)
  const worldHeight = sceneHeight / verticalScale
  const bodyRadius = positive(radius, 14)
  const diameter = bodyRadius * 2
  const limit = 0.88
  const speedLimit = 100
  const stopSpeed = 0.8
  const groups = new Map()
  const activeGroups = new Set()
  const touched = new Set()
  const bodies = []
  const byId = new Map()
  const landings = new Map()
  const validZone = (zone) =>
    zone &&
    [zone.cx, zone.cy, zone.rx, zone.ry].every(Number.isFinite) &&
    zone.rx > 0 &&
    zone.ry > 0
  const availableZones = [
    ...new Map(
      [...zones, ...actors.map((actor) => actor.zone)]
        .filter(validZone)
        .map((zone) => [zone.key ?? zone, zone])
    ).values()
  ]
  let held = null
  let target = null
  let active = false
  let settleTime = 0
  let quietFrames = 0
  let generation = 0

  for (const actor of actors) {
    const zone = actor.zone
    if (!validZone(zone)) continue
    const key = zone.key ?? zone
    if (!groups.has(key)) groups.set(key, [])
    const body = {
      actor,
      group: key,
      index: bodies.length,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0
    }
    bodies.push(body)
    groups.get(key).push(body)
    byId.set(actor.visitor.id, body)
  }

  function clamp(body) {
    if ((allowZoneTransfer && body === held) || landings.has(body)) return false
    const previousX = body.x
    const previousY = body.y
    const zone = body.actor.zone
    const cx = zone.cx * worldWidth
    const cy = zone.cy * worldHeight
    const rx = zone.rx * worldWidth
    const ry = zone.ry * worldHeight
    if (!Number.isFinite(body.x) || !Number.isFinite(body.y)) {
      body.x = cx
      body.y = cy
      body.vx = 0
      body.vy = 0
    }
    const dx = (body.x - cx) / rx
    const dy = (body.y - cy) / ry
    const distance = Math.hypot(dx, dy)
    if (distance <= limit) return body.x !== previousX || body.y !== previousY
    body.x = cx + (dx / distance) * rx * limit
    body.y = cy + (dy / distance) * ry * limit
    // Do not retain an outward velocity against the architectural boundary.
    const nx = dx / rx
    const ny = dy / ry
    const normalSquared = nx * nx + ny * ny
    const outward = body.vx * nx + body.vy * ny
    if (outward > 0 && normalSquared > 0) {
      body.vx -= (outward / normalSquared) * nx
      body.vy -= (outward / normalSquared) * ny
    }
    return true
  }

  function setGroup(body, zone) {
    const key = zone ? (zone.key ?? zone) : null
    if (body.group !== key) {
      const oldGroup = groups.get(body.group)
      if (oldGroup) oldGroup.splice(oldGroup.indexOf(body), 1)
      body.group = key
      if (key !== null) {
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(body)
      }
    }
    if (key !== null) activeGroups.add(key)
  }

  function surfaceAt(x, y) {
    // Small raised pads win over a larger floor beneath them; only the selected
    // surface collides with the held body, so visually overlapping levels stay separate.
    let surface = null
    let area = Infinity
    for (const zone of availableZones) {
      const distance = Math.hypot(
        (x / worldWidth - zone.cx) / zone.rx,
        (y / worldHeight - zone.cy) / zone.ry
      )
      if (distance <= 1 && zone.rx * zone.ry < area) {
        surface = zone
        area = zone.rx * zone.ry
      }
    }
    return surface
  }

  function safePoint(zone, x, y) {
    const cx = zone.cx * worldWidth
    const cy = zone.cy * sceneHeight
    const rx = zone.rx * worldWidth * limit
    const ry = zone.ry * sceneHeight * limit
    const dx = x - cx
    const dy = y * verticalScale - cy
    if (Math.hypot(dx / rx, dy / ry) <= 1) return { x, y, distance: 0 }
    // Closest point on the inset ellipse in visible pixels, rather than a radial
    // projection that sends a drop beside a long bench toward its far end.
    let low = 0
    let high = Math.hypot(rx * dx, ry * dy)
    for (let i = 0; i < 40; i++) {
      const mid = (low + high) / 2
      const distance = Math.hypot(
        (rx * dx) / (mid + rx * rx),
        (ry * dy) / (mid + ry * ry)
      )
      if (distance > 1) low = mid
      else high = mid
    }
    const px = cx + (rx * rx * dx) / (high + rx * rx)
    const py = cy + (ry * ry * dy) / (high + ry * ry)
    return {
      x: px,
      y: py / verticalScale,
      distance: Math.hypot(px - x, py - y * verticalScale)
    }
  }

  function destinationFor(body) {
    const containing = surfaceAt(body.x, body.y)
    if (containing)
      return { zone: containing, ...safePoint(containing, body.x, body.y) }
    let nearest = null
    for (const zone of availableZones) {
      const point = safePoint(zone, body.x, body.y)
      if (!nearest || point.distance < nearest.distance)
        nearest = { zone, ...point }
    }
    return nearest
  }

  function adoptZone(body, zone) {
    const actor = body.actor
    actor.zone = zone
    setGroup(body, zone)
    if (zone.layout === 'row') {
      const peers = groups.get(body.group).filter((peer) => peer !== body)
      const closest = peers.reduce(
        (best, peer) =>
          !best ||
          Math.abs(peer.actor.y - actor.y) < Math.abs(best.actor.y - actor.y)
            ? peer
            : best,
        null
      )
      actor.rowIndex = closest?.actor.rowIndex ?? 0
      actor.rowSpacing =
        closest?.actor.rowSpacing ?? Math.min(0.3, 1.6 / (peers.length + 1))
      actor.homeRangeX = Math.min(0.2, actor.rowSpacing * 0.22)
      actor.homeRangeY = 0.025
    } else {
      delete actor.rowIndex
      delete actor.rowSpacing
      delete actor.homeRangeX
      delete actor.homeRangeY
    }
  }

  function finishLanding(body) {
    const landing = landings.get(body)
    if (!landing) return
    body.x = landing.toX
    body.y = landing.toY
    landings.delete(body)
    body.actor.landing = 0
    clamp(body)
    syncActor(body)
  }

  function releaseHeld() {
    if (!held) return
    const body = held
    const originalZone = body.actor.zone
    body.vx = body.vy = 0
    body.actor.held = false
    held = null
    target = null
    let landing = false
    if (allowZoneTransfer) {
      const destination = destinationFor(body)
      if (destination) {
        adoptZone(body, destination.zone)
        if (destination.distance > 0.25) {
          landings.set(body, {
            fromX: body.x,
            fromY: body.y,
            toX: destination.x,
            toY: destination.y,
            time: 0,
            duration: 0.35 + Math.min(0.4, destination.distance / 900)
          })
          body.actor.landing = 1
          landing = true
        } else {
          body.x = destination.x
          body.y = destination.y
        }
      }
    }
    syncActor(body)
    settleTime = 0
    quietFrames = 0
    return {
      id: body.actor.visitor.id,
      zone: body.actor.zone,
      transferred: body.actor.zone !== originalZone,
      landing
    }
  }

  function limitVelocity(body) {
    const speed = Math.hypot(body.vx, body.vy)
    if (!Number.isFinite(speed)) {
      body.vx = 0
      body.vy = 0
    } else if (speed > speedLimit) {
      body.vx = (body.vx / speed) * speedLimit
      body.vy = (body.vy / speed) * speedLimit
    }
  }

  function syncActor(body) {
    const actor = body.actor
    actor.x = body.x / worldWidth
    actor.y = body.y / worldHeight
    actor.homeX = actor.targetX = actor.x
    actor.homeY = actor.targetY = actor.y
    actor.moving = false
  }

  function synchronize() {
    for (const body of bodies) {
      body.x = body.actor.x * worldWidth
      body.y = body.actor.y * worldHeight
      body.vx = 0
      body.vy = 0
      clamp(body)
    }
  }

  function solve(delta) {
    let largestCorrection = 0
    for (const key of activeGroups) {
      const neighbours = groups.get(key)
      const grid = new Map()
      for (const body of neighbours) {
        const key = `${Math.floor(body.x / diameter)},${Math.floor(body.y / diameter)}`
        if (!grid.has(key)) grid.set(key, [])
        grid.get(key).push(body)
      }
      for (const body of neighbours) {
        const gx = Math.floor(body.x / diameter)
        const gy = Math.floor(body.y / diameter)
        let scans = 0
        // The scan bound also covers degenerate crowds occupying one grid cell.
        cells: for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const bucket = grid.get(`${gx + ox},${gy + oy}`)
            if (!bucket) continue
            const start = (body.index * 31 + generation) % bucket.length
            for (let k = 0; k < bucket.length; k++) {
              if (++scans > 64) break cells
              const other = bucket[(start + k) % bucket.length]
              if (other.index <= body.index) continue
              let dx = other.x - body.x
              let dy = other.y - body.y
              let distance = Math.hypot(dx, dy)
              if (distance >= diameter) continue
              if (distance < 0.00001) {
                const angle = (body.index * 137.508 + other.index * 47.3) % 360
                dx = Math.cos((angle * Math.PI) / 180)
                dy = Math.sin((angle * Math.PI) / 180)
                distance = 1
              } else {
                dx /= distance
                dy /= distance
              }
              const inverseA = body === held || landings.has(body) ? 0 : 1
              const inverseB = other === held || landings.has(other) ? 0 : 1
              const total = inverseA + inverseB
              if (!total) continue
              const correction =
                Math.min(bodyRadius, diameter - distance) * 0.72
              const a = (correction * inverseA) / total
              const b = (correction * inverseB) / total
              body.x -= dx * a
              body.y -= dy * a
              other.x += dx * b
              other.y += dy * b
              if (a > 0.000001) touched.add(body)
              if (b > 0.000001) touched.add(other)
              // Position correction creates only a small, heavily damped nudge.
              body.vx -= (dx * a * 0.12) / delta
              body.vy -= (dy * a * 0.12) / delta
              other.vx += (dx * b * 0.12) / delta
              other.vy += (dy * b * 0.12) / delta
              largestCorrection = Math.max(largestCorrection, a, b)
            }
          }
        }
      }
    }
    for (const body of bodies) {
      if (!activeGroups.has(body.group)) continue
      if (clamp(body)) touched.add(body)
      limitVelocity(body)
    }
    return largestCorrection
  }

  function settle() {
    for (const body of bodies) {
      if (!activeGroups.has(body.group)) continue
      body.vx = 0
      body.vy = 0
    }
    active = false
    activeGroups.clear()
    quietFrames = 0
  }

  return {
    get heldId() {
      return held?.actor.visitor.id ?? null
    },
    grab(id) {
      const body = byId.get(id)
      if (!body) return false
      if (!active) synchronize()
      if (held && held !== body) releaseHeld()
      const interruptedLanding = landings.delete(body)
      body.actor.landing = 0
      if (held !== body) {
        body.x = body.actor.x * worldWidth
        body.y = body.actor.y * worldHeight
        if (!interruptedLanding) clamp(body)
      }
      held = body
      held.actor.held = true
      syncActor(held)
      if (body.group !== null) activeGroups.add(body.group)
      held.vx = held.vy = 0
      target = { x: held.x, y: held.y }
      active = true
      settleTime = 0
      quietFrames = 0
      return true
    },
    move(x, y) {
      if (!held || !Number.isFinite(x) || !Number.isFinite(y)) return
      const point = {
        actor: held.actor,
        x: x * worldWidth,
        y: y * worldHeight,
        vx: 0,
        vy: 0
      }
      if (allowZoneTransfer) {
        const margin = 0.015
        point.x = Math.max(
          worldWidth * margin,
          Math.min(worldWidth * (1 - margin), point.x)
        )
        point.y = Math.max(
          worldHeight * margin,
          Math.min(worldHeight * (1 - margin), point.y)
        )
      } else clamp(point)
      target = { x: point.x, y: point.y }
    },
    release: releaseHeld,
    step(dt = 1 / 60) {
      if (!active) return false
      // Pointer updates remain usable while the visual clock is paused.
      const delta = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.05) : 1 / 60
      const damping = Math.exp(-18 * delta)
      touched.clear()
      if (held) touched.add(held)
      for (const body of bodies) {
        if (body === held) continue
        const landing = landings.get(body)
        if (landing) {
          landing.time += delta
          const progress = Math.min(1, landing.time / landing.duration)
          const eased = progress * progress * (3 - 2 * progress)
          body.x = landing.fromX + (landing.toX - landing.fromX) * eased
          body.y = landing.fromY + (landing.toY - landing.fromY) * eased
          body.actor.landing = 1 - progress
          touched.add(body)
          if (progress === 1) finishLanding(body)
          continue
        }
        // Autonomous movement has already advanced this actor for this frame.
        body.x = body.actor.x * worldWidth
        body.y = body.actor.y * worldHeight
        if (!activeGroups.has(body.group)) continue
        body.vx *= damping
        body.vy *= damping
        const dx = body.vx * delta
        const dy = body.vy * delta
        body.x += dx
        body.y += dy
        const constrained = clamp(body)
        if (constrained || Math.abs(dx) > 0.000001 || Math.abs(dy) > 0.000001)
          touched.add(body)
      }
      const origin = held && { x: held.x, y: held.y }
      let correction = 0
      // Four bounded passes sweep the held body toward its latest pointer target.
      for (let pass = 1; pass <= 4; pass++) {
        if (held) {
          held.x = origin.x + ((target.x - origin.x) * pass) / 4
          held.y = origin.y + ((target.y - origin.y) * pass) / 4
          held.vx = held.vy = 0
          if (allowZoneTransfer) setGroup(held, surfaceAt(held.x, held.y))
        }
        correction = solve(delta)
        generation++
      }
      let speed = 0
      for (const body of bodies) {
        if (!activeGroups.has(body.group) && body !== held) continue
        if (touched.has(body)) syncActor(body)
        speed = Math.max(speed, Math.hypot(body.vx, body.vy))
      }
      if (!held) {
        settleTime += delta
        quietFrames =
          speed < stopSpeed && correction < 0.12 ? quietFrames + 1 : 0
        // Overfilled test zones may retain overlap; they must not jitter forever.
        if (landings.size === 0 && (quietFrames >= 3 || settleTime >= 1.25))
          settle()
      }
      return active
    },
    dispose() {
      if (held) releaseHeld()
      for (const body of landings.keys()) finishLanding(body)
      held = null
      target = null
      active = false
      bodies.length = 0
      groups.clear()
      activeGroups.clear()
      touched.clear()
      byId.clear()
    }
  }
}
