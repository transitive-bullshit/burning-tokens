import assert from 'node:assert/strict'
import {
  escapeHtml,
  getPageMetadata,
  publicPagePaths,
  renderMetadata,
  socialImage,
  tagline
} from '../lib/site-metadata.ts'
import { crawlMetadata } from '../worker/src/crawl-metadata.ts'

const server = process.env.RETREAT_SITE_ORIGIN ?? 'http://127.0.0.1:3010'
const origin = process.env.RETREAT_CANONICAL_ORIGIN ?? server
const paths = publicPagePaths
const indexable = process.env.RETREAT_SITE_INDEXABLE === 'true'

// Exercise both configurations even when the running server is local.
for (const enabled of [false, true]) {
  const env = { PUBLIC_ORIGIN: origin, SITE_INDEXABLE: String(enabled) }
  for (const path of paths)
    assert.equal(getPageMetadata(path, origin, enabled).indexable, enabled)
  const xml = await crawlMetadata(
    new Request(`${origin}/sitemap.xml`),
    env
  ).text()
  assert.equal((xml.match(/<loc>/g) ?? []).length, enabled ? paths.length : 0)
  for (const path of enabled ? paths : [])
    assert.ok(xml.includes(`<loc>${origin}${path}</loc>`))
  assert.ok(!xml.includes('/visit/'))
  const head = crawlMetadata(
    new Request(`${origin}/robots.txt`, { method: 'HEAD' }),
    env
  )
  assert.equal(await head.text(), '')
  assert.equal(
    crawlMetadata(new Request(`${origin}/robots.txt`, { method: 'POST' }), env)
      .status,
    405
  )
}

const robots = await fetch(server + '/robots.txt')
assert.equal(robots.status, 200)
assert.ok(robots.headers.get('content-type')?.startsWith('text/plain'))
const rules = await robots.text()
assert.ok(rules.includes('User-agent: *\nAllow: /'))
assert.equal(rules.includes(`Sitemap: ${origin}/sitemap.xml`), indexable)
const sitemap = await fetch(server + '/sitemap.xml')
assert.equal(sitemap.status, 200)
assert.ok(sitemap.headers.get('content-type')?.startsWith('application/xml'))
const xml = await sitemap.text()
assert.ok(xml.startsWith('<?xml'))
assert.equal((xml.match(/<loc>/g) ?? []).length, indexable ? paths.length : 0)
for (const path of indexable ? paths : [])
  assert.ok(xml.includes(`<loc>${origin}${path}</loc>`))

// Static page reads only: this check never creates sessions or exercises crowd capacity.
for (const path of paths) {
  const response = await fetch(server + path)
  assert.equal(response.status, 200, path)
  const html = await response.text()
  assert.ok(
    html.includes(
      `name="robots" content="${indexable ? 'index, follow' : 'noindex, nofollow'}"`
    )
  )
  assert.equal(
    response.headers.get('x-robots-tag'),
    indexable ? null : 'noindex, nofollow'
  )
  assert.ok(html.includes('name="twitter:creator" content="@transitive_bs"'))
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
  if (!path.startsWith('/agent/')) {
    const response = await fetch(server + path)
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow')
    assert.ok(
      (await response.text()).includes(
        'name="robots" content="noindex, nofollow"'
      )
    )
  }
}
assert.equal(
  getPageMetadata('/camp/bathhouse/', origin, true).canonical,
  `${origin}/camp/bathhouse`
)
assert.equal(getPageMetadata('/camp', origin, true).indexable, true)
assert.equal(getPageMetadata('/camp/unknown', origin).notFound, true)
const missing = await fetch(server + '/camp/unknown')
assert.equal(missing.status, 404)
assert.ok((await missing.text()).includes('noindex, nofollow'))

const image = await fetch(server + socialImage.path)
assert.equal(image.status, 200)
assert.ok(image.headers.get('content-type')?.startsWith('image/jpeg'))
const bytes = new Uint8Array(await image.arrayBuffer())
assert.equal(bytes[0], 0xff)
assert.equal(bytes[1], 0xd8)
assert.ok(bytes.length < 300 * 1024)

const markdown = await fetch(server + '/agent')
assert.ok(markdown.headers.get('content-type')?.startsWith('text/markdown'))
assert.ok(!(await markdown.text()).includes('application/ld+json'))
const agentHtml = await fetch(server + '/agent', {
  headers: { Accept: 'text/html' }
})
assert.ok(agentHtml.headers.get('content-type')?.startsWith('text/html'))
assert.ok((await agentHtml.text()).includes('application/ld+json'))
console.log(
  `Social metadata passes for ${paths.length} public HTML pages; private metadata, JPEG, and agent content formats pass`
)
