import assert from 'node:assert/strict'
import {
  chooseVisible,
  createMotion,
  createPopulation,
  stepMotion
} from './crowd.js'
import { DETAIL_ROOMS } from './room-details.js'
import { getReceivePhase, getRoomPose } from './room-acting.js'

const scenes = [
  'bathhouse',
  'quiet-house',
  'dream-garden',
  'source',
  'open-studio',
  'hearth',
  'temple'
]
const motions = [
  'bath',
  'quiet',
  'dream',
  'source',
  'studio',
  'hearth',
  'temple'
]
const visitors = createPopulation(100)
const zone = {
  key: 'study',
  cx: 0.5,
  cy: 0.5,
  rx: 0.35,
  ry: 0.25,
  layout: 'scatter'
}
const specimen = createMotion(visitors.slice(0, 1), [zone])[0]
const snapshot = structuredClone(specimen)
assert.equal(getRoomPose(specimen, 5, 'camp'), null)
assert.equal(getRoomPose(specimen, 5, 'unrecognized'), null)
for (const scene of scenes) {
  for (let second = 0; second < 100; second++) {
    const pose = getRoomPose(specimen, second, scene)
    assert.ok(Object.values(pose).every(Number.isFinite))
    assert.ok(pose.scaleX >= 0.98 && pose.scaleX <= 1.02)
    assert.ok(pose.scaleY >= 0.98 && pose.scaleY <= 1.025)
    assert.ok(Math.abs(pose.rotation) <= 0.05)
    assert.ok(pose.lift >= 0 && pose.lift <= 0.0101)
    assert.ok(pose.receive >= 0 && pose.receive <= 1)
    if (scene === 'quiet-house')
      assert.equal(pose.lift, 0, 'Quiet bodies remain grounded')
    assert.deepEqual(
      pose,
      getRoomPose(specimen, second, scene),
      'A frozen clock yields an identical pose'
    )
    const later = getRoomPose(specimen, second + 0.00001, scene)
    for (const key of Object.keys(pose))
      assert.ok(
        Math.abs(later[key] - pose[key]) < 0.00001,
        'Pose phase is continuous'
      )
  }
}
assert.deepEqual(
  specimen,
  snapshot,
  'Pose calculation never mutates visitor or motion state'
)
for (const visitor of visitors) {
  const actor = { visitor, phase: visitor.seed * Math.PI * 2 }
  const period = 18 + visitor.seed * 7
  const wrap = period * (2 - visitor.seed)
  assert.ok(
    Math.abs(
      getReceivePhase(actor, wrap - 0.00001) -
        getReceivePhase(actor, wrap + 0.00001)
    ) < 0.00001
  )
}
assert.ok(
  new Set(visitors.map((visitor) => getReceivePhase({ visitor }, 7).toFixed(4)))
    .size > 70,
  'Receiving cycles are staggered across visitors'
)
specimen.held = true
for (const scene of scenes)
  assert.deepEqual(getRoomPose(specimen, 123, scene), {
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    lift: 0,
    receive: 0
  })
assert.equal(getReceivePhase(specimen, 123), 0)

specimen.held = false
specimen.landing = true
for (const scene of scenes) {
  assert.deepEqual(getRoomPose(specimen, 123, scene), {
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    lift: 0,
    receive: 0
  })
}
assert.equal(getReceivePhase(specimen, 123), 0)
specimen.landing = false
specimen.moving = true
for (const scene of scenes) {
  const walking = getRoomPose(specimen, 1, scene)
  specimen.moving = false
  const idle = getRoomPose(specimen, 1, scene)
  assert.ok(walking.lift > idle.lift, `${scene}: walking adds a visible gait`)
  assert.notEqual(walking.rotation, idle.rotation)
  specimen.moving = true
}
const distances = {}
for (const motion of motions) {
  const [actor] = createMotion(visitors.slice(0, 1), [{ ...zone, motion }])
  const home = { x: actor.homeX, y: actor.homeY }
  let distance = 0
  for (let frame = 0; frame < 1800; frame++) {
    const before = { x: actor.x, y: actor.y }
    stepMotion([actor], 1 / 60, frame / 60)
    distance += Math.hypot(actor.x - before.x, actor.y - before.y)
    assert.ok(
      Math.hypot(
        (actor.x - zone.cx) / zone.rx,
        (actor.y - zone.cy) / zone.ry
      ) <= 0.880001
    )
  }
  distances[motion] = distance
  assert.equal(actor.homeX, home.x)
  assert.equal(actor.homeY, home.y)
  actor.held = true
  const held = structuredClone(actor)
  stepMotion([actor], 0.05, 99)
  assert.deepEqual(actor, held)
  actor.held = false
  actor.landing = true
  const landing = structuredClone(actor)
  stepMotion([actor], 0.05, 99)
  assert.deepEqual(
    actor,
    landing,
    'Landing owns position until recovery completes'
  )
  actor.landing = false
  actor.x = actor.homeX = 0.51
  actor.y = actor.homeY = 0.49
  stepMotion([actor], 1 / 60, 100)
  assert.ok(
    Math.hypot(actor.x - 0.51, actor.y - 0.49) < 0.001,
    'Drag reanchoring does not snap back to old home'
  )
}
assert.ok(
  distances.dream > distances.quiet,
  'Dream wandering covers more ground than Quiet strolls'
)
assert.ok(
  distances.dream > distances.source,
  'Source receiving rests keep travel calmer than Dream wandering'
)

