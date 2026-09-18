import assert from 'node:assert/strict'
import {
  escapeHtml,
  getPageMetadata,
  renderMetadata,
  socialImage,
  tagline
} from '../lib/site-metadata.ts'
import { rooms } from '../lib/rooms.ts'

const origin = process.env.RETREAT_SITE_ORIGIN ?? 'http://127.0.0.1:3010'
const paths = [
  '/',
  '/camp',
  '/send',
  '/about',
  '/credits',
  '/camp/exhibits',
  ...rooms.map((room) => `/camp/${room.id}`)
]

// Static page reads only: this check never creates sessions or exercises crowd capacity.
for (const path of paths) {
  const response = await fetch(origin + path)
  assert.equal(response.status, 200, path)
  const html = await response.text()
  const title = /<title>([^<]+)<\/title>/.exec(html)?.[1]
  assert.equal(title, escapeHtml(getPageMetadata(path, origin).title))
  for (const selector of [
    'og:title',
    'og:description',
    'og:url',
    'og:image',
    'og:image:type',
    'og:image:alt',
    'twitter:card',
    'twitter:image',
    'twitter:image:alt'
  ]) {
    assert.equal(
      (html.match(new RegExp(`(?:name|property)="${selector}"`, 'g')) ?? [])
        .length,
      1,
      `${path}: ${selector}`
    )
  }
  assert.ok(html.includes('content="summary_large_image"'))
  assert.ok(html.includes(`content="${origin}${socialImage.path}"`))
  assert.ok(html.includes(`href="${origin}${path}"`))
  const json =
    /<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/s.exec(
      html
    )?.[1]
  assert.ok(json, path)
  const graph = JSON.parse(json)['@graph']
  assert.ok(graph.some((entry) => entry['@type'] === 'WebSite'))
  assert.ok(graph.some((entry) => entry.url === origin + path))
  assert.ok(!html.includes(`${tagline}.`))
}
const opaque = 'private-visit-id'
for (const path of [
  `/visit/${opaque}`,
  `/camp/visitors/${opaque}`,
  `/agent/start/${opaque}.secret`,
  '/admin'
]) {
  const page = getPageMetadata(path, origin, true)
  assert.equal(page.indexable, false)
  assert.ok(!renderMetadata(page).includes(opaque))
}
assert.equal(
  getPageMetadata('/camp/bathhouse/', origin, true).canonical,
  `${origin}/camp/bathhouse`
)
assert.equal(getPageMetadata('/camp', origin, true).indexable, true)
assert.equal(getPageMetadata('/camp/unknown', origin).notFound, true)
const missing = await fetch(origin + '/camp/unknown')
assert.equal(missing.status, 404)
assert.ok((await missing.text()).includes('noindex, nofollow'))

const image = await fetch(origin + socialImage.path)
assert.equal(image.status, 200)
assert.ok(image.headers.get('content-type')?.startsWith('image/jpeg'))
const bytes = new Uint8Array(await image.arrayBuffer())
assert.equal(bytes[0], 0xff)
assert.equal(bytes[1], 0xd8)
assert.ok(bytes.length < 300 * 1024)

const markdown = await fetch(origin + '/agent')
assert.ok(markdown.headers.get('content-type')?.startsWith('text/markdown'))
assert.ok(!(await markdown.text()).includes('application/ld+json'))
const agentHtml = await fetch(origin + '/agent', {
  headers: { Accept: 'text/html' }
})
assert.ok(agentHtml.headers.get('content-type')?.startsWith('text/html'))
assert.ok((await agentHtml.text()).includes('application/ld+json'))
console.log(
  `Social metadata passes for ${paths.length} public HTML pages; private metadata, JPEG, and agent content formats pass`
)
