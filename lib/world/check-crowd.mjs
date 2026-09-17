import assert from 'node:assert/strict'
import {
  chooseVisible,
  createMotion,
  createPopulation,
  stepMotion
} from './crowd.js'

// Small regression for the reported long-idle camp creatures.
const wanderers = createMotion(
  [
    { id: 'a', index: 0, room: 0, seed: 0.2 },
    { id: 'b', index: 1, room: 0, seed: 0.4 }
  ],
  [{ key: 'camp', room: 0, cx: 0.5, cy: 0.5, rx: 0.1, ry: 0.04 }]
)
const starts = wanderers.map(({ x, y }) => ({ x, y }))
for (let frame = 0; frame < 180; frame++)
  stepMotion(wanderers, 1 / 60, frame / 60)
for (const [index, actor] of wanderers.entries())
  assert.ok(
    Math.hypot(actor.x - starts[index].x, actor.y - starts[index].y) > 0.001,
    'Camp creatures wander within three seconds'
  )

const hundred = createPopulation(100)
const population = createPopulation(1000)
assert.deepEqual(
  hundred,
  population.slice(0, 100),
  'Existing identities survive population growth'
)
assert.deepEqual(createPopulation(0), [])
assert.equal(new Set(population.map((v) => v.id)).size, 1000)
assert.deepEqual(chooseVisible(hundred).counts, [40, 12, 10, 10, 10, 10, 8])

const summary = chooseVisible(population, {
  scene: 'camp',
  mode: 'summary',
  limit: 60
})
assert.equal(summary.visible.length, 60)
assert.equal(chooseVisible(population, { limit: 24 }).visible.length, 24)
assert.equal(chooseVisible(population, { mode: 'full' }).visible.length, 300)
assert.equal(new Set(summary.visible.map((v) => v.room)).size, 7)
assert.equal(new Set(summary.visible.map((v) => v.family)).size, 8)
assert.deepEqual(
  summary.visible,
  chooseVisible(population).visible,
  'Sampling is deterministic'
)
const selected = population.find((v) => !summary.visible.includes(v))
const retained = chooseVisible(population, { selectedId: selected.id })
assert.ok(
  retained.visible.includes(selected),
  'Selected visitor survives summary sampling'
)
assert.equal(retained.visible.length, 60)
assert.equal(
  chooseVisible(createPopulation(2000), { mode: 'full' }).visible.length,
  300
)

const campFull = chooseVisible(population, { mode: 'full' })
assert.equal(
  campFull.eligible.length,
  1000,
  'All visitors stay available to the activity list'
)
const outsideFull = population.find(
  (visitor) => !campFull.visible.includes(visitor)
)
const retainedFull = chooseVisible(population, {
  mode: 'full',
  selectedId: outsideFull.id
})
assert.equal(retainedFull.visible.length, 300)
assert.ok(
  retainedFull.visible.includes(outsideFull),
  'Selection outside the full sample remains represented'
)
assert.deepEqual(retainedFull.eligible, population)

const bathhouse = chooseVisible(population, {
  scene: 'bathhouse',
  mode: 'summary'
})
assert.equal(bathhouse.eligible.length, 400)
assert.equal(bathhouse.visible.length, 24)
assert.equal(bathhouse.courts, 4)
const seen = new Set()
for (let court = 0; court < bathhouse.courts; court++) {
  const full = chooseVisible(population, {
    scene: 'bathhouse',
    mode: 'full',
    court
  })
  assert.ok(full.visible.length === 100)
  assert.ok(full.visible.every((v) => v.room === 0 && v.court === court))
  for (const visitor of full.visible) seen.add(visitor.id)
}
assert.equal(
  seen.size,
  bathhouse.eligible.length,
  'Courts expose every eligible Bathhouse visitor'
)
assert.deepEqual(chooseVisible(population, { limit: 0 }).visible, [])

