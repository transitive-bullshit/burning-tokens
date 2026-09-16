// Test-only inspection and fault injection; never part of the deployed Worker.
import worker from '../../worker/src/index.ts'
import { RetreatSession as Session } from '../../worker/src/session.ts'
import { RetreatPresence as Presence } from '../../worker/src/presence.ts'
export {
  RetreatStudio,
  RetreatLounge,
  InferenceBudget
} from '../../worker/src/index.ts'
export class RetreatSession extends Session {
  constructor(ctx, env) {
    super(ctx, env)
    this.testStorage = ctx.storage
  }
  inspect() {
    const rows = this.testStorage.sql.exec('SELECT * FROM outbox').toArray()
    return {
      rows: rows.map((row) => ({ ...row, value: JSON.parse(row.value) }))
    }
  }
  async deliver() {
    await this.testStorage.deleteAlarm()
    this.testStorage.sql.exec('UPDATE outbox SET due = 0')
    await super.alarm()
    // Tests invoke retries explicitly, so wall-clock alarms cannot race assertions.
    await this.testStorage.deleteAlarm()
    return this.inspect()
  }
}
export class RetreatPresence extends Presence {
  async upsert(value) {
    const response = await fetch('https://outbox-fixture.invalid/delivery', {
      method: 'POST',
      body: JSON.stringify(value)
    })
    if (!response.ok) throw new Error('Injected Presence outage')
    return super.upsert(value)
  }
}
export default {
  async fetch(request, env, ctx) {
    const match = new URL(request.url).pathname.match(
      /^\/__test\/(inspect|deliver)\/(.+)$/
    )
    if (match) {
      const session = env.SESSIONS.getByName(match[2])
      return Response.json(await session[match[1]]())
    }
    return worker.fetch(request, env, ctx)
  }
}
