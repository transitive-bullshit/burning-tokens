import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'

import {
  chooseVisible,
  createMotion,
  createPopulation,
  stepMotion
} from './crowd.js'
import { createPhysics } from './physics.js'
import { DETAIL_ROOMS } from './room-details.js'

const zone = { key: 'pool', cx: 0.5, cy: 0.5, rx: 0.3, ry: 0.15 }
const actor = (id, x, y, area = zone) => ({
  visitor: { id },
  zone: area,
  x,
  y,
  homeX: x,
  homeY: y,
  targetX: x,
  targetY: y
})
const bounded = (actors) => {
  for (const item of actors) {
    assert.ok([item.x, item.y, item.homeX, item.homeY].every(Number.isFinite))
    assert.ok(
      Math.hypot(
        (item.x - item.zone.cx) / item.zone.rx,
        (item.y - item.zone.cy) / item.zone.ry
      ) <= 0.880001,
      `${item.visitor.id} stays within its original zone`
    )
  }
}

const visitors = [actor('held', 0.4, 0.5), actor('neighbour', 0.47, 0.5)]
const otherZone = { ...zone, key: 'another-pool' }
visitors.push(actor('separate', 0.47, 0.5, otherZone))
visitors.push(actor('separate-overlap', 0.47, 0.5, otherZone))
const physics = createPhysics(visitors, { radius: 20 })
assert.equal(physics.grab('missing'), false)
assert.equal(physics.heldId, null)
assert.equal(physics.grab('held'), true)
assert.equal(visitors[0].held, true)
physics.move(0.46, 0.5)
assert.equal(physics.step(0), true)
assert.equal(physics.heldId, 'held')
assert.ok(Math.abs(visitors[0].x - 0.46) < 0.00001, 'held follows pointer')
assert.ok(visitors[1].x > 0.47, 'a nearby body is pushed')
assert.equal(visitors[2].x, 0.47, 'other zones do not collide')
assert.equal(
  visitors[3].x,
  0.47,
  'unrelated overlapping groups stay undisturbed'
)

physics.move(2, -3)
physics.step(1 / 60)
bounded(visitors)
physics.move(NaN, Infinity)
for (let step = 0; step < 100; step++) physics.step(1 / 60)
bounded(visitors)
physics.release()
assert.equal(physics.heldId, null)
assert.equal(visitors[0].held, false)
let active = true
let steps = 0
while (active && steps++ < 200) active = physics.step(1 / 60)
assert.equal(active, false, 'released bodies finish settling')
for (const item of visitors) {
  assert.equal(item.homeX, item.x)
  assert.equal(item.homeY, item.y)
  assert.equal(item.targetX, item.x)
  assert.equal(item.targetY, item.y)
}

// Idle controllers must read current autonomous positions when picked up again.
visitors[0].x = 0.45
visitors[0].y = 0.49
assert.equal(physics.grab('held'), true)
physics.step(0)
assert.ok(Math.abs(visitors[0].x - 0.45) < 0.00001)
physics.release()
physics.dispose()
assert.equal(physics.step(1 / 60), false)
assert.equal(physics.grab('held'), false)

// The caller advances autonomous motion first, then applies local drag physics.
const concurrent = [
  actor('picked-up', 0.4, 0.5),
  actor('contact', 0.46, 0.5),
  actor('walking-here', 0.64, 0.53),
  actor('walking-elsewhere', 0.6, 0.48, otherZone)
]
const walkers = concurrent.slice(2)
for (const item of walkers) {
  item.targetX = 0.72
  item.targetY = 0.54
  item.moving = true
}
const originalHomes = walkers.map((item) => [item.homeX, item.homeY])
const simultaneous = createPhysics(concurrent, { radius: 16 })
assert.equal(simultaneous.grab('picked-up'), true)
const advanceWalkers = () => {
  const expected = walkers.map((item) => {
    item.x += 0.0001
    item.y += 0.00003
    return [item.x, item.y]
  })
  simultaneous.step(1 / 60)
  walkers.forEach((item, i) => {
    assert.equal(item.x, expected[i][0], 'autonomous x survives physics')
    assert.equal(item.y, expected[i][1], 'autonomous y survives physics')
    assert.equal(item.targetX, 0.72, 'noncontact target survives physics')
    assert.equal(item.targetY, 0.54)
    assert.equal(
      item.homeX,
      originalHomes[i][0],
      'noncontact home is unchanged'
    )
    assert.equal(item.homeY, originalHomes[i][1])
    assert.equal(item.moving, true, 'distant actors keep walking')
  })
}
for (let frame = 0; frame < 50; frame++) {
  simultaneous.move(0.45 + Math.sin(frame / 12) * 0.01, 0.5)
  advanceWalkers()
}
assert.equal(concurrent[0].held, true)
simultaneous.release()
assert.equal(concurrent[0].held, false)
for (let frame = 0; frame < 100; frame++) advanceWalkers()
assert.equal(simultaneous.step(1 / 60), false)
assert.equal(simultaneous.grab('walking-here'), true)
assert.equal(concurrent[2].held, true)
simultaneous.dispose()
assert.equal(
  concurrent[2].held,
  false,
  'disposing a gesture releases its actor'
)