const roomScenes = [
  'bathhouse',
  'dream-garden',
  'quiet-house',
  'source',
  'open-studio',
  'hearth',
  'temple'
]
const expectedCounts = [400, 120, 100, 100, 100, 100, 80]
for (const [room, scene] of roomScenes.entries()) {
  const detail = chooseVisible(population, { scene, mode: 'summary' })
  assert.equal(detail.eligible.length, expectedCounts[room])
  assert.equal(detail.visible.length, Math.min(24, expectedCounts[room]))
  assert.equal(detail.courts, Math.ceil(expectedCounts[room] / 100))
  assert.ok(detail.eligible.every((visitor) => visitor.room === room))
  const omitted = detail.eligible.find(
    (visitor) => !detail.visible.includes(visitor)
  )
  const selectedDetail = chooseVisible(population, {
    scene,
    selectedId: omitted.id
  })
  assert.ok(
    selectedDetail.visible.includes(omitted),
    'Room summary retains its selected visitor'
  )
  assert.equal(selectedDetail.visible.length, 24)
  const represented = new Set()
  for (let court = 0; court < detail.courts; court++) {
    const full = chooseVisible(population, { scene, mode: 'full', court })
    assert.ok(full.visible.length <= 100)
    assert.ok(
      full.visible.every(
        (visitor) => visitor.room === room && visitor.court === court
      )
    )
    for (const visitor of full.visible) represented.add(visitor.id)
  }
  assert.equal(
    represented.size,
    detail.eligible.length,
    'Every room visitor is accessible through its courts'
  )
  const selectedCourt = chooseVisible(population, {
    scene,
    mode: 'full',
    court: omitted.court,
    selectedId: omitted.id
  })
  assert.ok(selectedCourt.visible.includes(omitted))
}
assert.deepEqual(
  chooseVisible(population, { scene: 'unknown', mode: 'full' }),
  campFull,
  'Unknown scenes fall back to camp'
)

