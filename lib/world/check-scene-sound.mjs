import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { createSceneSound } from './scene-sound.js'
import { ROOM_SOUND_HOTSPOTS, hitSoundHotspot } from './sound-hotspots.js'

const catalog = JSON.parse(
  readFileSync(new URL('./sound-catalog.json', import.meta.url), 'utf8')
)
const deferred = () => {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}

// This suite tests the controller boundary with a deferred mixer. No browser,
// audio request, real playback, user storage or wall-clock timeout is involved.
function harness({
  enableGate,
  voiceGate,
  paused = false,
  room = 'hearth',
  initialExclusions
} = {}) {
  const calls = []
  let engineExclusions
  const nodes = new Map()
  const timers = new Map()
  let timerId = 0
  let now = 0
  let currentRoom = room
  let currentPaused = paused
  let ready = false
  let visible = true
  const visitor = { id: 'visitor-a', label: 'Visitor A' }
  const second = { id: 'visitor-b', label: 'Visitor B' }
  const actors = [
    { visitor, x: 0.4, y: 0.5, zone: { wet: room === 'bathhouse' } },
    { visitor: second, x: 0.6, y: 0.5, zone: { wet: false } }
  ]
  const makeNode = () => ({
    textContent: '',
    dataset: {},
    attributes: {},
    children: [],
    hidden: false,
    setAttribute(name, value) {
      this.attributes[name] = value
    },
    append(node) {
      this.children.push(node)
    },
    replaceChildren(...children) {
      this.children = children
    },
    get childElementCount() {
      return this.children.length
    }
  })
  const node = (id) => {
    if (!nodes.has(id)) nodes.set(id, makeNode())
    return nodes.get(id)
  }
  const document = {
    hidden: false,
    getElementById: node,
    querySelector: (selector) => node(selector.slice(1)),
    createElement: makeNode
  }
  const globals = {
    document,
    location: {
      href: 'http://127.0.0.1:8942/brand-exploration/living-world/dynamics/'
    },
    localStorage: { getItem: () => null, setItem() {} },
    performance: { now: () => now },
    setTimeout(callback, delay) {
      const id = ++timerId
      timers.set(id, { callback, at: now + delay })
      return id
    },
    clearTimeout(id) {
      timers.delete(id)
    },
    ROOM_SOUND_HOTSPOTS,
    hitSoundHotspot,
    createSoundEngine({ onStatus, initialExclusions }) {
      engineExclusions = initialExclusions
      const status = () =>
        onStatus({ available: true, ready: ready && visible, active: 0 })
      const record = (name, value) => calls.push({ name, ...value })
      return {
        async enable() {
          record('enable')
          if (enableGate) await enableGate.promise
          ready = true
          status()
          return true
        },
        async voice(event, options) {
          record('voice', { event, ...options })
          return voiceGate ? await voiceGate.promise : true
        },
        async drop(options) {
          record('drop', { event: 'drop', ...options })
          return { effect: true, voice: true }
        },
        cancelDrop(id) {
          record('cancelDrop', { id })
        },
        setExclusions(value) {
          record('exclusions', { value })
        },
        async effect(event, options) {
          record('effect', { event, ...options })
          return true
        },
        familyFor(id) {
          return id === visitor.id ? 'kyoto' : 'minion'
        },
        setVolume(value) {
          record('volume', { value })
        },
        setRoom(value) {
          record('room', { value })
        },
        setPaused(value) {
          record('paused', { value })
        },
        setVisible(value) {
          visible = value
          record('visible', { value })
          status()
        },
        setBackgroundEnabled(value) {
          record('background', { value })
        },
        setEnabled(value) {
          ready = value
          record('enabled', { value })
          status()
        },
        cancelVoice(id) {
          record('cancelVoice', { id })
        },
        cancelEffect(target) {
          record('cancelEffect', { target })
        },
        reset() {
          record('reset')
        },
        tick(options) {
          record('tick', options)
        },
        dispose() {
          record('dispose')
        }
      }
    }
  }
  const saved = new Map(
    Object.keys(globals).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key)
    ])
  )
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value
    })
  const controller = createSceneSound({
    catalog,
    engineFactory: (options) => globals.createSoundEngine(options),
    initialExclusions,
    canvas: {},
    getScene: () => currentRoom,
    getPaused: () => currentPaused,
    getActors: () => actors
  })
  calls.length = 0
  return {
    controller,
    engineExclusions,
    visitor,
    second,
    calls,
    node,
    document,
    audio: () =>
      calls.filter((call) => ['voice', 'effect', 'drop'].includes(call.name)),
    advance(ms) {
      now += ms
      for (const [id, timer] of timers)
        if (timer.at <= now) {
          timers.delete(id)
          timer.callback()
        }
    },
    room(value) {
      currentRoom = value
      controller.roomChanged()
    },
    pause(value) {
      currentPaused = value
      controller.pausedChanged()
    },
    restore() {
      controller.dispose()
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else delete globalThis[key]
      }
    }
  }
}

