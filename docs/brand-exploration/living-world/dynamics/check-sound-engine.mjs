import assert from 'node:assert/strict'

import { createSoundEngine } from './sound-engine.js'

class Parameter {
  value = 1
  cancelScheduledValues() {}
  setValueAtTime(value) {
    this.value = value
  }
  linearRampToValueAtTime(value) {
    this.value = value
  }
}
class Node {
  gain = new Parameter()
  pan = new Parameter()
  connect() {}
  disconnect() {}
}
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve()
}
const deferred = () => {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const clip = (id, kind, family, roles, rooms = [], targets = []) => ({
  id,
  src: `${id}.mp3`,
  title: id,
  kind,
  family,
  roles,
  rooms,
  targets,
  duration: 2,
  tags: []
})
const catalog = {
  clips: [
    clip('baby-hello', 'voice', 'baby', ['pickup', 'hover']),
    clip('baby-happy', 'voice', 'baby', ['drop', 'idle']),
    clip('cat-curious', 'voice', 'cat', ['hover']),
    clip('cat-wonder', 'voice', 'cat', ['surprise', 'pickup']),
    clip(
      'fire-one',
      'room-effect',
      null,
      ['hover', 'idle'],
      ['hearth'],
      ['fire']
    ),
    clip(
      'fire-two',
      'room-effect',
      null,
      ['hover', 'idle'],
      ['hearth'],
      ['fire']
    ),
    clip(
      'cup',
      'room-effect',
      null,
      ['hover', 'drop'],
      ['hearth'],
      ['ceramic']
    ),
    clip(
      'water',
      'room-effect',
      null,
      ['hover', 'idle', 'drop'],
      ['bathhouse'],
      ['water']
    ),
    clip('soft-landing', 'room-effect', null, ['drop'], ['camp'], ['soft'])
  ]
}

function harness(options = {}) {
  let time = 100
  const calls = []
  const started = []
  const statuses = []
  let decodeCount = 0
  let maxPlaying = 0
  let latestContext
  class Context {
    currentTime = 0
    state = 'suspended'
    destination = new Node()
    constructor() {
      latestContext = this
    }
    createGain() {
      return new Node()
    }
    createStereoPanner() {
      return new Node()
    }
    async resume() {
      this.state = 'running'
    }
    async suspend() {
      this.state = 'suspended'
    }
    async close() {
      this.state = 'closed'
    }
    async decodeAudioData(bytes) {
      decodeCount++
      if (options.decode) await options.decode()
      return {
        duration: 2,
        length: 96000,
        numberOfChannels: 1,
        id: new TextDecoder().decode(bytes)
      }
    }
    createBufferSource() {
      const node = new Node()
      Object.defineProperty(node, 'playing', {
        get: () =>
          node.startAt <= this.currentTime && node.stopAt > this.currentTime
      })
      node.start = (at, offset, duration) => {
        node.startAt = at
        node.stopAt = at + duration
        started.push(node)
        for (const start of started.map((item) => item.startAt)) {
          maxPlaying = Math.max(
            maxPlaying,
            started.filter(
              (item) => item.startAt <= start && item.stopAt > start
            ).length
          )
        }
      }
      node.stop = (at = this.currentTime) => {
        node.stopAt = Math.min(node.stopAt, at)
        if (node.stopAt <= this.currentTime) node.onended?.()
      }
      return node
    }
  }
  const engine = createSoundEngine({
    catalog: options.catalog ?? catalog,
    initialExclusions: options.initialExclusions,
    baseUrl: 'https://local.test/clips/',
    AudioContextImpl: Context,
    fetchImpl: async (url, init) => {
      calls.push({ url, signal: init.signal })
      if (options.fetch) await options.fetch(url)
      return {
        ok: options.ok !== false,
        status: 404,
        arrayBuffer: async () =>
          new TextEncoder().encode(url.split('/').pop().replace('.mp3', ''))
            .buffer
      }
    },
    now: () => time,
    random: options.random ?? (() => 0),
    onStatus: (value) => statuses.push(value)
  })
  return {
    engine,
    calls,
    started,
    statuses,
    advance: (seconds) => {
      time += seconds
      latestContext.currentTime += seconds
    },
    finish: () => {
      for (const item of started) if (item.playing) item.stop()
    },
    get context() {
      return latestContext
    },
    get decodeCount() {
      return decodeCount
    },
    get maxPlaying() {
      return maxPlaying
    },
    get lastStatus() {
      return statuses.at(-1)
    }
  }
}

// No fetch or context until a trusted enable gesture, and family assignment is stable.
{
  const h = harness()
  const family = h.engine.familyFor('creature-19')
  assert.ok(['baby', 'cat'].includes(family))
  assert.equal(h.engine.familyFor('creature-19'), family)
  assert.equal(await h.engine.voice('pickup', { id: 'creature-19' }), false)
  assert.equal(h.calls.length, 0)
  assert.equal(h.context, undefined)
  assert.equal(await h.engine.enable(), true)
  assert.equal(await h.engine.voice('pickup', { id: 'creature-19' }), true)
  assert.ok(h.started[0].buffer.id.startsWith(family))
  assert.equal(h.lastStatus.lastPlayed.ownerId, 'creature-19')
  h.engine.dispose()
}

// Initial assignment only draws from families with approved playable takes.
// Live changes keep these initial identities intact instead of re-rolling them.
{
  const sourced = {
    clips: catalog.clips.map((clip) => ({
      ...clip,
      sourceKey: clip.family === 'baby' ? 'baby-source' : 'other-source',
      sourceUrl:
        clip.family === 'baby'
          ? 'https://sounds.test/baby'
          : 'https://sounds.test/other'
    }))
  }
  for (const initialExclusions of [
    { familyIds: ['baby'] },
    { clipIds: ['baby-hello', 'baby-happy'] },
    { sourceKeys: ['baby-source'] },
    { sourceKeys: ['https://sounds.test/baby'] }
  ]) {
    const h = harness({ catalog: sourced, initialExclusions })
    const assigned = Array.from({ length: 1000 }, (_, i) =>
      h.engine.familyFor(`fresh-${i}`)
    )
    assert.deepEqual([...new Set(assigned)], ['cat'])
    await h.engine.enable()
    assert.equal(await h.engine.voice('pickup', { id: 'fresh-0' }), true)
    assert.ok(h.started.at(-1).buffer.id.startsWith('cat-'))
    h.engine.setExclusions({ familyIds: ['cat'] })
    assert.equal(
      h.engine.familyFor('fresh-0'),
      'cat',
      'later dislikes silence this visitor rather than switch its identity'
    )
    assert.equal(await h.engine.voice('hover', { id: 'fresh-0' }), false)
    h.engine.dispose()
  }
  const none = harness({ initialExclusions: { familyIds: ['baby', 'cat'] } })
  assert.equal(none.engine.familyFor('fresh'), null)
  await none.engine.enable()
  assert.deepEqual(
    await none.engine.drop({ id: 'fresh' }),
    { effect: true, voice: false },
    'no active voices still permits a physical landing'
  )
  none.engine.dispose()
}

// Initial weighting counts retained takes, and omitting exclusions keeps the
// original deterministic assignment unchanged.
{
  const h = harness({ initialExclusions: { clipIds: ['baby-happy'] } })
  const assignments = Array.from({ length: 1000 }, (_, i) =>
    h.engine.familyFor(`visitor-${i}`)
  )
  const cats = assignments.filter((family) => family === 'cat').length
  assert.ok(
    cats > 650 && cats < 850,
    'the two-take cat family is weighted above the one remaining baby take'
  )
  h.engine.dispose()
  const original = harness()
  const empty = harness({ initialExclusions: {} })
  assert.deepEqual(
    Array.from({ length: 1000 }, (_, i) =>
      original.engine.familyFor(`visitor-${i}`)
    ),
    Array.from({ length: 1000 }, (_, i) =>
      empty.engine.familyFor(`visitor-${i}`)
    )
  )
  original.engine.dispose()
  empty.engine.dispose()
}

// Missing emotions stay in the same family; unrelated room props do not substitute.
{
  const h = harness()
  await h.engine.enable()
  assert.equal(
    await h.engine.voice('surprise', { id: 'baby-one', family: 'baby' }),
    true
  )
  assert.equal(h.started.at(-1).buffer.id, 'baby-hello')
  h.advance(0.2)
  assert.equal(await h.engine.voice('drop', { id: 'baby-one' }), true)
  assert.equal(h.started.at(-1).buffer.id, 'baby-happy')
  assert.equal(h.maxPlaying, 1, 'only one voice plays per creature')
  h.engine.setRoom('hearth')
  h.advance(1)
  assert.equal(await h.engine.effect('hover', { target: 'ceramic' }), true)
  assert.equal(h.started.at(-1).buffer.id, 'cup')
  h.advance(1)
  assert.equal(await h.engine.effect('hover', { target: 'paper' }), false)
  assert.equal(
    await h.engine.effect('hover', { room: 'bathhouse', target: 'water' }),
    false
  )
  h.engine.dispose()
}

// Global and per-creature event cooldowns prevent pointer jitter from building a chorus.
{
  const h = harness()
  await h.engine.enable()
  assert.equal(await h.engine.voice('hover', { id: 'a' }), true)
  assert.equal(await h.engine.voice('hover', { id: 'b' }), false)
  h.advance(0.2)
  assert.equal(await h.engine.voice('hover', { id: 'a' }), false)
  assert.equal(await h.engine.voice('pickup', { id: 'a' }), true)
  h.advance(0.2)
  assert.equal(await h.engine.voice('pickup', { id: 'a' }), false)
  h.finish()
  h.advance(8)
  assert.equal(await h.engine.voice('hover', { id: 'a' }), true)
  h.engine.dispose()
}

// Pending loads consume slots too; higher-priority reactions evict background first.
{
  const h = harness()
  await h.engine.enable()
  h.engine.setRoom('hearth')
  assert.equal(await h.engine.effect('idle', { target: 'fire' }), true)
  assert.equal(h.lastStatus.activeBackground, 1)
  h.advance(0.2)
  assert.equal(await h.engine.voice('pickup', { id: 'a' }), true)
  h.advance(0.021)
  assert.equal(
    h.started[0].playing,
    false,
    'gesture clears the room sound immediately'
  )
  assert.equal(h.lastStatus.activeBackground, 0)
  h.advance(0.2)
  assert.equal(await h.engine.voice('pickup', { id: 'b' }), true)
  h.advance(0.2)
  assert.equal(await h.engine.voice('pickup', { id: 'c' }), true)
  h.advance(0.2)
  assert.equal(await h.engine.voice('pickup', { id: 'd' }), false)
  assert.equal(h.maxPlaying, 3)
  h.engine.dispose()
}
{
  const gate = deferred()
  const h = harness({ fetch: () => gate.promise })
  await h.engine.enable()
  const pending = []
  for (const id of ['a', 'b', 'c']) {
    pending.push(h.engine.voice('pickup', { id }))
    h.advance(0.15)
  }
  assert.equal(h.lastStatus.pending, 3)
  assert.equal(await h.engine.voice('pickup', { id: 'd' }), false)
  assert.equal(h.calls.length, 3)
  gate.resolve()
  assert.deepEqual(await Promise.all(pending), [true, true, true])
  assert.equal(h.maxPlaying, 3)
  h.engine.dispose()
}

// Room changes, mute, page hiding, cancel and expiration cannot resurrect an async sound.
for (const action of [
  'room',
  'reset',
  'mute',
  'hidden',
  'cancel',
  'dispose',
  'volume',
  'expired'
]) {
  const gate = deferred()
  const h = harness({ decode: () => gate.promise })
  await h.engine.enable()
  const pending = h.engine.voice('hover', { id: 'late' })
  await settle()
  if (action === 'room') h.engine.setRoom('hearth')
  if (action === 'reset') h.engine.reset()
  if (action === 'mute') await h.engine.setEnabled(false)
  if (action === 'hidden') h.engine.setVisible(false)
  if (action === 'cancel') h.engine.cancelVoice('late')
  if (action === 'dispose') h.engine.dispose()
  if (action === 'volume') h.engine.setVolume(0)
  if (action === 'expired') h.advance(0.6)
  gate.resolve()
  assert.equal(await pending, false, `${action} discards a late decode`)
  assert.equal(h.started.length, 0)
  h.engine.dispose()
}

// A pending hotspot is cancelable independently of creature reactions.
{
  const gate = deferred()
  const h = harness({ fetch: () => gate.promise })
  await h.engine.enable()
  h.engine.setRoom('hearth')
  const pending = h.engine.effect('hover', { target: 'fire' })
  h.engine.cancelEffect('fire')
  assert.equal(h.calls[0].signal.aborted, true)
  gate.resolve()
  assert.equal(await pending, false)
  h.engine.dispose()
}

// Incidental sound is rare, varied, focus-sensitive, and optional. Pausing motion
// suppresses background details but leaves deliberate pickup/hover interactions usable.
{
  const h = harness()
  await h.engine.enable()
  h.engine.setRoom('hearth')
  h.advance(11.9)
  h.engine.tick()
  await settle()
  assert.equal(h.started.length, 0)
  h.advance(0.2)
  h.engine.tick()
  await settle()
  assert.equal(h.started.length, 1)
  assert.equal(h.started[0].buffer.id, 'fire-one')
  h.finish()
  h.advance(13)
  h.engine.tick({ hovered: { id: 'watching' } })
  await settle()
  assert.equal(h.started.length, 1)
  h.advance(13)
  h.engine.tick()
  await settle()
  assert.equal(
    h.started.at(-1).buffer.id,
    'fire-two',
    'idle rotates available clips'
  )
  h.engine.setPaused(true)
  assert.equal(h.lastStatus.activeBackground, 0)
  h.advance(20)
  h.engine.tick()
  assert.equal(h.started.length, 2)
  assert.equal(await h.engine.voice('pickup', { id: 'paused-visitor' }), true)
  h.engine.setPaused(false)
  h.engine.setBackgroundEnabled(false)
  h.finish()
  h.advance(30)
  h.engine.tick()
  assert.equal(h.started.length, 3)
  assert.equal(await h.engine.effect('hover', { target: 'fire' }), true)
  h.engine.dispose()
}

// Decode once per retained clip; individual failures are bounded and nonfatal.
{
  const h = harness()
  await h.engine.enable()
  await h.engine.voice('pickup', { id: 'cached', family: 'baby' })
  h.finish()
  h.advance(2)
  await h.engine.voice('pickup', { id: 'cached' })
  h.finish()
  h.advance(2)
  await h.engine.voice('pickup', { id: 'cached' })
  assert.equal(h.decodeCount, 2)
  assert.equal(h.calls.length, 2)
  h.engine.dispose()
}
{
  const h = harness({ ok: false })
  await h.engine.enable()
  assert.equal(
    await h.engine.voice('pickup', { id: 'missing', family: 'baby' }),
    false
  )
  assert.equal(h.lastStatus.active, 0)
  assert.equal(h.lastStatus.pending, 0)
  assert.match(h.lastStatus.error, /could not load/)
  h.engine.dispose()
}

// Voice variety follows the creature across all reactions. A physical landing is
// independent, and cannot replace the voice's last-utterance history.
{
  const varied = {
    clips: [
      clip('cozy-a', 'voice', 'cozy', ['hover', 'pickup', 'drop']),
      clip('cozy-b', 'voice', 'cozy', ['hover', 'pickup', 'drop']),
      clip('cozy-c', 'voice', 'cozy', ['hover', 'pickup', 'drop']),
      clip('foreign', 'voice', 'other', ['hover', 'pickup', 'drop']),
      clip('landing', 'room-effect', null, ['drop'], ['camp'], ['soft'])
    ]
  }
  const h = harness({ catalog: varied, random: () => 0.6 })
  await h.engine.enable()
  for (const event of [
    'hover',
    'pickup',
    'drop',
    'hover',
    'pickup',
    'drop',
    'hover'
  ]) {
    if (event === 'drop') {
      assert.deepEqual(await h.engine.drop({ id: 'one-creature' }), {
        effect: true,
        voice: true
      })
    } else {
      assert.equal(
        await h.engine.voice(event, { id: 'one-creature', family: 'cozy' }),
        true
      )
    }
    h.finish()
    h.advance(8)
  }
  const voices = h.started
    .map((source) => source.buffer.id)
    .filter((id) => id !== 'landing')
  assert.ok(voices.every((id) => id.startsWith('cozy-')))
  assert.ok(
    voices.slice(1).every((id, i) => id !== voices[i]),
    'different gestures cannot immediately repeat the same voice clip'
  )
  assert.equal(
    h.started.filter((source) => source.buffer.id === 'landing').length,
    2
  )
  assert.ok(h.maxPlaying <= 3)
  h.engine.dispose()
}

// Role preferences bias the random choice without trapping an event on its one
// best-matching clip. Diversity can use a fallback role or another family take.
{
  const semantic = {
    clips: [
      clip('fallback', 'voice', 'cozy', ['hover']),
      clip('primary', 'voice', 'cozy', ['pickup']),
      clip('gentle', 'voice', 'cozy', ['content'])
    ]
  }
  const h = harness({ catalog: semantic })
  await h.engine.enable()
  const heard = []
  for (const event of ['pickup', 'hover', 'pickup']) {
    assert.equal(await h.engine.voice(event, { id: 'semantic' }), true)
    heard.push(h.started.at(-1).buffer.id)
    h.finish()
    h.advance(8)
  }
  assert.deepEqual(heard, ['primary', 'fallback', 'primary'])
  h.engine.setExclusions({ clipIds: ['fallback'] })
  assert.equal(await h.engine.voice('hover', { id: 'semantic' }), true)
  assert.equal(
    h.started.at(-1).buffer.id,
    'gentle',
    'another accepted family take beats repeating the best semantic match'
  )
  h.engine.dispose()
  const randomChoice = harness({ catalog: semantic, random: () => 0.999 })
  await randomChoice.engine.enable()
  await randomChoice.engine.voice('pickup', { id: 'random' })
  assert.equal(
    randomChoice.started[0].buffer.id,
    'gentle',
    'weighted choice still permits less literal expressions'
  )
  randomChoice.engine.dispose()
}

// A voice can repeat when only one accepted recording remains. Excluded family
// siblings and entirely different palettes never fill that missing variety.
{
  const h = harness()
  await h.engine.enable()
  h.engine.setExclusions({ clipIds: ['baby-happy'] })
  for (const event of ['hover', 'pickup', 'drop']) {
    assert.equal(
      await h.engine.voice(event, { id: 'solo', family: 'baby' }),
      true
    )
    assert.equal(h.started.at(-1).buffer.id, 'baby-hello')
    h.finish()
    h.advance(8)
  }
  h.engine.dispose()
}

// Starting a newer gesture cancels its slow predecessor. Merely choosing or
// loading a recording does not consume it in the visitor's audible history.
{
  const gate = deferred()
  const h = harness({ fetch: () => gate.promise })
  await h.engine.enable()
  const old = h.engine.voice('hover', { id: 'late', family: 'baby' })
  await settle()
  h.advance(0.15)
  const replacement = h.engine.voice('pickup', { id: 'late' })
  assert.equal(h.calls[0].signal.aborted, true)
  gate.resolve()
  assert.equal(await old, false)
  assert.equal(await replacement, true)
  assert.equal(h.started.length, 1)
  assert.equal(h.started[0].buffer.id, 'baby-hello')
  h.finish()
  h.advance(8)
  assert.equal(await h.engine.voice('hover', { id: 'late' }), true)
  assert.equal(h.started.at(-1).buffer.id, 'baby-happy')
  h.engine.dispose()
}

// A clip scheduled after a cancellation fade does not count if it is canceled
// before its start time. Once its replacement is audible, the next event varies.
{
  const h = harness()
  await h.engine.enable()
  await h.engine.voice('pickup', { id: 'scheduled', family: 'baby' })
  h.engine.cancelVoice('scheduled')
  assert.equal(await h.engine.voice('drop', { id: 'scheduled' }), true)
  assert.equal(h.started.at(-1).buffer.id, 'baby-happy')
  assert.equal(h.started.at(-1).playing, false)
  h.engine.cancelVoice('scheduled')
  h.advance(0.13)
  assert.equal(await h.engine.voice('surprise', { id: 'scheduled' }), true)
  assert.equal(
    h.started.at(-1).buffer.id,
    'baby-happy',
    'a canceled future start does not consume its take'
  )
  h.finish()
  h.advance(8)
  assert.equal(await h.engine.voice('hover', { id: 'scheduled' }), true)
  assert.equal(h.started.at(-1).buffer.id, 'baby-hello')
  h.engine.dispose()
}

// Failed decoding does not change audible history or win the next random choice.
{
  const available = {
    clips: [
      clip('first', 'voice', 'one', ['hover', 'pickup', 'drop']),
      clip('broken', 'voice', 'one', ['hover', 'pickup', 'drop']),
      clip('third', 'voice', 'one', ['hover', 'pickup', 'drop'])
    ]
  }
  const h = harness({
    catalog: available,
    fetch: (url) => {
      if (url.includes('broken')) throw new Error('Missing fixture')
    }
  })
  await h.engine.enable()
  assert.equal(await h.engine.voice('hover', { id: 'failure' }), true)
  h.finish()
  h.advance(1)
  assert.equal(await h.engine.voice('pickup', { id: 'failure' }), false)
  h.advance(1)
  assert.equal(await h.engine.voice('drop', { id: 'failure' }), true)
  assert.equal(
    h.started.at(-1).buffer.id,
    'third',
    'failed take is excluded and first is still the last audible clip'
  )
  assert.equal(h.started.length, 2)
  h.engine.dispose()
}

// Palette weighting favors creatures with several expressions while retaining every family.
{
  const weighted = {
    clips: [
      ...Array.from({ length: 8 }, (_, i) =>
        clip(`rich-${i}`, 'voice', 'rich', ['pickup'])
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        clip(`medium-${i}`, 'voice', 'medium', ['pickup'])
      ),
      clip('solo', 'voice', 'solo', ['pickup'])
    ]
  }
  const first = harness({ catalog: weighted })
  const second = harness({ catalog: weighted })
  const assignments = Array.from({ length: 1000 }, (_, i) =>
    first.engine.familyFor(`visitor-${i}`)
  )
  assert.equal(new Set(assignments).size, 3)
  assert.ok(assignments.filter((family) => family !== 'solo').length > 700)
  assert.deepEqual(
    assignments,
    Array.from({ length: 1000 }, (_, i) =>
      second.engine.familyFor(`visitor-${i}`)
    )
  )
  first.engine.dispose()
  second.engine.dispose()
}

// A quick release still answers, with at most one secondary drop accent.
{
  const h = harness()
  await h.engine.enable()
  h.engine.setRoom('hearth')
  assert.equal(
    await h.engine.voice('pickup', { id: 'quick', family: 'baby' }),
    true
  )
  h.advance(0.03)
  h.engine.cancelVoice('quick')
  assert.equal(await h.engine.voice('drop', { id: 'quick' }), true)
  assert.equal(h.lastStatus.lastPlayed.event, 'drop')
  assert.equal(
    await h.engine.effect('hover', {
      target: 'fire',
      priority: 1,
      paired: true
    }),
    false
  )
  assert.equal(
    await h.engine.effect('drop', {
      target: 'ceramic',
      priority: 1,
      paired: true
    }),
    true
  )
  h.advance(0.2)
  assert.equal(
    await h.engine.effect('drop', {
      target: 'fire',
      priority: 1,
      paired: true
    }),
    false
  )
  assert.ok(
    h.maxPlaying <= 3,
    'fading pickup and paired replacement respect the audible cap'
  )
  h.engine.dispose()
}

// Completed releases always request a physical landing, even for a quiet palette.
// Material coverage extends to camp water and dry rooms with no local drop clips.
{
  const h = harness()
  await h.engine.enable()
  h.engine.setExclusions({ familyIds: ['baby', 'cat'] })
  for (const [room, target, expected] of [
    ['camp', 'water', 'water'],
    ['temple', 'soft', 'soft-landing'],
    ['source', 'water', 'water'],
    ['bathhouse', 'soft', 'soft-landing']
  ]) {
    h.engine.setRoom(room)
    const result = await h.engine.drop({ id: 'quiet-visitor', room, target })
    assert.deepEqual(result, { effect: true, voice: false })
    assert.equal(h.started.at(-1).buffer.id, expected)
    h.finish()
    h.advance(0.1)
  }
  // A removed splash becomes a soft physical landing; unrelated prop sounds never fill in.
  h.engine.setExclusions({ familyIds: ['baby', 'cat'], clipIds: ['water'] })
  assert.equal(
    (await h.engine.drop({ id: 'quiet-visitor', target: 'water' })).effect,
    true
  )
  assert.equal(h.started.at(-1).buffer.id, 'soft-landing')
  h.engine.setExclusions({
    familyIds: ['baby', 'cat'],
    clipIds: ['water', 'soft-landing']
  })
  assert.deepEqual(
    await h.engine.drop({ id: 'quiet-visitor', target: 'water' }),
    { effect: false, voice: false }
  )
  h.engine.dispose()
}

// A slow voice cannot delay the physical accent, and fast consecutive drops replace
// the previous accent while leaving the three-sound ceiling intact, including fades.
{
  const gate = deferred()
  const h = harness({
    fetch: (url) => (url.includes('soft-landing') ? undefined : gate.promise)
  })
  await h.engine.enable()
  const pending = h.engine.drop({ id: 'slow-voice' })
  await settle()
  assert.equal(h.started.length, 1)
  assert.equal(h.started[0].buffer.id, 'soft-landing')
  gate.resolve()
  assert.deepEqual(await pending, { effect: true, voice: true })
  for (let i = 0; i < 12; i++) {
    h.advance(0.03)
    const result = await h.engine.drop({ id: `quick-${i}` })
    assert.equal(
      result.effect,
      true,
      'each real release retains its physical response'
    )
  }
  assert.ok(h.maxPlaying <= 3)
  h.engine.dispose()
}

// Live review exclusions discard in-flight media and stop an excluded sound.
// Removing other palettes never reshuffles visitor voices or allows cross-family borrowing.
{
  const gate = deferred()
  const h = harness({ decode: () => gate.promise })
  await h.engine.enable()
  const family = h.engine.familyFor('stable')
  const pending = h.engine.voice('pickup', { id: 'filtered', family: 'baby' })
  await settle()
  h.engine.setExclusions({ clipIds: ['baby-hello'] })
  gate.resolve()
  assert.equal(await pending, false)
  assert.equal(h.started.length, 0)
  h.advance(1)
  assert.equal(await h.engine.voice('pickup', { id: 'filtered' }), true)
  assert.equal(
    h.started.at(-1).buffer.id,
    'baby-happy',
    'emotion fallback stays in the accepted part of the same family'
  )
  h.engine.setExclusions({ familyIds: ['baby'] })
  assert.equal(h.lastStatus.active, 0)
  h.advance(0.021)
  assert.equal(h.started.at(-1).playing, false)
  assert.equal(await h.engine.voice('surprise', { id: 'filtered' }), false)
  assert.equal(h.engine.familyFor('filtered'), 'baby')
  assert.equal(h.engine.familyFor('stable'), family)
  h.engine.setExclusions({})
  h.advance(1)
  assert.equal(await h.engine.voice('pickup', { id: 'filtered' }), true)
  assert.equal(h.started.at(-1).buffer.id, 'baby-hello')
  h.engine.dispose()
}

// A review change or a re-grab cannot resurrect a pending physical landing.
for (const action of ['clip', 'source', 'cancel']) {
  const gate = deferred()
  const sourceCatalog = {
    clips: catalog.clips.map((item) => ({
      ...item,
      sourceKey: item.kind === 'voice' ? 'voices' : 'effects'
    }))
  }
  const h = harness({ catalog: sourceCatalog, fetch: () => gate.promise })
  await h.engine.enable()
  h.engine.setExclusions({ familyIds: ['baby', 'cat'] })
  const pending = h.engine.drop({ id: 'late-landing' })
  if (action === 'clip')
    h.engine.setExclusions({
      familyIds: ['baby', 'cat'],
      clipIds: ['soft-landing']
    })
  if (action === 'source')
    h.engine.setExclusions({
      familyIds: ['baby', 'cat'],
      sourceKeys: ['effects']
    })
  if (action === 'cancel') h.engine.cancelDrop('late-landing')
  assert.equal(h.calls[0].signal.aborted, true)
  gate.resolve()
  assert.deepEqual(await pending, { effect: false, voice: false })
  assert.equal(h.started.length, 0)
  h.engine.dispose()
}

// A stalled network request loses its reservation when its short event window ends.
{
  const gate = deferred()
  const h = harness({ fetch: () => gate.promise })
  await h.engine.enable()
  const pending = []
  for (const id of ['stalled-a', 'stalled-b', 'stalled-c']) {
    pending.push(h.engine.voice('pickup', { id }))
    h.advance(0.15)
  }
  h.advance(2)
  const fresh = h.engine.voice('pickup', { id: 'fresh' })
  assert.equal(h.lastStatus.pending, 1)
  assert.equal(h.calls.length, 4)
  assert.ok(h.calls.slice(0, 3).every((call) => call.signal.aborted))
  gate.resolve()
  assert.deepEqual(await Promise.all(pending), [false, false, false])
  assert.equal(await fresh, true)
  h.engine.dispose()
}

// The decoded cache evicts old recordings instead of growing with a festival.
{
  const many = {
    clips: Array.from({ length: 35 }, (_, i) =>
      clip(`sound-${i}`, 'voice', `family-${i}`, ['pickup'])
    )
  }
  const h = harness({ catalog: many })
  await h.engine.enable()
  for (let i = 0; i < 35; i++) {
    assert.equal(
      await h.engine.voice('pickup', {
        id: `visitor-${i}`,
        family: `family-${i}`
      }),
      true
    )
    h.finish()
    h.advance(2)
  }
  assert.equal(h.decodeCount, 35)
  await h.engine.voice('pickup', { id: 'visitor-0' })
  assert.equal(
    h.decodeCount,
    36,
    'the oldest decoded clip was evicted after32 entries'
  )
  h.engine.dispose()
}

console.log(
  'Sound checks passed: stable families, semantic effects, cooldowns, three-slot cap, stale loads, focus, lifecycle, and lazy decoding.'
)
