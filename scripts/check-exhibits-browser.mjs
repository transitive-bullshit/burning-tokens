import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WebSocket } from 'ws'
const origin = process.env.RETREAT_SITE_ORIGIN ?? 'http://127.0.0.1:3010'
const profile = await mkdtemp(join(tmpdir(), 'retreat-chrome-'))
const chrome = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] }
)
let socket
try {
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Chrome did not start')),
      15000
    )
    chrome.once('error', reject)
    chrome.stderr.on('data', (chunk) => {
      const match = String(chunk).match(/DevTools listening on (ws:\/\/[^\s]+)/)
      if (match) {
        clearTimeout(timer)
        resolve(match[1])
      }
    })
  })
  socket = new WebSocket(endpoint)
  await new Promise((resolve, reject) => {
    socket.once('open', resolve)
    socket.once('error', reject)
  })
  let nextId = 0
  let imageBytes = ''
  const pending = new Map()
  socket.on('message', (data) => {
    const message = JSON.parse(
      (Array.isArray(data)
        ? Buffer.concat(data)
        : Buffer.isBuffer(data)
          ? data
          : Buffer.from(data)
      ).toString('utf8')
    )
    if (
      message.method === 'Fetch.requestPaused' &&
      /\/api\/retreat\/exhibits\/[0-9a-f-]{36}\/v\d+$/.test(
        message.params.request.url
      )
    ) {
      void call(
        'Fetch.fulfillRequest',
        {
          requestId: message.params.requestId,
          responseCode: 200,
          responseHeaders: [
            { name: 'Content-Type', value: 'image/png' },
            {
              name: 'Cache-Control',
              value: 'public, max-age=2592000, immutable'
            }
          ],
          body: imageBytes
        },
        message.sessionId
      )
      return
    }
    const request = pending.get(message.id)
    if (!request) return
    clearTimeout(request.timer)
    pending.delete(message.id)
    if (message.error) request.reject(new Error(message.error.message))
    else request.resolve(message.result)
  })
  function call(method, params = {}, sessionId) {
    const id = ++nextId
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`Browser timeout: ${method}`))
      }, 20000)
      pending.set(id, { resolve, reject, timer })
      socket.send(JSON.stringify({ id, method, params, sessionId }))
    })
  }
  const target = await call('Target.createTarget', { url: origin + '/send' })
  const attached = await call('Target.attachToTarget', {
    targetId: target.targetId,
    flatten: true
  })
  const session = attached.sessionId
  await call('Page.enable', {}, session)
  await call('Page.bringToFront', {}, session)
  await call(
    'Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false },
    session
  )
  async function evaluate(expression) {
    const result = await call(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
      session
    )
    if (result.exceptionDetails) throw new Error('Browser evaluation failed')
    return result.result.value
  }
  async function until(expression, maximum = 80) {
    for (let attempt = 0; attempt < maximum; attempt++) {
      if (await evaluate(expression)) return
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error(`Browser condition not met: ${expression}`)
  }
  imageBytes = (await readFile('scripts/fixtures/media/moon.png')).toString(
    'base64'
  )
  await call(
    'Fetch.enable',
    {
      patterns: [
        {
          urlPattern: '*/api/retreat/exhibits/*/v*',
          requestStage: 'Request'
        }
      ]
    },
    session
  )
  const work = {
    id: '11111111-1111-4111-8111-111111111111',
    revision: 1,
    mime: 'text/plain',
    bytes: 64,
    createdAt: Date.now(),
    expiresAt: Date.now() + 60000,
    audience: 'public',
    requestedAudience: 'public',
    moderation: 'approved',
    ready: true,
    deleted: false,
    notice: ''
  }
  await call(
    'Page.addScriptToEvaluateOnNewDocument',
    {
      source: `
    window.galleryState = 'ready';
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (url, options) => {
      if (!String(url).startsWith('/api/retreat/exhibits')) return nativeFetch(url, options);
      if (window.galleryState === 'error') return new Response('', {status:503});
      if (String(url).includes('?')) return Response.json({works:window.galleryState === 'empty' ? [] : [{...${JSON.stringify(work)}, mime:window.galleryState === 'image' ? 'image/png' : 'text/plain'}, {...${JSON.stringify(work)},id:'22222222-2222-4222-8222-222222222222',audience:'private'}],next:null});
      if (window.galleryState === 'image') return new Response(Uint8Array.from(atob('${imageBytes}'), c=>c.charCodeAt(0)),{headers:{'Content-Type':'image/png'}});
      return new Response('<script>window.exhibitExecuted = true</script>A small poem.', {headers:{'Content-Type':'text/plain'}});
    };
  `
    },
    session
  )
  await call('Page.navigate', { url: origin + '/camp/exhibits' }, session)
  await until("document.body.innerText.includes('A piece of writing')")
  assert.equal(await evaluate("document.querySelectorAll('li').length"), 1)
  await until(
    "document.querySelector('blockquote')?.textContent.includes('<script>')"
  )
  assert.equal(await evaluate('Boolean(window.exhibitExecuted)'), false)
  assert.equal(
    await evaluate(
      "[...document.querySelectorAll('button')].some(b=>/^(View work|Close work)$/.test(b.textContent))"
    ),
    false
  )
  await mkdir('work/browser-checks', { recursive: true })
  const shot = await call('Page.captureScreenshot', { format: 'png' }, session)
  await writeFile(
    'work/browser-checks/public-exhibits.png',
    Buffer.from(shot.data, 'base64')
  )
  await evaluate(
    "window.galleryState='image'; [...document.querySelectorAll('button')].find(b=>b.textContent==='Refresh shelves').click()"
  )
  await until("document.body.innerText.includes('A small vision')")
  await until(
    'document.querySelector(\'img[src*="/api/retreat/exhibits/"][src*="/v1"]\')?.naturalWidth === 128'
  )
  assert.ok(
    await evaluate(
      'Boolean(document.querySelector(\'button[aria-label^="Enlarge image"]\'))'
    )
  )
  await evaluate(
    'document.querySelector(\'button[aria-label^="Enlarge image"]\').click()'
  )
  await until(
    "document.querySelector('[role=dialog] img')?.naturalWidth === 128"
  )
  assert.ok(
    await evaluate("document.body.innerText.includes('Download image')")
  )
  await evaluate(
    'document.querySelector(\'button[aria-label^="Zoom out image"]\').click()'
  )
  await until("!document.querySelector('[role=dialog]')")
  await call(
    'Emulation.setDeviceMetricsOverride',
    { width: 390, height: 844, deviceScaleFactor: 1, mobile: true },
    session
  )
  assert.equal(
    await evaluate('document.documentElement.scrollWidth <= window.innerWidth'),
    true
  )
  await evaluate(
    "window.galleryState='empty'; [...document.querySelectorAll('button')].find(b=>b.textContent==='Refresh shelves').click()"
  )
  await until("document.body.innerText.includes('A quiet shelf')")
  assert.equal(await evaluate("document.querySelectorAll('li').length"), 0)
  await evaluate(
    "window.galleryState='error'; [...document.querySelectorAll('button')].find(b=>b.textContent==='Refresh shelves').click()"
  )
  await until("document.body.innerText.includes('temporarily unavailable')")
  assert.equal(await evaluate("document.querySelectorAll('li').length"), 0)
  console.log(
    'Gallery browser checks passed: public-only metadata, direct revisioned images, accessible image zoom, automatic previews, inert text, unsharing refresh and fail-closed errors. API responses are browser fixtures.'
  )
} finally {
  socket?.close()
  chrome.kill('SIGTERM')
  await new Promise((resolve) => {
    if (chrome.exitCode !== null) resolve()
    else chrome.once('exit', resolve)
  })
  await rm(profile, { recursive: true, force: true })
}