// Interior dragging crosses authored surfaces, including currently empty ones.
const left = { key: 'left', cx: 0.2, cy: 0.5, rx: 0.12, ry: 0.12 }
const right = { key: 'right', cx: 0.7, cy: 0.5, rx: 0.14, ry: 0.12 }
const empty = {
  key: 'empty',
  cx: 0.5,
  cy: 0.2,
  rx: 0.12,
  ry: 0.05,
  layout: 'row'
}
const crossing = [
  actor('traveller', 0.2, 0.5, left),
  actor('destination-neighbour', 0.7, 0.5, right),
  actor('distant-walker', 0.76, 0.55, right)
]
crossing[0].visitor.room = 'bathhouse'
const originalVisitor = JSON.stringify(crossing[0].visitor)
const transfers = createPhysics(crossing, {
  radius: 16,
  zones: [left, right, empty],
  allowZoneTransfer: true
})
transfers.grab('traveller')
transfers.move(0.69, 0.5)
transfers.step(0)
assert.ok(
  Math.abs(crossing[0].x - 0.69) < 0.00001,
  'interior holds cross zone boundaries'
)
assert.ok(crossing[1].x > 0.7, 'held body nudges destination neighbours')
const landingInZone = transfers.release()
assert.equal(landingInZone.zone, right)
assert.equal(landingInZone.transferred, true)
assert.equal(landingInZone.landing, false)
assert.equal(crossing[0].zone, right)
assert.equal(crossing[0].homeX, crossing[0].x)
assert.equal(
  JSON.stringify(crossing[0].visitor),
  originalVisitor,
  'visual transfer preserves visitor metadata'
)

transfers.grab('traveller')
transfers.move(0.49, 0.2)
transfers.step(0)
const emptyLanding = transfers.release()
assert.equal(emptyLanding.zone, empty, 'empty zones are valid destinations')
assert.ok(
  [
    crossing[0].rowIndex,
    crossing[0].rowSpacing,
    crossing[0].homeRangeX,
    crossing[0].homeRangeY
  ].every(Number.isFinite),
  'row geometry follows the destination'
)

transfers.grab('traveller')
transfers.move(0.52, 0.08)
transfers.step(0)
const dropPoint = { x: crossing[0].x, y: crossing[0].y }
const landingOutside = transfers.release()
assert.equal(landingOutside.zone, empty)
assert.equal(landingOutside.landing, true)
assert.equal(crossing[0].x, dropPoint.x, 'release does not teleport')
assert.equal(crossing[0].y, dropPoint.y)
assert.ok(crossing[0].landing > 0)
transfers.step(0)
assert.ok(
  crossing[0].y > dropPoint.y && crossing[0].y < 0.15,
  'paused landing advances gently toward the floor'
)
for (let i = 0; i < 120; i++) {
  crossing[2].x += 0.00001
  const expectedX = crossing[2].x
  transfers.step(1 / 60)
  assert.equal(
    crossing[2].x,
    expectedX,
    'noncontact visitors keep moving through a landing'
  )
}
assert.equal(Boolean(crossing[0].landing), false)
bounded(crossing.slice(0, 2))
assert.equal(
  transfers.step(1 / 60),
  false,
  'cross-zone landing finishes settling'
)
assert.equal(JSON.stringify(crossing[0].visitor), originalVisitor)

// A new pickup can interrupt a landing without snapping; disposal finishes safely.
transfers.grab('traveller')
transfers.move(0.5, 0.01)
transfers.step(0)
transfers.release()
transfers.step(1 / 60)
const airborneY = crossing[0].y
transfers.grab('traveller')
assert.ok(Math.abs(crossing[0].y - airborneY) < 0.00001)
assert.equal(Boolean(crossing[0].landing), false)
transfers.move(0.5, 0.01)
transfers.step(0)
transfers.release()
transfers.dispose()
assert.equal(Boolean(crossing[0].landing), false)
bounded(crossing.slice(0, 2))

// Nested visual levels choose one surface; a drag does not disturb actors beneath it.
const lowerFloor = { ...right, key: 'lower-floor', rx: 0.2, ry: 0.2 }
const raisedPad = { ...right, key: 'raised-pad', rx: 0.08, ry: 0.08 }
const layered = [
  actor('lifted', 0.2, 0.5, left),
  actor('on-pad', 0.7, 0.5, raisedPad),
  actor('under-pad', 0.7, 0.5, lowerFloor)
]
const layerPhysics = createPhysics(layered, {
  zones: [left, lowerFloor, raisedPad],
  allowZoneTransfer: true
})
layerPhysics.grab('lifted')
layerPhysics.move(0.695, 0.5)
layerPhysics.step(0)
assert.ok(layered[1].x > 0.7, 'the hovered raised pad receives collisions')
assert.equal(
  layered[2].x,
  0.7,
  'a different overlapping level stays undisturbed'
)
assert.equal(layerPhysics.release().zone, raisedPad)
layerPhysics.grab('lifted')
layerPhysics.move(2, -3)
layerPhysics.step(0)
assert.ok(
  layered[0].x <= 0.985 && layered[0].y >= 0.015,
  'free holds stay within canvas margins'
)
assert.equal(
  layerPhysics.grab('lifted'),
  true,
  'repeated pickup outside surfaces stays valid'
)
layerPhysics.move(NaN, Infinity)
layerPhysics.step(0)
layerPhysics.release()
layerPhysics.dispose()
bounded(layered.slice(0, 2))