async function test(name, check) {
  await check()
  console.log(`PASS ${name}`)
}

await test('saved feedback reaches the mixer and excludes room interaction sounds', async () => {
  const initialExclusions = {
    clipIds: catalog.clips
      .filter((clip) => clip.kind === 'room-effect')
      .map((clip) => clip.id),
    familyIds: ['mooncat'],
    sourceKeys: []
  }
  const h = harness({ initialExclusions })
  try {
    assert.deepEqual(h.engineExclusions, initialExclusions)
    const fire = ROOM_SOUND_HOTSPOTS.hearth.find(
      (spot) => spot.id === 'ember-fire'
    )
    assert.equal(h.controller.pointerHover(fire), false)
    h.controller.setExclusions({ clipIds: [], familyIds: [], sourceKeys: [] })
    assert.equal(h.controller.pointerHover(fire), true)
  } finally {
    h.restore()
  }
})

await test('hover never unlocks or requests sound before a deliberate gesture', async () => {
  const h = harness()
  try {
    h.controller.pointerHover({ x: 0.4, y: 0.5 }, { visitor: h.visitor })
    h.advance(220)
    await settle()
    assert.equal(h.calls.filter((c) => c.name === 'enable').length, 0)
    assert.deepEqual(h.audio(), [])
    h.controller.touchScene({ x: 0.99, y: 0.99 })
    await settle()
    h.controller.pointerHover({ x: 0.4, y: 0.5 }, { visitor: h.visitor })
    h.advance(219)
    assert.deepEqual(h.audio(), [])
    h.advance(1)
    await settle()
    assert.deepEqual(
      h.audio().map((c) => [c.event, c.id]),
      [['hover', h.visitor.id]]
    )
    h.controller.leave()
    assert(
      h.calls.some((c) => c.name === 'cancelVoice' && c.id === h.visitor.id)
    )
    h.controller.pointerHover({ x: 0.6, y: 0.5 }, { visitor: h.second })
    h.controller.leave()
    h.advance(300)
    await settle()
    assert.equal(h.audio().length, 1)
  } finally {
    h.restore()
  }
})

await test('release before audio unlock prevents a stale pickup and requests a separate water landing', async () => {
  const gate = deferred()
  const h = harness({ enableGate: gate, room: 'bathhouse' })
  try {
    h.controller.pickup(h.visitor, { x: 0.4, y: 0.5 })
    h.controller.release(h.visitor, { x: 0.5, y: 0.6 })
    assert.deepEqual(h.audio(), [])
    gate.resolve(true)
    await settle()
    assert.deepEqual(
      h.audio().map((c) => [c.name, c.event]),
      [['drop', 'drop']]
    )
    const foley = h.audio()[0]
    assert.equal(foley.target, 'water')
    assert.equal(foley.room, 'bathhouse')
    assert.equal(foley.id, h.visitor.id)
  } finally {
    h.restore()
  }
})

await test('completed drops pass their physical surface independently of voice auditions', async () => {
  const h = harness()
  try {
    h.controller.release(h.visitor, { x: 0.4, y: 0.5 })
    await settle()
    assert.deepEqual(
      h.audio().map((call) => call.name),
      ['drop']
    )
    assert.equal(h.audio()[0].target, 'soft')
    h.controller.pickup(h.visitor, { x: 0.4, y: 0.5 })
    assert(
      h.calls.some(
        (call) => call.name === 'cancelDrop' && call.id === h.visitor.id
      )
    )
  } finally {
    h.restore()
  }
})

