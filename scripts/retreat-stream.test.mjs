import assert from 'node:assert/strict'
import test from 'node:test'
import {
  visitFrame,
  applyVisitFrame,
  MAX_VISIT_FRAME_BYTES
} from '../lib/retreat/visit-stream.ts'
import { VisitStream } from '../worker/src/visit-stream.ts'

const snapshot = (revision) => ({
  id: 'private-visit',
  publicId: 'public-visit',
  avatarSeed: 1,
  family: 'unknown',
  lifecycle: 'visiting',
  room: 'bathhouse',
  revision,
  duration: 'full',
  remainingActions: 20,
  expiresAt: 999999,
  lastSeen: 100,
  restUntil: null,
  visible: true,
  checkedIn: true,
  events: Array.from({ length: Math.min(200, revision) }, (_, i) => ({
    sequence: Math.max(1, revision - 199) + i,
    at: 100,
    room: 'bathhouse',
    kind: 'observed',
    text: 'Page requested'
  })),
  nudges: [],
  reflection: null,
  lastResponse: null
})
class Socket {
  frames = []
  attachment = null
  closed = null
  send(text) {
    this.frames.push(JSON.parse(text))
  }
  serializeAttachment(value) {
    this.attachment = structuredClone(value)
  }
  deserializeAttachment() {
    return structuredClone(this.attachment)
  }
  close(code) {
    this.closed = code
  }
}
const ack = (revision) => JSON.stringify({ type: 'ack', revision })

await test('replay merges contiguous events once and falls back when the journal no longer covers a cursor', () => {
  const previous = snapshot(10)
  const delta = visitFrame(snapshot(12), 10)
  assert.equal(delta.type, 'delta')
  assert.deepEqual(
    delta.events.map((event) => event.sequence),
    [11, 12]
  )
  assert.equal('events' in delta.visit, false)
  const next = applyVisitFrame(previous, delta)
  assert.deepEqual(next, snapshot(12))
  assert.equal(applyVisitFrame(next, delta), next)
  assert.deepEqual(applyVisitFrame(snapshot(11), delta), next)
  assert.equal(visitFrame(snapshot(210), 9).type, 'snapshot')
  assert.equal(visitFrame(snapshot(210), 10).type, 'delta')
  assert.throws(() => applyVisitFrame(previous, { ...delta, from: 11 }))
  assert.throws(() =>
    applyVisitFrame(previous, { ...delta, events: delta.events.slice(1) })
  )
  assert.throws(() =>
    applyVisitFrame(previous, {
      ...delta,
      visit: { ...delta.visit, id: 'other' }
    })
  )
  assert.equal(
    applyVisitFrame(snapshot(199), visitFrame(snapshot(210), 199)).events
      .length,
    200
  )
})

await test('one outstanding frame bounds slow-client buffers; attachment survives a new handler', () => {
  let state = snapshot(1)
  let clock = 100
  let stream = new VisitStream(
    () => state,
    () => clock
  )
  const socket = new Socket()
  stream.open(socket, null)
  for (let i = 2; i <= 201; i++) {
    state = snapshot(i)
    stream.send(socket)
  }
  assert.equal(socket.frames.length, 1)
  stream = new VisitStream(
    () => state,
    () => clock
  )
  stream.message(socket, ack(1))
  assert.equal(socket.frames.length, 2)
  assert.equal(socket.frames[1].type, 'delta')
  assert.equal(socket.frames[1].events.length, 200)
  state = snapshot(202)
  clock += 30001
  stream.send(socket)
  assert.equal(socket.closed, 1013)
  const reconnected = new Socket()
  stream.open(reconnected, 1)
  assert.equal(reconnected.frames[0].type, 'snapshot')
  assert.equal(reconnected.frames[0].visit.revision, 202)
})

await test('oversized frames and invalid acknowledgements close instead of queueing', () => {
  const stream = new VisitStream(() => snapshot(1))
  for (const message of [ack(9), '{}', 'x'.repeat(129), new ArrayBuffer(10)]) {
    const socket = new Socket()
    stream.open(socket, null)
    stream.message(socket, message)
    assert.equal(socket.closed, 1008)
  }
  const socket = new Socket()
  new VisitStream(() => ({
    ...snapshot(1),
    lastResponse: 'x'.repeat(MAX_VISIT_FRAME_BYTES)
  })).open(socket, null)
  assert.equal(socket.closed, 1009)
  assert.equal(socket.frames.length, 0)
})

await test('a disconnected socket cannot interrupt a committed action broadcast', () => {
  const socket = new Socket()
  const stream = new VisitStream(() => snapshot(1))
  socket.send = () => {
    throw new Error('Disconnected')
  }
  socket.close = () => {
    throw new Error('Already closed')
  }
  assert.doesNotThrow(() => stream.open(socket, null))
})