// Production ordering matters: autonomous motion runs before drag/landing physics.
// These real room crowds guard against a profile or avoidance pass snapping a
// held actor back to its previous zone, or freezing the rest of the room.
for (const scene of Object.keys(DETAIL_ROOMS)) {
  const population = createPopulation(1000)
  const originalMetadata = JSON.stringify(population)
  const room = DETAIL_ROOMS[scene]
  const roomActors = createMotion(
    chooseVisible(population, { scene, mode: 'full' }).visible,
    room.zones
  )
  const traveller = roomActors[0]
  const destination = room.zones.find((area) => area.key !== traveller.zone.key)
  const roomPhysics = createPhysics(roomActors, {
    zones: room.zones,
    allowZoneTransfer: true,
    radius: 12
  })
  let elapsed = 0
  const frame = () => {
    elapsed += 1 / 60
    const controlled = traveller.held || traveller.landing
    const prior = [traveller.x, traveller.y]
    stepMotion(roomActors, 1 / 60, elapsed)
    if (controlled)
      assert.deepEqual(
        [traveller.x, traveller.y],
        prior,
        `${scene}: crowd leaves held and landing positions to physics`
      )
    roomPhysics.step(1 / 60)
  }
  roomPhysics.grab(traveller.visitor.id)
  roomPhysics.move(destination.cx, destination.cy)
  frame()
  assert.ok(
    Math.abs(traveller.x - destination.cx) < 0.000001,
    `${scene}: held creature reaches another movement zone`
  )
  assert.equal(roomPhysics.release().zone, destination)
  assert.equal(traveller.zone, destination)

  roomPhysics.grab(traveller.visitor.id)
  roomPhysics.move(0.02, 0.98)
  frame()
  assert.ok(Math.abs(traveller.x - 0.02) < 0.000001)
  assert.ok(Math.abs(traveller.y - 0.98) < 0.000001)
  const travel = new Map(roomActors.slice(1).map((item) => [item, 0]))
  const recordFrame = () => {
    const previous = new Map(
      [...travel.keys()].map((item) => [item, [item.x, item.y]])
    )
    frame()
    for (const [item, point] of previous)
      travel.set(
        item,
        travel.get(item) +
          Math.hypot((item.x - point[0]) * 1536, (item.y - point[1]) * 1024)
      )
  }
  for (let i = 0; i < 300; i++) recordFrame()
  const duringHold = [...travel.values()].sort((a, b) => a - b)
  assert.ok(
    duringHold[Math.floor(duringHold.length / 2)] > 3,
    `${scene}: the median unheld actor visibly travels while another is held for five seconds`
  )
  const releasePoint = [traveller.x, traveller.y]
  const result = roomPhysics.release()
  assert.equal(
    result.landing,
    true,
    `${scene}: an off-floor release schedules a landing`
  )
  assert.deepEqual(
    [traveller.x, traveller.y],
    releasePoint,
    `${scene}: releasing outside a floor does not teleport`
  )
  for (const item of travel.keys()) travel.set(item, 0)
  for (let i = 0; i < 300; i++) recordFrame()
  const afterRelease = [...travel.values()].sort((a, b) => a - b)
  assert.ok(
    afterRelease[Math.floor(afterRelease.length / 2)] > 3,
    `${scene}: the room keeps moving after landing has settled`
  )
  assert.equal(Boolean(traveller.landing), false)
  assert.equal(traveller.zone, result.zone)
  assert.equal(roomPhysics.step(1 / 60), false)
  bounded(roomActors)
  assert.equal(
    JSON.stringify(population),
    originalMetadata,
    `${scene}: visual transfers preserve all visitor metadata`
  )
  roomPhysics.dispose()
}

const dense = Array.from({ length: 1000 }, (_, i) =>
  actor(`dense-${i}`, 0.5, 0.5)
)
const crowdPhysics = createPhysics(dense, { radius: 8 })
const started = performance.now()
assert.equal(crowdPhysics.grab('dense-500'), true)
for (let step = 0; step < 100; step++) {
  crowdPhysics.move(0.5 + Math.sin(step / 20) * 0.12, 0.5)
  crowdPhysics.step(1 / 60)
}
bounded(dense)
crowdPhysics.release()
for (let step = 0; step < 100; step++) crowdPhysics.step(1 / 60)
assert.equal(crowdPhysics.step(1 / 60), false)
bounded(dense)
console.log(
  `Physics checks passed: dragging, cross-zone transfers, empty surfaces, smooth outside releases, layered collisions, real-room motion integration, concurrent autonomous motion, bounds, finite positions, release, 1000-body cluster (${Math.round(performance.now() - started)} ms locally; not a browser benchmark)`
)
