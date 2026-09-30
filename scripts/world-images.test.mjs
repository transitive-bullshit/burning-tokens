import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import { afterEach, test } from 'node:test'
import {
  loadWorldImage,
  warmWorldImagesOnIdle
} from '../lib/world/image-cache.ts'

const originals = Object.fromEntries(
  ['Image', 'window', 'document', 'navigator'].map((key) => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key)
  ])
)
afterEach(() => {
  for (const [key, descriptor] of Object.entries(originals)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})
function browser() {
  const requested = []
  class Image {
    constructor() {
      requested.push(this)
    }
    decode() {
      return Promise.resolve()
    }
  }
  const idle = new Map()
  let id = 0
  const document = new EventTarget()
  document.hidden = false
  const navigator = { connection: {} }
  const window = {
    requestIdleCallback: (callback) => {
      idle.set(++id, callback)
      return id
    },
    cancelIdleCallback: (key) => idle.delete(key)
  }
  for (const [key, value] of Object.entries({
    Image,
    document,
    navigator,
    window
  }))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  const runIdle = () => {
    const [key, callback] = idle.entries().next().value
    idle.delete(key)
    callback()
  }
  return { requested, idle, runIdle, document, navigator, window }
}

await test('navigation reuses an in-flight prefetch and waits for decode, then reuses the decoded image', async () => {
  const { requested } = browser()
  const first = loadWorldImage('/dedup.webp', 'low')
  const second = loadWorldImage('/dedup.webp')
  assert.equal(first, second)
  assert.equal(requested.length, 1)
  assert.equal(requested[0].fetchPriority, 'high')
  let finishDecode
  requested[0].decode = () =>
    new Promise((resolve) => {
      finishDecode = resolve
    })
  let ready = false
  void first.then(() => {
    ready = true
  })
  requested[0].onload()
  await setImmediate()
  assert.equal(ready, false)
  finishDecode()
  assert.equal(await first, requested[0])
  assert.equal(await loadWorldImage('/dedup.webp'), requested[0])
  assert.equal(requested.length, 1)
})

await test('failed fetches and decodes can be retried on a later visit', async () => {
  const { requested } = browser()
  const first = loadWorldImage('/retry.webp')
  requested[0].onerror()
  await assert.rejects(first, /Could not load/)
  const second = loadWorldImage('/retry.webp')
  requested[1].decode = () => Promise.reject(new Error('decode'))
  requested[1].onload()
  await assert.rejects(second, /decode/)
  const third = loadWorldImage('/retry.webp')
  requested[2].onload()
  assert.equal(await third, requested[2])
})

await test('idle warmup loads serially and does not start another image after unmount', async () => {
  const { requested, idle, runIdle } = browser()
  const cancel = warmWorldImagesOnIdle([
    '/idle-a.webp',
    '/idle-b.webp',
    '/idle-c.webp'
  ])
  assert.equal(requested.length, 0)
  runIdle()
  assert.equal(requested.length, 1)
  assert.equal(requested[0].fetchPriority, 'low')
  assert.equal(idle.size, 0)
  requested[0].onload()
  await setImmediate()
  runIdle()
  assert.equal(requested.length, 2)
  cancel()
  requested[1].onload()
  await setImmediate()
  assert.equal(idle.size, 0)
  assert.equal(requested.length, 2)
})

await test('warmup pauses in hidden tabs and respects data saving and slow connections', async () => {
  const { requested, idle, runIdle, document, navigator } = browser()
  navigator.connection.saveData = true
  warmWorldImagesOnIdle(['/save-data.webp'])()
  assert.equal(idle.size, 0)
  navigator.connection = { effectiveType: 'slow-2g' }
  warmWorldImagesOnIdle(['/slow.webp'])()
  assert.equal(idle.size, 0)
  navigator.connection = {}
  const cancel = warmWorldImagesOnIdle(['/hidden.webp'])
  document.hidden = true
  runIdle()
  assert.equal(requested.length, 0)
  document.hidden = false
  document.dispatchEvent(new Event('visibilitychange'))
  assert.equal(idle.size, 1)
  cancel()
  assert.equal(idle.size, 0)
})

await test('browsers without requestIdleCallback use a cancellable deferred warmup', () => {
  const { window } = browser()
  delete window.requestIdleCallback
  let cleared
  window.setTimeout = () => 42
  window.clearTimeout = (id) => {
    cleared = id
  }
  warmWorldImagesOnIdle(['/fallback.webp'])()
  assert.equal(cleared, 42)
})
