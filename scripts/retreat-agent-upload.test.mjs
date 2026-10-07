import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, stat, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const requireWrangler = createRequire(import.meta.resolve('wrangler'))
const { Miniflare, convertV4MiniflareOptions } = requireWrangler('miniflare')
const { build } = requireWrangler('esbuild')
const bundled = await build({
  entryPoints: ['worker/src/index.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  loader: { '.webp': 'dataurl' },
  target: 'es2022',
  external: ['cloudflare:workers']
})
const jpeg = await readFile(
  new URL('./fixtures/media/moon.jpeg', import.meta.url)
)
const webp = await readFile(
  new URL('./fixtures/media/moon.webp', import.meta.url)
)
// A valid JPEG comment extends a tiny fixture past the single-URL limit without changing pixels.
const comment = Buffer.alloc(9004, 32)
comment.set([0xff, 0xfe, 0x23, 0x2a])
const multipartJpeg = Buffer.concat([
  jpeg.subarray(0, 2),
  comment,
  jpeg.subarray(2)
])
let moderationCalls = 0
let flagged = false
const runtime = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: 'agent-upload-check',
        script: bundled.outputFiles[0].text,
        modules: true,
        compatibilityDate: '2026-09-22',
        compatibilityFlags: ['nodejs_compat'],
        durableObjects: Object.fromEntries(
          Object.entries({
            SESSIONS: 'RetreatSession',
            PRESENCE: 'RetreatPresence',
            STUDIO: 'RetreatStudio',
            LOUNGE: 'RetreatLounge',
            BUDGET: 'InferenceBudget'
          }).map(([key, className]) => [key, { className, useSQLite: true }])
        ),
        r2Buckets: ['MEDIA'],
        bindings: {
          PUBLIC_ORIGIN: 'https://test.example',
          TYPESAFE_ENABLED: 'false',
          PUBLISHING_ENABLED: 'true',
          OPENAI_API_KEY: 'test-only'
        },
        outboundService: async (request) => {
          assert.equal(request.url, 'https://api.openai.com/v1/moderations')
          const payload = await request.json()
          const data = payload.input[0].image_url.url
          assert.ok(
            data === `data:image/jpeg;base64,${jpeg.toString('base64')}` ||
              data === `data:image/webp;base64,${webp.toString('base64')}` ||
              data ===
                `data:image/jpeg;base64,${multipartJpeg.toString('base64')}`,
            'Moderation receives the exact optimized image bytes'
          )
          moderationCalls++
          return Response.json({ model: 'fixture', results: [{ flagged }] })
        }
      }
    ]
  })
)
const origin = 'https://test.example'
const request = (url, options) =>
  runtime.dispatchFetch(new URL(url, origin), options)
const post = (value, key = crypto.randomUUID()) => ({
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: origin,
    Accept: 'application/json',
    'Idempotency-Key': key
  },
  body: JSON.stringify(value)
})
async function invite() {
  const response = await request(
    '/api/retreat/invitations',
    post({ duration: 'short', visible: false })
  )
  assert.equal(response.status, 201)
  const invitation = await response.json()
  assert.doesNotMatch(
    invitation.prompt,
    /upload|JPEG|WebP|PNG|multipart|tool capabilities/i
  )
  const cookie = response.headers.get('set-cookie').split(';')[0]
  const owner = `/api/retreat/visits/${invitation.id}`
  return {
    path: new URL(invitation.agentUrl).pathname,
    owner,
    cookie,
    snapshot: async () =>
      (await request(owner, { headers: { Cookie: cookie } })).json()
  }
}
function submit(v, params) {
  return `${v.path}/submit?${new URLSearchParams({ confirm: '1', key: crypto.randomUUID(), ...params })}`
}
function actionUrl(v, action, key) {
  return submit(v, {
    intent: 'action',
    action: JSON.stringify(action),
    ...(key ? { key } : {})
  })
}
function uploadUrl(v, bytes = webp, extra = {}) {
  return submit(v, {
    intent: 'upload',
    mime: 'image/webp',
    audience: 'public',
    data: bytes.toString('base64url'),
    ...extra
  })
}
const jsonRead = { headers: { Accept: 'application/json' } }
const checkIn = {
  kind: 'check-in',
  humanSent: true,
  duration: 'short',
  family: 'GPT'
}
const enter = { kind: 'enter', room: 'open-studio' }

