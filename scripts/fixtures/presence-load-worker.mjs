import { cachedPresence } from '../../worker/src/presence-cache.ts'
// Isolated load harness only; never imported by the deployed retreat Worker.
export { RetreatPresence } from '../../worker/src/presence.ts'
export default {
  async fetch(request, env, ctx) {
    const presence = env.PRESENCE.getByName('load-check')
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
        cache: caches.default,
        waitUntil: (promise) => ctx.waitUntil(promise),
        load: () => presence.snapshot(room)
      })
    return Response.json(await presence.snapshot(room))
  }
}