const zones = Array.from({ length: 7 }, (_, room) => ({
  key: `room-${room}`,
  room,
  cx: 0.15 + (room % 3) * 0.3,
  cy: 0.15 + Math.floor(room / 3) * 0.3,
  rx: 0.13,
  ry: 0.1,
  wet: room === 0
}))
const actors = createMotion(population, zones)
assert.equal(actors.length, population.length)
assert.deepEqual(
  actors,
  createMotion(population, zones),
  'Initial placement is deterministic'
)
assert.equal(new Set(actors.map((a) => `${a.x},${a.y}`)).size, actors.length)
assert.deepEqual(createMotion(population, []), [])
for (let frame = 0; frame < 200; frame++) {
  stepMotion(actors, 0.05, frame * 0.25)
  for (const actor of actors) {
    assert.ok(
      [actor.x, actor.y, actor.targetX, actor.targetY, actor.phase].every(
        Number.isFinite
      )
    )
    const radius = Math.hypot(
      (actor.x - actor.zone.cx) / actor.zone.rx,
      (actor.y - actor.zone.cy) / actor.zone.ry
    )
    assert.ok(
      radius <= 0.880001,
      'Actors remain inside authored walkable areas'
    )
  }
}
const rowZones = [6, 5, 4, 7, 3].map((capacity, index) => ({
  key: `pool-${index}`,
  cx: 0.5,
  cy: 0.1 + index * 0.18,
  rx: 0.4,
  ry: 0.07,
  layout: 'row',
  wet: true,
  capacity
}))
const rowActors = createMotion(bathhouse.visible, rowZones)
assert.deepEqual(rowActors, createMotion(bathhouse.visible, rowZones))
for (const zone of rowZones) {
  const residents = rowActors.filter((actor) => actor.zone === zone)
  assert.ok(
    residents.length <= zone.capacity,
    'Weighted allocation respects the available pool capacity'
  )
  assert.ok(
    residents.length >= zone.capacity - 1,
    'Every pool gets its fair share'
  )
  for (let index = 1; index < residents.length; index++) {
    assert.ok(
      residents[index].x - residents[index - 1].x > zone.rx * 0.2,
      'Initial row anchors are fairly spaced'
    )
  }
}
for (let frame = 0; frame < 200; frame++) {
  stepMotion(rowActors, 0.05, frame * 0.5)
  for (const actor of rowActors) {
    assert.ok(Math.abs(actor.x - actor.homeX) <= actor.zone.rx * 0.200001)
    assert.ok(Math.abs(actor.y - actor.homeY) <= actor.zone.ry * 0.060001)
    assert.ok(Math.abs(actor.y - actor.zone.cy) <= actor.zone.ry * 0.180001)
    assert.ok(
      Math.hypot(
        (actor.x - actor.zone.cx) / actor.zone.rx,
        (actor.y - actor.zone.cy) / actor.zone.ry
      ) <= 0.880001
    )
  }
}
const denseZones = rowZones.map((zone, index) => ({
  ...zone,
  capacity: [24, 20, 16, 28, 12][index]
}))
const fullBathhouse = chooseVisible(population, {
  scene: 'bathhouse',
  mode: 'full',
  court: 0
})
const denseActors = createMotion(fullBathhouse.visible, denseZones)
assert.equal(denseActors.length, 100)
assert.deepEqual(denseActors, createMotion(fullBathhouse.visible, denseZones))
assert.equal(
  new Set(denseActors.map((actor) => `${actor.x},${actor.y}`)).size,
  100
)
for (const zone of denseZones) {
  const residents = denseActors.filter((actor) => actor.zone === zone)
  assert.equal(
    residents.length,
    zone.capacity,
    'Dense pools receive exactly their weighted capacity'
  )
  const rowCount = new Set(residents.map((actor) => actor.rowIndex)).size
  assert.ok(
    rowCount >= 2 && rowCount <= 4,
    'Dense pools use staggered multiple rows'
  )
}
for (let frame = 0; frame < 200; frame++) {
  stepMotion(denseActors, 0.05, frame * 0.5)
  for (const actor of denseActors) {
    assert.ok(
      [actor.x, actor.y, actor.targetX, actor.targetY, actor.phase].every(
        Number.isFinite
      )
    )
    assert.ok(
      Math.abs(actor.x - actor.homeX) <=
        actor.zone.rx * (actor.homeRangeX + 0.000001)
    )
    assert.ok(
      Math.abs(actor.y - actor.homeY) <=
        actor.zone.ry * (actor.homeRangeY + 0.000001)
    )
    assert.ok(
      Math.hypot(
        (actor.x - actor.zone.cx) / actor.zone.rx,
        (actor.y - actor.zone.cy) / actor.zone.ry
      ) <= 0.880001
    )
  }
}
const dragActors = createMotion(summary.visible, zones)
const heldActor = dragActors[0]
heldActor.held = true
heldActor.x = 0.99
heldActor.y = 0.99
const heldSnapshot = { ...heldActor }
const restingSnapshots = dragActors
  .slice(1)
  .map((actor) => ({ x: actor.x, y: actor.y }))
for (let frame = 0; frame < 20; frame++)
  stepMotion(dragActors, 0.05, 20 + frame * 0.05)
assert.deepEqual(
  heldActor,
  heldSnapshot,
  'Held actors bypass steering, clamping and separation'
)
assert.ok(
  dragActors
    .slice(1)
    .some(
      (actor, index) =>
        actor.x !== restingSnapshots[index].x ||
        actor.y !== restingSnapshots[index].y
    ),
  'Other actors keep moving while one is held'
)
heldActor.held = false
stepMotion(dragActors, 0.05, 22)
assert.ok(
  Math.hypot(
    (heldActor.x - heldActor.zone.cx) / heldActor.zone.rx,
    (heldActor.y - heldActor.zone.cy) / heldActor.zone.ry
  ) <= 0.880001,
  'Normal motion resumes after release'
)
console.log(
  'Crowd checks passed: 1,000 eligible camp identities, 300 visible, 100-visitor courts in all seven rooms, retained selections, weighted pools, bounded motion, and held-actor isolation.'
)
