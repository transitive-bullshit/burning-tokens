// Isolated Miniflare fixture only. Never included by worker/wrangler.jsonc.
import { RetreatStudio } from '../../worker/src/studio.ts'
export class FaultStudio extends RetreatStudio {
  constructor(ctx, env) {
    super(ctx, {
      ...env,
      MEDIA: {
        put: async (...args) => {
          const mode = ctx.storage.kv.get('fault-mode')
          const count = ctx.storage.kv.get('put-count') ?? 0
          ctx.storage.kv.put('put-count', count + 1)
          if (mode === 'always' || (mode === 'once' && count === 0))
            throw new Error('Injected R2 interruption')
          if (mode === 'delay' && count === 0)
            await new Promise((resolve) => setTimeout(resolve, 500))
          return env.MEDIA.put(...args)
        },
        get: (...args) => env.MEDIA.get(...args),
        delete: (...args) => env.MEDIA.delete(...args)
      }
    })
    this.testStorage = ctx.storage
  }
  configure(mode) {
    this.testStorage.kv.put('fault-mode', mode)
    this.testStorage.kv.put('put-count', 0)
  }
  inspect() {
    return {
      puts: this.testStorage.kv.get('put-count') ?? 0,
      rows: this.testStorage.sql
        .exec('SELECT value FROM works')
        .toArray()
        .map((row) => JSON.parse(row.value))
    }
  }
  legacyLease() {
    this.testStorage.sql.exec(
      "UPDATE works SET value = json_remove(value, '$.uploadAttempt')"
    )
  }
  expireLease() {
    this.testStorage.sql.exec(
      "UPDATE works SET value = json_set(value, '$.uploadAttempt.expiresAt', 0)"
    )
  }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const object = env.STUDIO.getByName(
      request.headers.get('X-Test-Object') ?? 'test'
    )
    if (url.pathname === '/configure') {
      await object.configure(await request.text())
      return new Response('ok')
    }
    if (url.pathname === '/inspect')
      return Response.json(await object.inspect())
    if (url.pathname === '/blob-present')
      return Response.json({
        exists: (await env.MEDIA.head(url.searchParams.get('key'))) !== null
      })
    if (url.pathname === '/legacy-lease') {
      await object.legacyLease()
      return new Response('ok')
    }
    if (url.pathname === '/expire-lease') {
      await object.expireLease()
      return new Response('ok')
    }
    return object.fetch(request)
  }
}
