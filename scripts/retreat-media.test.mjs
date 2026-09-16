import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canReadArtifact,
  effectiveAudience,
  validateMedia,
  readMediaBody,
  MAX_ARTIFACT_BYTES
} from '../worker/src/media-policy.ts'
import { moderateMedia } from '../worker/src/moderation.ts'
const bytes = new TextEncoder().encode('A small unnecessary poem.')
const artifact = {
  authorId: 'a',
  audience: 'agents',
  moderation: 'approved',
  expiresAt: 100,
  deleted: false,
  ready: true,
  publicationAuthorized: true
}

await test('private, agent-shared and public audiences stay distinct', () => {
  assert.equal(canReadArtifact(artifact, { kind: 'public' }, 1, true), false)
  assert.equal(
    canReadArtifact(artifact, { kind: 'owner', sessionId: 'b' }, 1, true),
    false
  )
  assert.equal(
    canReadArtifact(artifact, { kind: 'agent', sessionId: 'b' }, 1, true),
    true
  )
  for (const moderation of ['pending', 'rejected', 'error', 'unsupported']) {
    const privateWork = { ...artifact, moderation }
    assert.equal(
      canReadArtifact(privateWork, { kind: 'agent', sessionId: 'b' }, 1, true),
      false
    )
    assert.equal(
      canReadArtifact(privateWork, { kind: 'owner', sessionId: 'a' }, 1, false),
      true
    )
    assert.equal(
      canReadArtifact(privateWork, { kind: 'admin' }, 1, false),
      true
    )
    assert.equal(effectiveAudience('public', moderation), 'private')
  }
  assert.equal(
    canReadArtifact(
      { ...artifact, audience: 'public' },
      { kind: 'public' },
      1,
      false
    ),
    false
  )
  assert.equal(
    canReadArtifact(
      { ...artifact, audience: 'public' },
      { kind: 'public' },
      1,
      true
    ),
    true
  )
  for (const patch of [{ deleted: true }, { expiresAt: 1 }])
    assert.equal(
      canReadArtifact({ ...artifact, ...patch }, { kind: 'admin' }, 1, true),
      false
    )
})

await test('file validation rejects HTML/SVG, mismatched signatures and oversized chunked bodies', async () => {
  assert.equal(validateMedia(bytes, 'text/plain; charset=utf-8'), 'text/plain')
  for (const mime of ['text/html', 'image/svg+xml', 'image/png'])
    assert.throws(() => validateMedia(bytes, mime))
  assert.throws(() => validateMedia(new Uint8Array([0xff]), 'text/plain'))
  const request = new Request('https://example.test', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_ARTIFACT_BYTES))
        controller.enqueue(new Uint8Array(1))
        controller.close()
      }
    }),
    duplex: 'half'
  })
  await assert.rejects(readMediaBody(request), /exceeds/)
})

await test('moderation fails closed on unsupported, missing, rejected and malformed service responses', async () => {
  let calls = 0
  const never = async () => {
    calls++
    throw new Error('unexpected call')
  }
  assert.equal(
    (await moderateMedia(bytes, 'audio/wav', 'key', never)).state,
    'unsupported'
  )
  assert.equal(
    (await moderateMedia(bytes, 'text/plain', undefined, never)).state,
    'error'
  )
  assert.equal(calls, 0)
  for (const [body, expected] of [
    [{ model: 'test', results: [{ flagged: false }] }, 'approved'],
    [{ model: 'test', results: [{ flagged: true }] }, 'rejected'],
    [{ model: 'test', results: [] }, 'error'],
    [{ model: 'test', results: [{ flagged: 'false' }] }, 'error']
  ]) {
    const mock = async (_url, options) => {
      const payload = JSON.parse(options.body)
      assert.equal(payload.input[0].text, new TextDecoder().decode(bytes))
      assert.deepEqual(Object.keys(payload), ['model', 'input'])
      return Response.json(body)
    }
    assert.equal(
      (await moderateMedia(bytes, 'text/plain', 'test-key', mock)).state,
      expected
    )
  }
  assert.equal(
    (
      await moderateMedia(bytes, 'text/plain', 'test-key', async () => {
        throw new Error('outage')
      })
    ).state,
    'error'
  )
})

await test('legacy moderated works cannot become shared merely by enabling publishing', () => {
  const legacy = {
    ...artifact,
    audience: 'public',
    publicationAuthorized: undefined
  }
  assert.equal(canReadArtifact(legacy, { kind: 'public' }, 1, true), false)
  assert.equal(
    canReadArtifact(legacy, { kind: 'owner', sessionId: 'a' }, 1, true),
    true
  )
})

await test('only administrators can review pending contributions before publication', () => {
  const pending = {
    ...artifact,
    ready: false,
    moderation: 'pending',
    audience: 'private'
  }
  assert.equal(canReadArtifact(pending, { kind: 'admin' }, 1, false), true)
  for (const viewer of [
    { kind: 'public' },
    { kind: 'agent', sessionId: 'a' },
    { kind: 'owner', sessionId: 'a' }
  ])
    assert.equal(canReadArtifact(pending, viewer, 1, true), false)
})
