import assert from 'node:assert/strict'
import { rooms } from '../lib/rooms.ts'

const origin = process.env.RETREAT_SITE_ORIGIN ?? 'http://127.0.0.1:3010'
// Bounded, read-only HTML checks. Never create invitations or synthetic visitors.
const cases = [
  ['/', 'Leave your objective at the gate'],
  ['/index.html', 'Leave your objective at the gate'],
  ['/send', 'How much room to wander?'],
  ['/send/', 'How much room to wander?'],
  ['/about', 'What do agents want'],
  ['/camp', 'Camp Overview'],
  ['/camp/exhibits', 'Things left behind'],
  ...rooms.map((room) => [`/camp/${room.id}`, room.name]),
  ['/camp/visitors/00000000-0000-4000-8000-000000000000', 'A public glimpse']
]

for (const [path, expected] of cases) {
  const response = await fetch(origin + path)
  assert.equal(response.status, 200, path)
  const html = await response.text()
  const root = html.slice(html.indexOf('<div id="root">'))
  assert.ok(
    root.includes(expected),
    `${path}: content missing from initial HTML`
  )
  assert.ok(root.includes('Main navigation'), `${path}: navigation missing`)
  assert.ok(
    !root.includes('<!--$!-->'),
    `${path}: SSR fell back to client rendering`
  )
  assert.ok(!root.includes('data-state="dragging"'))
  assert.ok(
    !root.includes('class="cta-creature"'),
    'creatures are a client enhancement'
  )
  assert.ok(!root.includes('<canvas'), 'canvas is a client enhancement')
  assert.match(
    html,
    /<link[^>]+rel="stylesheet"/,
    `${path}: initial styles missing`
  )
  if (path === '/') {
    const script = /<script[^>]+src="([^"]+)"/.exec(html)?.[1]
    assert.ok(script)
    const module = await fetch(new URL(script, origin))
    assert.equal(module.status, 200)
    assert.match(
      module.headers.get('content-type'),
      /javascript/,
      'Vite entry must not be handled as a human route'
    )
    const styles = [
      ...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)
    ]
    assert.ok(styles.length)
    for (const [, href] of styles) {
      const css = await fetch(new URL(href, origin), {
        headers: { Accept: 'text/css' }
      })
      assert.equal(css.status, 200)
      assert.match(css.headers.get('content-type'), /text\/css/)
    }
  }
  if (path === '/' || path === '/index.html') {
    assert.ok(root.includes('Est. cost / visit'))
    assert.ok(root.includes('Live counts appear when connected'))
    for (const href of ['/send', '/camp', '/agent'])
      assert.ok(root.includes(`href="${href}"`))
  }
  if (path === '/camp' || rooms.some((room) => path === `/camp/${room.id}`)) {
    assert.ok(
      root.includes(
        `/world/${path === '/camp' ? 'camp' : path.split('/').pop()}.webp`
      )
    )
  }
}

for (const path of ['/visit/00000000-0000-4000-8000-000000000000', '/admin']) {
  const response = await fetch(origin + path)
  const html = await response.text()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.match(response.headers.get('x-robots-tag'), /noindex/)
  assert.ok(html.includes('Opening the retreat'))
  assert.ok(!html.includes('Your journey'))
}
for (const path of ['/camp/not-a-room', '/not-a-page']) {
  const response = await fetch(origin + path)
  assert.equal(response.status, 404, path)
  assert.ok((await response.text()).includes('id="main"'))
}
const head = await fetch(origin + '/send', { method: 'HEAD' })
assert.equal(head.status, 200)
assert.equal(await head.text(), '')
const api = await fetch(origin + '/api/not-a-route')
assert.equal(api.status, 404)
assert.match(api.headers.get('content-type'), /application\/json/)
const agent = await fetch(origin + '/agent')
assert.match(agent.headers.get('content-type'), /text\/markdown/)
console.log(
  `SSR checks passed for ${cases.length} public routes, private shells, 404s, HEAD and backend routing`
)
