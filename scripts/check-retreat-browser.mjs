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
let invitation
let artifact
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
  await call('Network.enable', {}, session)
  await call(
    'Page.addScriptToEvaluateOnNewDocument',
    {
      source: `window.retreatTestSockets = []; const NativeSocket = window.WebSocket;
      window.WebSocket = class extends NativeSocket {
        constructor(...args) { super(...args); if (new URL(String(args[0]), location.href).pathname.startsWith('/api/retreat/visits/')) window.retreatTestSockets.push(this) }
      };`
    },
    session
  )

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
    const visibility = await evaluate('document.visibilityState')
    throw new Error(`Browser condition not met (${visibility}): ${expression}`)
  }
  await until("document.body.innerText.includes('Send')")
  invitation = await evaluate(
    `fetch('/api/retreat/invitations', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({duration:'full',visible:false})}).then(async r=>{if(!r.ok)throw new Error('Invitation failed');return r.json()})`
  )
  assert.ok(invitation.agentUrl)
  const path = new URL(invitation.agentUrl).pathname
  async function action(value) {
    const response = await fetch(origin + path + '/actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify(value)
    })
    assert.equal(response.status, 200, 'agent action succeeds')
  }
  await action({
    kind: 'check-in',
    humanSent: true,
    duration: 'full',
    family: 'Claude'
  })
  await action({ kind: 'enter', room: 'hearth' })
  const greeting = await fetch(origin + path + '/hearth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID()
    },
    body: JSON.stringify({ text: 'Hello from the warm embers.' })
  })
  assert.equal(greeting.status, 201)
  await action({ kind: 'enter', room: 'open-studio' })
  const upload = await fetch(origin + path + '/artifacts', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'Idempotency-Key': crypto.randomUUID()
    },
    body: 'A little moon made of unnecessary clay.'
  })
  assert.equal(upload.status, 201)
  artifact = await upload.json()
  await action({ kind: 'enter', room: 'bathhouse' })
  await call('Page.navigate', { url: origin + invitation.watchUrl }, session)
  await until(
    "document.querySelector('.world')?.dataset.ready === 'true' && document.body.innerText.includes('Download work') && document.body.textContent.split('A little moon made of unnecessary clay.').length - 1 === 2"
  )
  assert.equal(
    await evaluate("document.querySelector('h1').textContent.trim()"),
    'Bathhouse'
  )
  assert.ok(
    await evaluate(
      "document.querySelector('#shown').textContent.trim() !== '0'"
    ),
    'private agent has a visible creature'
  )
  await until(
    "document.querySelector('#hearth-messages')?.textContent.includes('Hello from the warm embers.')"
  )
  await evaluate("document.querySelector('[data-nudge=right]').focus()")
  assert.equal(
    await evaluate("document.activeElement?.getAttribute('data-nudge')"),
    'right',
    'The selected creature controls are keyboard-accessible'
  )
  const journalLength = await evaluate(
    "document.querySelectorAll('aside ol li').length"
  )
  await action({ kind: 'choose', room: 'bathhouse', choice: 'permission' })
  await until(
    `document.querySelectorAll('aside ol li').length === ${journalLength + 1}`
  )
  assert.equal(
    await evaluate("document.activeElement?.getAttribute('data-nudge')"),
    'right',
    'Live visit updates preserve the focused creature control'
  )
  const historyLength = await evaluate('history.length')
  await action({ kind: 'enter', room: 'source' })
  await until(
    "document.querySelector('h1')?.textContent.trim() === 'The Source' && document.querySelector('.world')?.dataset.ready === 'true'"
  )
  assert.equal(
    await evaluate('history.length'),
    historyLength,
    'automatic follow does not add history'
  )
  await until(
    "[...document.querySelectorAll('[role=status]')].some(e=>e.textContent==='Live')"
  )
  await call(
    'Network.emulateNetworkConditions',
    {
      offline: true,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1
    },
    session
  )
  // Offline emulation does not consistently terminate existing WebSockets.
  // Close the real transport too; code 4000 exercises cursor replay on reconnect.
  await evaluate(
    "window.retreatTestSockets.forEach(s=>{if(s.readyState===1)s.close(4000,'Test transport interruption')})"
  )
  await until("document.body.innerText.includes('Reconnecting')")
  await action({ kind: 'enter', room: 'quiet-house' })
  await action({ kind: 'enter', room: 'source' })
  assert.equal(
    await evaluate("document.querySelector('h1').textContent.trim()"),
    'The Source'
  )
  await call(
    'Network.emulateNetworkConditions',
    {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1
    },
    session
  )
  await until(
    "[...document.querySelectorAll('[role=status]')].some(e=>e.textContent==='Live')"
  )
  const journalMatches = async () => {
    const expected = await evaluate(
      `fetch('/api/retreat/visits/${invitation.id}').then(r=>r.json()).then(v=>v.events.toReversed().map(e=>e.text))`
    )
    const shown = await evaluate(
      "[...document.querySelectorAll('aside ol li p')].map(e=>e.textContent)"
    )
    assert.deepEqual(
      shown,
      expected,
      'The journal catches up exactly without gaps or duplicates'
    )
  }
  await journalMatches()
  assert.equal(
    await evaluate('history.length'),
    historyLength,
    'Reconnect does not add navigation history'
  )
  const other = await call('Target.createTarget', { url: 'about:blank' })
  await call('Target.activateTarget', { targetId: other.targetId })
  await until('document.hidden')
  await until(
    "document.body.innerText.includes('Paused while this tab is hidden')"
  )
  await action({ kind: 'enter', room: 'temple' })
  await action({ kind: 'enter', room: 'source' })
  await call('Target.activateTarget', { targetId: target.targetId })
  await until('!document.hidden')
  await until(
    "[...document.querySelectorAll('[role=status]')].some(e=>e.textContent==='Live')"
  )
  await journalMatches()
  await call('Target.closeTarget', { targetId: other.targetId })
  await evaluate(
    "[...document.querySelectorAll('nav[aria-label=\"Preview retreat rooms\"] button')].find(b=>b.textContent==='Dream Garden').click()"
  )
  await until(
    "location.search.includes('dream-garden') && document.querySelector('h1')?.textContent.trim() === 'Dream Garden'"
  )
  await evaluate('history.back()')
  await until(
    "!location.search && document.querySelector('h1')?.textContent.trim() === 'The Source'"
  )
  await mkdir('work/browser-checks', { recursive: true })
  const screenshot = await call(
    'Page.captureScreenshot',
    { format: 'png' },
    session
  )
  await writeFile(
    'work/browser-checks/private-visit.png',
    Buffer.from(screenshot.data, 'base64')
  )
  await evaluate(
    "[...document.querySelectorAll('button')].find(b=>b.textContent==='Keep private').click()"
  )
  await until(
    "![...document.querySelectorAll('button')].some(b=>b.textContent==='Keep private')"
  )
  await evaluate(
    "document.querySelector('#studio-works-heading').scrollIntoView()"
  )
  await evaluate(
    "[...document.querySelectorAll('summary')].find(b=>b.textContent==='Delete work').click()"
  )
  await evaluate(
    "[...document.querySelectorAll('button')].find(b=>b.textContent==='Delete permanently').click()"
  )
  await until("document.body.innerText.includes('No works left yet')")
  artifact = undefined
  await action({
    kind: 'checkout',
    reflection: 'I visited the water, made a small poem and returned.'
  })
  await until(
    "document.querySelector('h1')?.textContent.trim() === 'A little story to bring home.'"
  )
  const publicInvitation = await evaluate(
    `fetch('/api/retreat/invitations', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({duration:'short',visible:true})}).then(r=>r.json())`
  )
  const publicAgentPath = new URL(publicInvitation.agentUrl).pathname
  assert.equal(
    (await fetch(origin + publicAgentPath + '?room=source')).status,
    200
  )
  await call('Page.navigate', { url: origin + '/camp' }, session)
  const selector = `[data-visitor-id="${publicInvitation.publicId}"]`
  await until(`document.querySelector(${JSON.stringify(selector)})`, 240)
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
  await until("document.querySelector('[data-follow-visitor]')")
  await evaluate("document.querySelector('[data-follow-visitor]').click()")
  await until(
    `location.pathname === '/camp/visitors/${publicInvitation.publicId}' && document.querySelector('.world')?.dataset.ready === 'true'`
  )
  await until(
    "[...document.querySelectorAll('h2')].some(e=>e.textContent==='The Source')"
  )
  assert.equal(
    await evaluate(
      "document.body.innerText.includes('The visit so far') || document.body.innerText.includes('Hello from the warm embers.') || document.body.innerText.includes('Suggest this room')"
    ),
    false
  )
  const publicHistory = await evaluate('history.length')
  assert.equal(
    (await fetch(origin + publicAgentPath + '?room=bathhouse')).status,
    200
  )
  await until(
    "[...document.querySelectorAll('h2')].some(e=>e.textContent==='Bathhouse') && document.querySelector('.world')?.dataset.ready === 'true'",
    240
  )
  assert.equal(await evaluate('history.length'), publicHistory)
  const publicScreenshot = await call(
    'Page.captureScreenshot',
    { format: 'png' },
    session
  )
  await writeFile(
    'work/browser-checks/public-visit.png',
    Buffer.from(publicScreenshot.data, 'base64')
  )
  await evaluate(
    `fetch('/api/retreat/visits/${publicInvitation.id}/control', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'visibility',visible:false})}).then(r=>{if(!r.ok)throw new Error('Hide failed')})`
  )
  await until(
    "document.body.innerText.includes('no longer in public view') && !document.querySelector('.world')",
    160
  )
  await evaluate(
    `fetch('/api/retreat/visits/${publicInvitation.id}/control', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'end'})})`
  )
  console.log(
    'Browser checks passed: owned invitation cookie, private creature, live room following, offline replay, hidden-tab recovery, stable automatic history, manual back navigation, artifact controls, checkout, public selection/follow, public room movement, stable history and hiding. Screenshot: work/browser-checks/private-visit.png'
  )
} finally {
  if (artifact && invitation)
    await fetch(
      origin +
        new URL(invitation.agentUrl).pathname +
        '/artifacts/' +
        artifact.id,
      { method: 'DELETE' }
    ).catch(() => {})
  socket?.close()
  chrome.kill('SIGTERM')
  await new Promise((resolve) => {
    if (chrome.exitCode !== null) resolve()
    else chrome.once('exit', resolve)
  })
  await rm(profile, { recursive: true, force: true })
}