await test('review changes discard pending gestures, hover, and incidental playback before applying exclusions', async () => {
  const gate = deferred()
  const h = harness({ enableGate: gate })
  try {
    h.controller.release(h.visitor, { x: 0.4, y: 0.5 })
    const clipIds = catalog.clips
      .filter((clip) => clip.targets?.includes('fire'))
      .map((clip) => clip.id)
    const exclusions = { clipIds, familyIds: ['kyoto'], sourceKeys: [] }
    h.controller.setExclusions(exclusions)
    gate.resolve(true)
    await settle()
    assert.deepEqual(h.audio(), [])
    assert.deepEqual(
      h.calls.find((call) => call.name === 'exclusions')?.value,
      exclusions
    )
    assert(h.calls.some((call) => call.name === 'reset'))
    const fire = ROOM_SOUND_HOTSPOTS.hearth.find(
      (spot) => spot.id === 'ember-fire'
    )
    assert.equal(h.controller.pointerHover(fire), false)
    h.controller.pointerHover({ x: 0.4, y: 0.5 }, { visitor: h.visitor })
    h.controller.setExclusions({})
    h.advance(300)
    await settle()
    assert.deepEqual(h.audio(), [])
    assert.equal(h.controller.pointerHover(fire), true)
  } finally {
    h.restore()
  }
})

await test('cancel, mute, room change and hidden-page transitions invalidate pending unlocks', async () => {
  for (const action of ['cancel', 'mute', 'room', 'hidden', 'persisted-hide']) {
    const gate = deferred()
    const h = harness({ enableGate: gate })
    try {
      h.controller.pickup(h.visitor, { x: 0.4, y: 0.5 })
      if (action === 'cancel')
        h.controller.release(h.visitor, { x: 0.4, y: 0.5 }, true)
      if (action === 'mute') await h.node('sound-toggle').onclick()
      if (action === 'room') h.room('bathhouse')
      if (action === 'hidden') {
        h.document.hidden = true
        h.controller.visibilityChanged()
      }
      if (action === 'persisted-hide') h.controller.suspendPage()
      gate.resolve(true)
      await settle()
      assert.deepEqual(h.audio(), [], action)
      if (action === 'persisted-hide') {
        h.controller.visibilityChanged()
        h.controller.audition(h.visitor, 'hover')
        await settle()
        assert.equal(
          h.audio()[0]?.event,
          'hover',
          'restoring a persisted page leaves the controller usable'
        )
      }
    } finally {
      h.restore()
    }
  }
})

await test('quick movement reacts within the held voice while gentle movement and repeat jitter stay quiet', async () => {
  const h = harness()
  try {
    h.controller.pickup(h.visitor, { x: 0.4, y: 0.5 })
    await settle()
    h.advance(600)
    h.controller.drag(h.visitor, { x: 0.41, y: 0.5 })
    assert.equal(h.audio().filter((c) => c.event === 'surprise').length, 0)
    h.advance(20)
    h.controller.drag(h.visitor, { x: 0.8, y: 0.5 })
    await settle()
    h.advance(20)
    h.controller.drag(h.visitor, { x: 0.4, y: 0.5 })
    await settle()
    assert.deepEqual(
      h
        .audio()
        .filter((c) => c.event === 'surprise')
        .map((c) => c.id),
      [h.visitor.id]
    )
    const family = h.controller.familyLabel(h.visitor.id)
    assert.notEqual(family, h.controller.familyLabel(h.second.id))
    h.room('bathhouse')
    assert.equal(h.controller.familyLabel(h.visitor.id), family)
  } finally {
    h.restore()
  }
})

await test('keyboard nudges and scenery interaction sounds remain usable while motion is paused', async () => {
  const h = harness({ paused: true })
  try {
    h.controller.audition(h.visitor, 'surprise')
    await settle()
    h.controller.nudge(h.visitor, 0.4)
    await settle()
    h.controller.touchScene(
      ROOM_SOUND_HOTSPOTS.hearth.find((spot) => spot.id === 'ember-fire')
    )
    await settle()
    assert.deepEqual(
      h.audio().map((c) => [c.name, c.event]),
      [
        ['voice', 'surprise'],
        ['voice', 'nudge'],
        ['effect', 'hover']
      ]
    )
    assert.equal(h.audio()[2].target, 'fire')
    h.pause(true)
    assert(h.calls.some((c) => c.name === 'paused' && c.value === true))
    h.room('bathhouse')
    h.controller.touchScene(
      ROOM_SOUND_HOTSPOTS.bathhouse.find((spot) => spot.id === 'mineral-falls')
    )
    await settle()
    assert.equal(h.audio().at(-1).room, 'bathhouse')
  } finally {
    h.restore()
  }
})

console.log(
  'Scene sound controller checks passed without media playback or saved-preference changes.'
)
