// Test-only interposition after the real Session authorization commit.
// Never imported by the production entrypoint or Wrangler configuration.
export {
  default,
  RetreatStudio,
  RetreatLounge,
  RetreatPresence,
  InferenceBudget
} from '../../worker/src/index.ts'
import { RetreatSession as Session } from '../../worker/src/session.ts'
export class RetreatSession extends Session {
  async authorizePublication(...args) {
    const granted = await super.authorizePublication(...args)
    const response = await fetch(
      'https://publication-fixture.invalid/authorization'
    )
    if (!response.ok)
      throw new Error('Injected authorization transport failure')
    return granted
  }
}