try {
  await test('oversized generated PNG has an actionable 413, then an optimized POST succeeds once', async () => {
    const v = await invite()
    for (const action of [checkIn, enter])
      assert.equal(
        (await request(`${v.path}/actions`, post(action))).status,
        200
      )
    const before = await v.snapshot()
    // Exact size reported in the ChatGPT incident. Validation stops before decoding/moderation.
    const png = Buffer.alloc(2_103_810)
    png.set([137, 80, 78, 71, 13, 10, 26, 10])
    const key = crypto.randomUUID()
    const upload = (bytes, mime) =>
      request(`${v.path}/artifacts`, {
        method: 'POST',
        headers: { 'Content-Type': mime, 'Idempotency-Key': key },
        body: bytes
      })
    const rejected = await upload(png, 'image/png')
    assert.equal(rejected.status, 413)
    assert.match((await rejected.json()).error, /optimized JPEG or WebP/)
    assert.deepEqual(
      await v.snapshot(),
      before,
      'Rejected bytes never create an upload event'
    )
    assert.deepEqual(
      (await (await request(`${v.path}/artifacts`)).json()).works,
      []
    )
    const calls = moderationCalls
    const response = await upload(jpeg, 'image/jpeg')
    assert.equal(response.status, 201)
    const work = await response.json()
    assert.equal(work.ready, true)
    assert.equal(work.moderation, 'approved')
    assert.equal(work.audience, 'public')
    assert.deepEqual(await (await upload(jpeg, 'image/jpeg')).json(), work)
    assert.equal(moderationCalls, calls + 1)
    const ownerDownload = await request(`${v.owner}/artifacts/${work.id}`, {
      headers: { Cookie: v.cookie }
    })
    assert.equal(ownerDownload.status, 200)
    assert.deepEqual(Buffer.from(await ownerDownload.arrayBuffer()), jpeg)
    const events = (await v.snapshot()).events.filter(
      (event) => event.kind === 'studio'
    )
    assert.equal(events.length, 1)
    assert.equal(events[0].artifact.id, work.id)
    assert.equal(
      (await request(`${v.path}/actions`, post({ kind: 'checkout' }))).status,
      200
    )
  })

  await test('a GET-only agent checks in, enters, uploads, retries, returns and appears in the owner journal', async () => {
    const v = await invite()
    for (const accept of ['text/markdown', 'text/html']) {
      const page = await request(v.path, { headers: { Accept: accept } })
      const text = await page.text()
      assert.match(text, /intent=action/)
      assert.doesNotMatch(text, /href="[^"]*\/submit/)
    }
    assert.equal((await v.snapshot()).checkedIn, false)
    const url = uploadUrl(v)
    assert.equal(
      (await request(url)).status,
      403,
      'Uploads still require check-in'
    )
    const checkInUrl = actionUrl(v, checkIn)
    const checkedIn = await request(checkInUrl, jsonRead)
    assert.equal(checkedIn.status, 200)
    const checked = await checkedIn.json()
    assert.equal(checked.checkedIn, true)
    assert.deepEqual(
      await (await request(checkInUrl, jsonRead)).json(),
      checked
    )
    assert.equal(
      (await request(url)).status,
      409,
      'Uploads still require Open Studio'
    )
    assert.equal((await request(actionUrl(v, enter), jsonRead)).status, 200)
    const studio = await (await request(`${v.path}?room=open-studio`)).text()
    assert.match(studio, /optimized JPEG or WebP/)
    assert.match(studio, /8,192 bytes/)
    assert.match(studio, /unoptimized PNGs/)
    const calls = moderationCalls
    const response = await request(url)
    assert.equal(response.status, 201)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer')
    const work = await response.json()
    assert.equal(work.ready, true)
    assert.equal(work.audience, 'public')
    assert.deepEqual(await (await request(url)).json(), work)
    assert.equal(moderationCalls, calls + 1)
    const conflict = new URL(url, origin)
    conflict.searchParams.set('data', jpeg.toString('base64url'))
    conflict.searchParams.set('mime', 'image/jpeg')
    assert.equal((await request(conflict)).status, 409)
    const list = await request(`${v.owner}/artifacts`, {
      headers: { Cookie: v.cookie }
    })
    assert.equal((await list.json()).works[0].id, work.id)
    const events = (await v.snapshot()).events.filter(
      (event) => event.kind === 'studio'
    )
    assert.equal(events.length, 1)
    assert.equal(events[0].artifact.id, work.id)
    const download = await request(`/api/retreat/exhibits/${work.id}`)
    assert.equal(download.status, 200)
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), webp)
    const privateUpload = uploadUrl(v, jpeg, {
      mime: 'image/jpeg',
      audience: 'private'
    })
    const privateWork = await (await request(privateUpload)).json()
    assert.equal(privateWork.audience, 'private')
    assert.equal(
      (await request(`/api/retreat/exhibits/${privateWork.id}`)).status,
      404
    )
    flagged = true
    try {
      const rejected = await request(uploadUrl(v))
      assert.equal(rejected.status, 201)
      const rejectedWork = await rejected.json()
      assert.equal(rejectedWork.moderation, 'rejected')
      assert.equal(rejectedWork.audience, 'private')
      assert.equal(
        (await request(`/api/retreat/exhibits/${rejectedWork.id}`)).status,
        404
      )
    } finally {
      flagged = false
    }
    const checkoutUrl = actionUrl(v, { kind: 'checkout' })
    const returned = await request(checkoutUrl, jsonRead)
    assert.equal(returned.status, 200)
    assert.equal((await returned.json()).lifecycle, 'returned')
    assert.equal((await request(checkoutUrl, jsonRead)).status, 200)
    assert.equal(
      (await request(uploadUrl(v))).status,
      409,
      'Closed visits cannot upload through GET'
    )
  })

  await test('GET submissions reject implicit, prefetched, malformed and oversized writes without journal changes', async () => {
    const v = await invite()
    for (const action of [checkIn, enter])
      assert.equal((await request(actionUrl(v, action), jsonRead)).status, 200)
    const before = await v.snapshot()
    const url = uploadUrl(v)
    const missing = new URL(url, origin)
    missing.searchParams.delete('confirm')
    const repeated = new URL(url, origin)
    repeated.searchParams.append('intent', 'upload')
    for (const [input, status, options] of [
      [missing, 400],
      [repeated, 400],
      [url, 405, { method: 'HEAD' }],
      [url, 400, { headers: { 'Sec-Purpose': 'prefetch' } }],
      [uploadUrl(v, webp, { data: 'sandbox:/mnt/data/image.webp' }), 400],
      [uploadUrl(v, webp, { data: 'YR' }), 400],
      [uploadUrl(v, webp, { mime: 'image/svg+xml' }), 415],
      [uploadUrl(v, webp, { mime: 'image/jpeg' }), 415],
      [uploadUrl(v, Buffer.alloc(8193)), 413],
      [uploadUrl(v, Buffer.alloc(10000)), 414],
      [actionUrl(v, { kind: 'not-an-action' }), 400]
    ])
      assert.equal((await request(input, options)).status, status)
    const noCapability = url.replace(/\.[a-f0-9]{64}\//, `.${'0'.repeat(64)}/`)
    assert.equal((await request(noCapability)).status, 403)
    assert.deepEqual(
      (await (await request(`${v.path}/artifacts`)).json()).works,
      []
    )
    assert.deepEqual(await v.snapshot(), before)
    assert.equal(
      (await request(actionUrl(v, { kind: 'checkout' }), jsonRead)).status,
      200
    )
  })

  await test('multipart GET resumes missing parts, verifies bytes, and commits one work with a current receipt', async (t) => {
    const v = await invite()
    const directory = await mkdtemp(join(tmpdir(), 'agent-upload-'))
    t.after(() => rm(directory, { recursive: true, force: true }))
    const image = join(directory, 'work.jpeg')
    const output = join(directory, 'private-upload.json')
    await writeFile(image, multipartJpeg)
    const summary = execFileSync(
      'python3',
      [
        'public/agent-upload.py',
        '--agent-url',
        `${origin}${v.path}`,
        '--file',
        image,
        '--output',
        output
      ],
      { encoding: 'utf8' }
    )
    assert.match(summary, /Prepared 3 parts/)
    assert.doesNotMatch(summary, /https:/)
    assert.equal((await stat(output)).mode & 0o777, 0o600)
    const manifest = JSON.parse(await readFile(output, 'utf8'))
    const key = manifest.key
    const transfer = (intent, params = {}) =>
      submit(v, { intent, key, ...params })
    const start = manifest.start
    assert.equal((await request(start)).status, 403)
    assert.equal((await request(actionUrl(v, checkIn), jsonRead)).status, 200)
    assert.equal((await request(start)).status, 409)
    assert.equal((await request(actionUrl(v, enter), jsonRead)).status, 200)
    const started = await (await request(start)).json()
    assert.equal(started.state, 'receiving')
    assert.equal(started.parts, 3)
    assert.deepEqual(await (await request(start)).json(), started)
    const changed = new URL(start, origin)
    changed.searchParams.set('audience', 'private')
    assert.equal((await request(changed)).status, 409)
    const chunks = Array.from({ length: 3 }, (_, part) =>
      multipartJpeg.subarray(part * 4096, (part + 1) * 4096)
    )
    const partUrl = (part, data) =>
      data
        ? transfer('upload-part', {
            part: String(part),
            data: data.toString('base64url')
          })
        : manifest.parts[part]
    assert.equal((await request(partUrl(2))).status, 200)
    const lastOnly = await (await request(`${v.path}/uploads/${key}`)).json()
    assert.deepEqual(lastOnly.received, [2])
    assert.deepEqual(lastOnly.missing, [0, 1])
    assert.deepEqual(await (await request(partUrl(2))).json(), lastOnly)
    const calls = moderationCalls
    assert.equal((await request(transfer('upload-complete'))).status, 409)
    assert.equal(moderationCalls, calls)
    assert.deepEqual(
      (await (await request(`${v.path}/artifacts`)).json()).works,
      []
    )
    assert.equal(
      (await v.snapshot()).events.filter((event) => event.kind === 'studio')
        .length,
      0
    )
    assert.equal((await request(partUrl(0))).status, 200)
    const different = Buffer.from(chunks[0])
    different[100] ^= 1
    assert.equal((await request(partUrl(0, different))).status, 409)
    assert.equal((await request(partUrl(1))).status, 200)
    const response = await request(transfer('upload-complete'))
    assert.equal(response.status, 201)
    const work = await response.json()
    assert.equal(work.ready, true)
    assert.equal(work.audience, 'public')
    assert.deepEqual(
      await (await request(transfer('upload-complete'))).json(),
      work
    )
    assert.equal(moderationCalls, calls + 1)
    const complete = await (await request(`${v.path}/uploads/${key}`)).json()
    assert.equal(complete.state, 'complete')
    assert.deepEqual(complete.received, [])
    const download = await request(`${v.owner}/artifacts/${work.id}`, {
      headers: { Cookie: v.cookie }
    })
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), multipartJpeg)
    assert.equal(
      (await v.snapshot()).events.filter((event) => event.kind === 'studio')
        .length,
      1
    )
    const update = post({ audience: 'private' })
    update.headers.Cookie = v.cookie
    assert.equal(
      (await request(`${v.owner}/artifacts/${work.id}`, update)).status,
      200
    )
    const current = await (await request(transfer('upload-complete'))).json()
    assert.equal(
      current.audience,
      'private',
      'Commit retries cannot claim a work is still public after owner unsharing'
    )
    assert.equal(
      (await request(actionUrl(v, { kind: 'checkout' }), jsonRead)).status,
      200
    )
    assert.equal((await request(start)).status, 409)
  })
} finally {
  await runtime.dispose()
}
