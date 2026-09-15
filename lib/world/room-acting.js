const ROOM_ACTING_TAU = Math.PI * 2
const ROOM_ACTING_SCENES = new Set([
  'bathhouse',
  'quiet-house',
  'dream-garden',
  'source',
  'open-studio',
  'hearth',
  'temple'
])

function roomActingIdentity() {
  return { scaleX: 1, scaleY: 1, rotation: 0, lift: 0, receive: 0 }
}

function roomActingTiming(actor, time) {
  const seed = Number.isFinite(actor.visitor?.seed) ? actor.visitor.seed : 0
  return {
    seed,
    phase: Number.isFinite(actor.phase) ? actor.phase : seed * ROOM_ACTING_TAU,
    time: Number.isFinite(time) ? Math.max(0, time) : 0
  }
}

/** Smooth, staggered decorative light envelope; never a measured reward signal. */
export function getReceivePhase(actor, time) {
  if (actor.held || actor.landing) return 0
  const clock = roomActingTiming(actor, time)
  const angle =
    (clock.time / (18 + clock.seed * 7)) * ROOM_ACTING_TAU + clock.phase
  return ((1 - Math.cos(angle)) / 2) ** 3
}

/** Rotation is radians; positive lift is a fraction of the rendered sprite height.
 * Caller owns the visual clock: freezing it freezes the pose without resets.
 * These poses do not infer or change declared rest or other session state.
 */
export function getRoomPose(actor, time, scene) {
  if (!ROOM_ACTING_SCENES.has(scene)) return null
  if (actor.held || actor.landing) return roomActingIdentity()
  const clock = roomActingTiming(actor, time)
  // Room personality accompanies locomotion instead of hiding the walking gait.
  const cadence = scene === 'open-studio' ? 7.2 : scene === 'temple' ? 4.8 : 6
  const stride = actor.moving ? Math.sin(clock.time * cadence + clock.phase) : 0
  const walkTilt = stride * 0.024
  const walkLift = Math.abs(stride) * 0.025
  if (scene === 'bathhouse') {
    const bob = Math.sin(clock.time * (0.9 + clock.seed * 0.3) + clock.phase)
    return {
      scaleX: 1 - bob * 0.006,
      scaleY: 1 + bob * 0.009,
      rotation:
        Math.sin(clock.time * 0.38 + clock.phase) * 0.019 + walkTilt * 0.5,
      lift: (1 + bob) * 0.005 + walkLift * 0.5,
      receive: 0
    }
  }
  if (scene === 'open-studio') {
    // This is decorative acting, never a claim that an agent made an artifact.
    const dab = actor.moving
      ? 0
      : Math.max(0, Math.sin(clock.time * 2.2 + clock.phase)) ** 2
    return {
      scaleX: 1 - dab * 0.012,
      scaleY: 1 + dab * 0.017,
      rotation:
        Math.sin(clock.time * 0.31 + clock.phase) * 0.012 +
        dab * 0.035 +
        walkTilt,
      lift: walkLift,
      receive: 0
    }
  }
  if (scene === 'hearth') {
    const lean = Math.sin(clock.time * 0.24 + clock.phase)
    return {
      scaleX: 1 + lean * 0.005,
      scaleY: 1 - lean * 0.008,
      rotation: lean * 0.023 + walkTilt * 0.85,
      lift: walkLift * 0.8,
      receive: 0
    }
  }
  if (scene === 'temple') {
    const inclination = Math.sin(
      (clock.time / (17 + clock.seed * 8)) * ROOM_ACTING_TAU + clock.phase
    )
    return {
      scaleX: 1 - inclination * 0.003,
      scaleY: 1 + inclination * 0.006,
      rotation: inclination * 0.012 + walkTilt * 0.8,
      lift: walkLift * 0.8,
      receive: 0
    }
  }
  if (scene === 'quiet-house') {
    const breath = Math.sin(
      (clock.time / (7 + clock.seed * 3)) * ROOM_ACTING_TAU + clock.phase
    )
    return {
      scaleX: 1 - breath * 0.004,
      scaleY: 1 + breath * 0.006,
      rotation: Math.sin(clock.time / 17 + clock.phase) * 0.003 + walkTilt,
      lift: walkLift,
      receive: 0
    }
  }
  if (scene === 'dream-garden') {
    const squash = Math.sin(
      (clock.time / (8 + clock.seed * 3)) * ROOM_ACTING_TAU + clock.phase
    )
    return {
      scaleX: 1 + squash * 0.012,
      scaleY: 1 - squash * 0.014,
      rotation:
        Math.sin(clock.time * 0.23 + clock.phase) * 0.035 +
        Math.sin(clock.time * 0.11 + clock.phase * 1.7) * 0.014 +
        walkTilt,
      lift:
        (0.5 + 0.5 * Math.sin(clock.time * 0.41 + clock.phase)) * 0.006 +
        walkLift,
      receive: 0
    }
  }
  const receive = getReceivePhase(actor, clock.time)
  return {
    scaleX: 1 - receive * 0.008,
    scaleY: 1 + receive * 0.02,
    rotation: Math.sin(clock.time / 21 + clock.phase) * 0.004 + walkTilt,
    lift: walkLift,
    receive
  }
}
