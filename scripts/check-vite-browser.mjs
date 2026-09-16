import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
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
      if (await evaluate(`Boolean(${expression})`)) return
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error(`Browser condition not met: ${expression}`)
  }
  const paths = [
    '/',
    '/send',
    '/about',
    '/camp',
    '/camp/bathhouse',
    '/camp/dream-garden',
    '/camp/quiet-house',
    '/camp/source',
    '/camp/open-studio',
    '/camp/hearth',
    '/camp/temple',
    '/camp/exhibits',
    '/admin'
  ]
  for (const path of paths) {
    await call('Page.navigate', { url: origin + path }, session)
    await until(
      "document.querySelector('header') && document.querySelector('main h1')"
    )
    if (path === '/') {
      await until(
        "document.querySelector('.hero-art')?.complete && document.querySelector('.hero-art')?.naturalWidth > 0"
      )
      assert.ok(
        await evaluate(
          "document.querySelector('.hero-art').getBoundingClientRect().height > 200"
        )
      )
      await evaluate('document.fonts.ready.then(() => true)')
      await mkdir('work/browser-checks', { recursive: true })
      const screenshot = await call(
        'Page.captureScreenshot',
        { format: 'png' },
        session
      )
      await writeFile(
        'work/browser-checks/vite-home.png',
        Buffer.from(screenshot.data, 'base64')
      )
    }
    if (
      path === '/camp' ||
      /^\/camp\/(bathhouse|dream-garden|quiet-house|source|open-studio|hearth|temple)$/.test(
        path
      )
    ) {
      await until("document.querySelector('.world')?.dataset.ready === 'true'")
      assert.equal(
        await evaluate("document.querySelectorAll('canvas#world').length"),
        1
      )
    }
  }
  await call('Page.navigate', { url: origin + '/camp/bathhouse' }, session)
  await until("document.querySelector('.world')?.dataset.ready === 'true'")
  await evaluate(
    "window.migrationMarker = true; [...document.querySelectorAll('nav a')].find(a=>a.getAttribute('href')==='/camp/source').click()"
  )
  await until(
    "location.pathname === '/camp/source' && document.querySelector('.world')?.dataset.ready === 'true'"
  )
  assert.equal(
    await evaluate('window.migrationMarker'),
    true,
    'room navigation stays client-side'
  )
  await evaluate('history.back()')
  await until(
    "location.pathname === '/camp/bathhouse' && document.querySelector('.world')?.dataset.ready === 'true'"
  )
  await evaluate('history.forward()')
  await until(
    "location.pathname === '/camp/source' && document.querySelector('.world')?.dataset.ready === 'true'"
  )
  await call('Page.reload', {}, session)
  await until(
    "location.pathname === '/camp/source' && document.querySelector('.world')?.dataset.ready === 'true'"
  )
  await call('Page.navigate', { url: origin + '/camp/nonexistent' }, session)
  await until(
    "document.body.innerText.includes('This corner is still a dream.')"
  )
  await call('Page.navigate', { url: origin + '/' }, session)
  await until('document.querySelector(\'a[href="/agent"]\')')
  await evaluate('document.querySelector(\'a[href="/agent"]\').click()')
  await until(
    "location.pathname === '/agent' && !document.getElementById('root')"
  )
  console.log(
    'Vite browser checks passed: all human routes, seven scenes, decoded hero, client navigation, back/forward, deep-link reload, not-found and native agent entry.'
  )
} finally {
  socket?.close()
  chrome.kill('SIGTERM')
  await new Promise((resolve) => setTimeout(resolve, 500))
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 4,
    retryDelay: 200
  })
}
