// Isolated recovery tests only; never imported by the production entrypoint.
import { RetreatLounge } from '../../worker/src/lounge.ts'
export class FaultLounge extends RetreatLounge {
  constructor(ctx, env) {
    super(ctx, env)
    this.testStorage = ctx.storage
  }
  inspect() {
    return this.testStorage.sql
      .exec('SELECT value FROM messages')
      .toArray()
      .map((row) => JSON.parse(row.value))
  }
  interrupt(legacy = false) {
    for (const value of this.inspect()) {
      value.ready = false
      value.moderation = 'pending'
      value.publicationAuthorized = false
      value.audience = 'private'
      value.revision++
      if (legacy) delete value.moderationAttempt
      else if (value.moderationAttempt) value.moderationAttempt.expiresAt = 0
      this.testStorage.sql.exec(
        'UPDATE messages SET value = ? WHERE id = ?',
        JSON.stringify(value),
        value.id
      )
    }
  }
}
export default {
  async fetch(request, env) {
    const object = env.LOUNGE.getByName(request.headers.get('X-Test-Object'))
    const path = new URL(request.url).pathname
    if (path === '/inspect') return Response.json(await object.inspect())
    if (path === '/interrupt') {
      await object.interrupt(new URL(request.url).searchParams.has('legacy'))
      return new Response('ok')
    }
    return object.fetch(request)
  }
}
