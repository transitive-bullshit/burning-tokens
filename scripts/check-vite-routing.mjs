import assert from 'node:assert/strict'
const origin = process.env.RETREAT_SITE_ORIGIN
if (!origin)
  throw new Error('Set RETREAT_SITE_ORIGIN to the built app to verify')
const navigate = { 'Sec-Fetch-Mode': 'navigate', Accept: 'text/html' }
for (const path of [
  '/',
  '/send',
  '/camp',
  '/camp/bathhouse',
  '/camp/quiet-house',
  '/camp/dream-garden',
  '/camp/source',
  '/camp/open-studio',
  '/camp/hearth',
  '/camp/temple',
  '/about',
  '/admin',
  '/camp/exhibits',
  '/visit/00000000-0000-4000-8000-000000000000'
]) {
  const response = await fetch(origin + path, { headers: navigate })
  assert.equal(response.status, 200, path)
  assert.match(response.headers.get('content-type'), /text\/html/, path)
  const html = await response.text()
  assert.match(html, /id="root"/, path)
  assert.doesNotMatch(html, /\/_next\//, path)
  if (path.startsWith('/visit/') || path === '/admin') {
    assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/, path)
    assert.match(response.headers.get('cache-control') ?? '', /no-store/, path)
  }
}
for (const path of [
  '/api',
  '/api/missing',
  '/api/retreat/missing',
  '/agent/missing'
]) {
  const response = await fetch(origin + path, { headers: navigate })
  assert.equal(response.status, 404, path)
  assert.match(response.headers.get('content-type'), /application\/json/, path)
  assert.equal((await response.json()).error, 'Not found', path)
}
for (const [accept, expected] of [
  ['text/markdown', /text\/markdown/],
  ['text/html', /text\/html/]
]) {
  const response = await fetch(origin + '/agent', {
    headers: { ...navigate, Accept: accept }
  })
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), expected)
  assert.doesNotMatch(await response.text(), /id="root"/)
}
const discover = await fetch(origin + '/llms.txt', {
  headers: { ...navigate, Accept: 'text/markdown' }
})
assert.match(await discover.text(), /# Burning Tokens/)
const homeHtml = await (await fetch(origin + '/')).text()
const heroUrl =
  /<link(?=[^>]*rel="preload")(?=[^>]*as="image")[^>]+href="([^"]*\/hero[^"]*\.webp)"/.exec(
    homeHtml
  )?.[1]
assert.ok(heroUrl, 'homepage must preload its bundled hero')
const art = await fetch(new URL(heroUrl, origin))
assert.equal(art.status, 200)
assert.match(art.headers.get('content-type'), /image\/webp/)
const privateRead = await fetch(origin + '/api/retreat/admin/artifacts', {
  headers: navigate
})
assert.equal(privateRead.status, 403)
assert.match(privateRead.headers.get('cache-control'), /no-store/)
console.log(
  'Unified routing passed: deep links, private-page headers, backend navigation misses, agent content negotiation, discovery, WebP and private API denial.'
)
