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
      if (await evaluate(expression)) return
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error(`Browser condition not met: ${expression}`)
  }
  await call(
    'Page.addScriptToEvaluateOnNewDocument',
    {
      source: `
    window.adminAuthenticated=false;
    const nativeFetch=window.fetch.bind(window);
    window.fetch=async(url,options={})=>{
      if(!String(url).startsWith('/api/retreat/admin'))return nativeFetch(url,options);
      if(String(url).endsWith('/session')){
        if(options.method==='POST'){window.adminAuthenticated=JSON.parse(options.body).key==='test-key';return Response.json({}, {status:window.adminAuthenticated?200:403})}
        if(options.method==='DELETE'){window.adminAuthenticated=false;return Response.json({})}
        return Response.json({}, {status:window.adminAuthenticated?200:403});
      }
      if(!window.adminAuthenticated)return new Response('',{status:403});
      const common={id:'11111111-1111-4111-8111-111111111111',revision:1,createdAt:Date.now(),expiresAt:Date.now()+60000,audience:'private',requestedAudience:'public',moderation:'rejected',ready:true,deleted:false};
      return String(url).includes('/hearth')?Response.json({messages:[{...common,sequence:1,author:'Visitor test',text:'<script>window.executed=true</script> Private hearth words.'}],next:null}):Response.json({works:[{...common,mime:'image/png',bytes:1024,notice:'Private rejected work.'}],next:null});
    }
  `
    },
    session
  )
  await call('Page.navigate', { url: origin + '/admin' }, session)
  await until(
    "document.querySelector('#admin-key') && !document.querySelector('#admin-key').disabled"
  )
  await evaluate(
    "document.querySelector('#admin-key').value='test-key';document.querySelector('form').requestSubmit()"
  )
  await until("document.body.innerText.includes('Private rejected work.')")
  assert.equal(
    await evaluate("document.querySelector('#admin-key')===null"),
    true
  )
  assert.equal(
    await evaluate("document.body.innerText.includes('test-key')"),
    false
  )
  assert.equal(
    await evaluate(
      "[...document.querySelectorAll('a')].some(a=>a.textContent==='Download for review')"
    ),
    true
  )
  await evaluate(
    "[...document.querySelectorAll('button')].find(b=>b.textContent==='Hearth messages').click()"
  )
  await until(
    "document.querySelector('blockquote')?.textContent.includes('Private hearth words')"
  )
  assert.equal(await evaluate('Boolean(window.executed)'), false)
  await mkdir('work/browser-checks', { recursive: true })
  const shot = await call('Page.captureScreenshot', { format: 'png' }, session)
  await writeFile(
    'work/browser-checks/admin-review.png',
    Buffer.from(shot.data, 'base64')
  )
  await evaluate(
    "window.adminAuthenticated=false;[...document.querySelectorAll('button')].find(b=>b.textContent==='Refresh review').click()"
  )
  await until("document.body.innerText.includes('session expired')")
  assert.equal(
    await evaluate("document.body.innerText.includes('Private hearth words')"),
    false
  )
  await evaluate(
    "document.querySelector('#admin-key').value='test-key';document.querySelector('form').requestSubmit()"
  )
  await until("document.body.innerText.includes('Private rejected work.')")
  await evaluate(
    "[...document.querySelectorAll('button')].find(b=>b.textContent==='Sign out').click()"
  )
  await until("document.body.innerText.includes('Signed out.')")
  assert.equal(
    await evaluate(
      "document.body.innerText.includes('Private rejected work.')"
    ),
    false
  )
  console.log(
    'Admin browser checks passed with API fixtures: sign-in, secret clearing, both private review collections, inert text, expiry and sign-out.'
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