for (const motion of motions) {
  for (const layout of ['row', 'scatter']) {
    const crowd = createMotion(visitors, [{ ...zone, motion, layout }])
    assert.equal(
      new Set(crowd.map((actor) => `${actor.x},${actor.y}`)).size,
      100
    )
    for (let frame = 0; frame < 200; frame++) {
      stepMotion(crowd, 0.05, frame * 0.25)
      for (const actor of crowd) {
        assert.ok(
          [actor.x, actor.y, actor.targetX, actor.targetY].every(
            Number.isFinite
          )
        )
        assert.ok(
          Math.hypot(
            (actor.x - zone.cx) / zone.rx,
            (actor.y - zone.cy) / zone.ry
          ) <= 0.880001
        )
      }
    }
  }
}
const originalCrowd = createMotion(visitors.slice(0, 20), [zone])
const unspecifiedCrowd = createMotion(visitors.slice(0, 20), [
  { ...zone, motion: 'unrecognized' }
])
for (let frame = 0; frame < 200; frame++) {
  stepMotion(originalCrowd, 0.05, frame * 0.25)
  stepMotion(unspecifiedCrowd, 0.05, frame * 0.25)
}
assert.deepEqual(
  originalCrowd.map(({ x, y, moving }) => ({ x, y, moving })),
  unspecifiedCrowd.map(({ x, y, moving }) => ({ x, y, moving })),
  'Unconfigured rooms retain the existing movement behavior'
)
// A low-attendance room must not appear to freeze as its first targets settle.
for (const scene of scenes) {
  const room = DETAIL_ROOMS[scene]
  assert.ok(room, `${scene}: authored movement zones are configured`)
  const visible = chooseVisible(createPopulation(60), {
    scene,
    mode: 'summary'
  }).visible
  const actors = createMotion(
    visible,
    room.zones.map((item) => ({ ...item, room: room.room }))
  )
  let allIdleFrames = 0
  for (let frame = 0; frame < 140 * 60; frame++) {
    stepMotion(actors, 1 / 60, frame / 60)
    allIdleFrames = actors.some((actor) => actor.moving) ? 0 : allIdleFrames + 1
    assert.ok(
      allIdleFrames < 60,
      `${scene}: independent activity phases prevent a room-wide freeze`
    )
  }
}
// Measure actual authored rooms at a 1000px display width. Initial placement
// settling cannot satisfy this: later windows must still contain visible travel.
const movementWindows = [
  [0, 10],
  [10, 20],
  [40, 60],
  [120, 140]
]
for (const scene of scenes) {
  const room = DETAIL_ROOMS[scene]
  assert.ok(room, `${scene}: authored movement zones are configured`)
  for (const mode of ['summary', 'full']) {
    const visible = chooseVisible(createPopulation(1000), {
      scene,
      mode
    }).visible
    const actors = createMotion(
      visible,
      room.zones.map((item) => ({ ...item, room: room.room }))
    )
    let ranges = null
    for (let frame = 0; frame < 140 * 60; frame++) {
      if (movementWindows.some(([start]) => start * 60 === frame)) {
        ranges = actors.map((actor) => ({
          minX: actor.x,
          maxX: actor.x,
          minY: actor.y,
          maxY: actor.y
        }))
      }
      stepMotion(actors, 1 / 60, frame / 60)
      if (ranges)
        actors.forEach((actor, index) => {
          const range = ranges[index]
          range.minX = Math.min(range.minX, actor.x)
          range.maxX = Math.max(range.maxX, actor.x)
          range.minY = Math.min(range.minY, actor.y)
          range.maxY = Math.max(range.maxY, actor.y)
        })
      const window = movementWindows.find(([, end]) => end * 60 === frame + 1)
      if (window) {
        const pixels = ranges
          .map((range) =>
            Math.hypot(
              (range.maxX - range.minX) * 1000,
              ((range.maxY - range.minY) * 1000 * 1024) / 1536
            )
          )
          .sort((a, b) => a - b)
        assert.ok(
          pixels[Math.floor(pixels.length / 2)] >= 12,
          `${scene} ${mode}: sustained visible travel during ${window.join('–')}s, median ${pixels[Math.floor(pixels.length / 2)].toFixed(2)}px`
        )
        assert.ok(
          pixels.filter((distance) => distance >= 5).length >=
            actors.length * 0.9,
          `${scene} ${mode}: at least 90% keep roaming during ${window.join('–')}s`
        )
        ranges = null
      }
    }
  }
}
console.log(
  'Room acting checks passed: sustained roaming across all seven authored rooms, buoyant Bathhouse drift and visible walking gait, staggered Source rests, frozen-clock continuity, bounded crowds and held/landing isolation.'
)
