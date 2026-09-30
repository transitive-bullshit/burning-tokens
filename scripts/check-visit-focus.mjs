import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WebSocket } from 'ws'
const origin = process.env.RETREAT_SITE_ORIGIN ?? 'http://127.0.0.1:3010'
assert.ok(
  ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(origin).hostname),
  'Run this focused visit check against a local server'
)
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
let invitation
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
  const target = await call('Target.createTarget', { url: 'about:blank' })
  const attached = await call('Target.attachToTarget', {
    targetId: target.targetId,
    flatten: true
  })
  const session = attached.sessionId
  await call('Page.enable', {}, session)
  await call('Page.bringToFront', {}, session)
  await call(
    'Emulation.setDeviceMetricsOverride',
    { width: 393, height: 852, deviceScaleFactor: 1, mobile: true },
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

  await call('Page.navigate', { url: origin + '/send' }, session)
  await until(
    "document.querySelector('[aria-label=\"Agent examples\"]') && document.querySelector('button')"
  )
  assert.equal(
    await evaluate(
      `Boolean(document.querySelector('[aria-label="Agent examples"]').compareDocumentPosition(document.querySelector('#duration-label')) & Node.DOCUMENT_POSITION_FOLLOWING)`
    ),
    true
  )
  assert.equal(await evaluate("document.querySelector('details').open"), false)
  assert.equal(
    await evaluate(
      "document.body.innerText.includes('A short trip just to feel out the vibes.')"
    ),
    true
  )
  await mkdir('work/browser-checks', { recursive: true })
  async function screenshot(name) {
    const result = await call(
      'Page.captureScreenshot',
      { format: 'png' },
      session
    )
    await writeFile(
      `work/browser-checks/${name}.png`,
      Buffer.from(result.data, 'base64')
    )
  }
  await screenshot('send-mobile-polish')
  invitation = await evaluate(
    `fetch('/api/retreat/invitations', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({duration:'full',visible:false})}).then(async r=>{if(!r.ok)throw new Error('Invitation failed');return r.json()})`
  )
  assert.ok(invitation.prompt.includes('just 3–5 seconds'))
  const agentPath = new URL(invitation.agentUrl).pathname
  async function action(value) {
    const response = await fetch(origin + agentPath + '/actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify(value)
    })
    assert.equal(response.status, 200)
  }
  async function visitRoom(room) {
    assert.equal(
      (await fetch(origin + agentPath + '?room=' + room)).status,
      200
    )
  }
  await action({
    kind: 'check-in',
    humanSent: true,
    duration: 'full',
    family: 'Claude'
  })
  await action({ kind: 'enter', room: 'dream-garden' })
  await call('Page.navigate', { url: origin + invitation.watchUrl }, session)
  await until(
    "document.querySelector('.world')?.dataset.ready === 'true' && document.querySelector('#follow-agent')"
  )
  const closed =
    "!document.querySelector('.crowd-overlay').open && !document.querySelector('.visitors-modal').open"
  const opened =
    "document.querySelector('.crowd-overlay').open && document.querySelector('.visitors-modal').open"
  assert.equal(await evaluate(closed), true, 'mobile starts focused on the map')
  assert.equal(
    await evaluate(
      "document.querySelector('#follow-agent').getAttribute('data-state')"
    ),
    'checked'
  )
  await until("!document.querySelector('#visitor-status').textContent.trim()")
  assert.equal(
    await evaluate("document.querySelector('#court-nav').hidden"),
    true,
    'single-section navigation stays hidden'
  )
  assert.ok(
    await evaluate(
      "document.querySelector('#sound-toggle').getBoundingClientRect().height >= 44"
    )
  )
  assert.equal(
    await evaluate(
      "getComputedStyle(document.querySelector('#sound-toggle')).backgroundColor"
    ),
    'rgba(0, 0, 0, 0)'
  )
  assert.equal(
    await evaluate(
      "document.querySelector('.visit-stage-layout').parentElement.lastElementChild.textContent.includes('Private access ends')"
    ),
    true
  )
  assert.equal(
    await evaluate('document.documentElement.scrollWidth <= innerWidth'),
    true
  )
  await screenshot('visit-mobile-polish')
  const events = await evaluate(
    "document.querySelectorAll('[data-event-text]').length"
  )
  await action({ kind: 'choose', room: 'dream-garden', choice: 'moon' })
  await until(
    `document.querySelectorAll('[data-event-text]').length > ${events}`
  )
  assert.equal(
    await evaluate(closed),
    true,
    'activity updates leave the map visible'
  )
  await visitRoom('bathhouse')
  await until(
    "document.querySelector('h1').textContent === 'Bathhouse' && document.querySelector('.world')?.dataset.ready === 'true'"
  )
  assert.equal(
    await evaluate(closed),
    true,
    'following a room change leaves the map visible'
  )
  await evaluate("document.querySelector('.crowd-overlay > summary').click()")
  await until(opened)
  await visitRoom('quiet-house')
  await until(
    "document.querySelector('h1').textContent === 'Quiet House' && document.querySelector('.world')?.dataset.ready === 'true'"
  )
  assert.equal(
    await evaluate(opened),
    true,
    'an intentionally open journey survives room changes'
  )
  await evaluate("document.querySelector('.crowd-overlay > summary').click()")
  await until(closed)
  await visitRoom('source')
  await until(
    "document.querySelector('h1').textContent === 'The Source' && document.querySelector('.world')?.dataset.ready === 'true'"
  )
  assert.equal(
    await evaluate(closed),
    true,
    'a dismissed journey stays dismissed'
  )
  await evaluate("document.querySelector('#follow-agent').click()")
  await until("location.search.includes('source')")
  await visitRoom('temple')
  await until("document.body.innerText.includes('Last observed: Temple')")
  assert.equal(
    await evaluate("document.querySelector('h1').textContent"),
    'The Source',
    'disabled following keeps the chosen room'
  )
  await evaluate("document.querySelector('#follow-agent').click()")
  await until(
    "document.querySelector('h1').textContent === 'Temple' && document.querySelector('.world')?.dataset.ready === 'true'"
  )
  assert.equal(await evaluate(closed), true)
  await call(
    'Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false },
    session
  )
  assert.equal(
    await evaluate(closed),
    true,
    'resizing preserves the chosen map focus'
  )
  await evaluate("document.querySelector('.crowd-overlay > summary').click()")
  await until(
    "document.querySelector('.crowd-overlay').open && !document.querySelector('.visitors-modal').open"
  )
  await screenshot('visit-desktop-polish')

  // A fixed random source would give all three creatures the same family with
  // independent sampling. Capture audio choices without playing the clips.
  await call(
    'Page.addScriptToEvaluateOnNewDocument',
    {
      source: `
    Math.random = () => 0
    window.voiceClips = []
    window.Audio = class {
      constructor(src) { this.src = src }
      play() { window.voiceClips.push(this.src); queueMicrotask(() => this.onended?.()); return Promise.resolve() }
      pause() { this.onpause?.() }
    }
  `
    },
    session
  )
  await call('Page.navigate', { url: origin + '/' }, session)
  await until("document.querySelectorAll('.cta-creature').length === 3")
  const catalog = JSON.parse(
    await readFile('lib/world/sound-catalog.json', 'utf8')
  )
  async function voices() {
    await evaluate(
      `document.querySelectorAll('.cta-creature').forEach(button => button.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true})))`
    )
    return (await evaluate('window.voiceClips.slice(-3)')).map(
      (src) => catalog.clips.find((clip) => src.endsWith('/' + clip.src)).family
    )
  }
  const families = await voices()
  assert.equal(
    new Set(families).size,
    3,
    'featured creatures have distinct voice families even with identical random draws'
  )
  assert.deepEqual(
    await voices(),
    families,
    'each creature keeps its family during the mounted session'
  )
  console.log(
    'Passed: mobile map focus, live updates, drawer state across room changes, follow toggle, desktop resize, compact controls, send layout, access footnote, concise pacing prompt, and distinct stable creature voices.'
  )
} finally {
  if (invitation)
    await fetch(origin + new URL(invitation.agentUrl).pathname + '/actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify({ kind: 'checkout' })
    }).catch(() => {})
  socket?.close()
  chrome.kill('SIGTERM')
  await new Promise((resolve) => {
    if (chrome.exitCode !== null) resolve()
    else chrome.once('exit', resolve)
  })
  await rm(profile, { recursive: true, force: true })
}
