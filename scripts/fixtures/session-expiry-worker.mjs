// Local test controls only; never deployed with the application.
import worker from '../../worker/src/index.ts'
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
    this.testStorage = ctx.storage
  }
  async expire() {
    await this.testStorage.deleteAlarm()
    this.testStorage.sql.exec(
      "UPDATE session SET state = json_set(state, '$.expiresAt', ?)",
      Date.now() - 1
    )
  }
  async cleanup() {
    await super.alarm()
    return {
      tables: this.testStorage.sql
        .exec(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
        )
        .toArray()
        .map((row) => row.name)
    }
  }
}
export default {
  async fetch(request, env, ctx) {
    const match = new URL(request.url).pathname.match(
      /^\/__test\/(expire|cleanup)\/(.+)$/
    )
    if (match)
      return Response.json(
        (await env.SESSIONS.getByName(match[2])[match[1]]()) ?? null
      )
    return worker.fetch(request, env, ctx)
  }
}
