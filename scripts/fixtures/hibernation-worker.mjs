// Isolated hosted lifecycle test only. Never imported by the application Worker.
import app from '../../worker/src/index.ts'
import { RetreatSession as Session } from '../../worker/src/session.ts'
export {
  RetreatPresence,
  RetreatStudio,
  RetreatLounge,
  InferenceBudget
} from '../../worker/src/index.ts'
export class RetreatSession extends Session {
  constructor(ctx, env) {
    super(ctx, env)
    this.boot = crypto.randomUUID()
    this.testContext = ctx
  }
  async fetch(request) {
    if (new URL(request.url).pathname.endsWith('/instance')) {
      // Production owner authentication runs before any diagnostics are exposed.
      const authorized = await super.fetch(request)
      if (!authorized.ok) return authorized
      await authorized.body?.cancel()
      return Response.json({
        boot: this.boot,
        sockets: this.testContext.getWebSockets().length
      })
    }
    return super.fetch(request)
  }
}
export default {
  fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname
    const instance = /^\/api\/retreat\/visits\/([0-9a-f-]{36})\/instance$/.exec(
      pathname
    )
    if (instance) return env.SESSIONS.getByName(instance[1]).fetch(request)
    if (
      pathname !== '/api/retreat/invitations' &&
      !pathname.startsWith('/api/retreat/visits/') &&
      !pathname.startsWith('/agent/start/')
    ) {
      return new Response('Lifecycle fixture only', { status: 404 })
    }
    return app.fetch(request, env, ctx)
  }
}
