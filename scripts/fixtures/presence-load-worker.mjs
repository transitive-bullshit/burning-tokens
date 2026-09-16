import { cachedPresence } from '../../worker/src/presence-cache.ts'
// Isolated load harness only; never imported by the deployed retreat Worker.
export { RetreatPresence } from '../../worker/src/presence.ts'
export default {
  async fetch(request, env, ctx) {
    if (
      env.LOCAL_LOAD_FIXTURE !== 'true' &&
      (!env.LOAD_TEST_KEY ||
        request.headers.get('X-Load-Test-Key') !== env.LOAD_TEST_KEY)
    ) {
      return new Response('Private load fixture', { status: 403 })
    }
    const run = request.headers.get('X-Load-Test-Run')
    if (!run || !/^[0-9a-f-]{36}$/.test(run))
      return new Response('Run id required', { status: 400 })
    const presence = env.PRESENCE.getByName(`load-check:${run}`)
    const cacheKey = (request) => {
      const url = new URL(request.url)
      url.searchParams.set('fixtureRun', run)
      return new Request(url, request)
    }
    if (request.method === 'PUT') {
      await presence.upsert(await request.json())
      return new Response(null, { status: 204 })
    }
    const url = new URL(request.url)
    const room = url.searchParams.get('room') ?? undefined
    if (url.searchParams.has('cached'))
      return cachedPresence({
        origin: url.origin,
        room,
        cache: {
          match: (key) => caches.default.match(cacheKey(key)),
          put: (key, response) => caches.default.put(cacheKey(key), response)
        },
        waitUntil: (promise) => ctx.waitUntil(promise),
        load: () => presence.snapshot(room)
      })
    return Response.json(await presence.snapshot(room))
  }
}
