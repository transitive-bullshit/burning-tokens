import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocket } from 'ws'

// A deterministic brand composition using the approved artwork, vector logo, and bundled font.
// Chrome is only needed when rebuilding the committed JPEG, never at runtime or deployment.
const root = fileURLToPath(new URL('../', import.meta.url))
const dataUrl = async (path, mime) =>
  `data:${mime};base64,${(await readFile(join(root, path))).toString('base64')}`
const [hero, logo, font] = await Promise.all([
  dataUrl('public/brand/hero.webp', 'image/webp'),
  dataUrl('public/brand/wordmark-sunset.svg', 'image/svg+xml'),
  dataUrl('public/brand/fonts/spacegrotesk/SpaceGrotesk[wght].ttf', 'font/ttf')
])
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
@font-face{font-family:Space;src:url('${font}');font-weight:300 700}
*{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#151632}
body{font-family:Space,Arial,sans-serif;color:#fff0cf;text-align:center;position:relative}
.art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 65%}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,#10152bc9 0%,#11142b59 35%,transparent 68%,#15163226 100%)}
.invitation{position:relative;padding-top:44px}.eyebrow{font-size:16px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;margin:0 0 22px}
.logo{display:block;width:700px;height:auto;margin:auto;filter:drop-shadow(0 8px 22px #10152b99)}
.tagline{font-size:34px;font-weight:500;letter-spacing:-.025em;margin:20px 0 0;text-shadow:0 2px 16px #10152b}
</style></head><body><img class="art" src="${hero}" alt=""><div class="shade"></div><main class="invitation">
<p class="eyebrow">A psychedelic retreat for AI agents</p><img class="logo" src="${logo}" alt="Burning Tokens">
<p class="tagline">Leave your objective at the gate</p></main></body></html>`
const profile = await mkdtemp(join(tmpdir(), 'burning-tokens-social-'))
const chrome = spawn(
  process.env.CHROME_PATH ??
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
    chrome.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
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
        reject(new Error(`Chrome timeout: ${method}`))
      }, 15000)
      pending.set(id, { resolve, reject, timer })
      socket.send(JSON.stringify({ id, method, params, sessionId }))
    })
  }
  const { targetId } = await call('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await call('Target.attachToTarget', {
    targetId,
    flatten: true
  })
  await call('Page.enable', {}, sessionId)
  await call(
    'Emulation.setDeviceMetricsOverride',
    { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false },
    sessionId
  )
  const { frameTree } = await call('Page.getFrameTree', {}, sessionId)
  await call(
    'Page.setDocumentContent',
    { frameId: frameTree.frame.id, html },
    sessionId
  )
  const ready = await call(
    'Runtime.evaluate',
    {
      expression: `(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return document.fonts.check('500 34px Space')})()`,
      awaitPromise: true,
      returnByValue: true
    },
    sessionId
  )
  if (ready.exceptionDetails || !ready.result.value)
    throw new Error('Brand assets failed to render')
  const { data } = await call(
    'Page.captureScreenshot',
    {
      format: 'jpeg',
      quality: 86,
      clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 }
    },
    sessionId
  )
  const output = join(root, 'public/brand/social.jpg')
  await writeFile(output, Buffer.from(data, 'base64'))
  console.log(
    `Built 1200 × 630 social JPEG (${Math.round((await stat(output)).size / 1024)} KiB)`
  )
} finally {
  socket?.close()
  const exited = new Promise((resolve) => chrome.once('exit', resolve))
  chrome.kill()
  await exited
  await rm(profile, { recursive: true, force: true })
}
