// Test-only configuration injection into the production budget object.
import { InferenceBudget } from '../../worker/src/inference.ts'
export class BudgetFixture extends InferenceBudget {
  constructor(ctx, env) {
    const config = { ...env }
    super(ctx, config)
    this.testConfig = config
    this.testStorage = ctx.storage
  }
  check({ calls, bytes, input = 10, failures = 0 }) {
    this.testConfig.TYPESAFE_DAILY_CALL_LIMIT = calls
    this.testConfig.TYPESAFE_DAILY_INPUT_LIMIT = bytes
    for (let index = 0; index < failures; index++) this.outcome(false)
    const accepted = this.reserve(input)
    return { accepted, state: this.testStorage.kv.get('budget') ?? null }
  }
}
export default {
  async fetch(request, env) {
    const input = await request.json()
    return Response.json(await env.BUDGET.getByName(input.id).check(input))
  }
}
