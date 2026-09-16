import { selectVariant } from '../../worker/src/inference'

// Test-only ingress. Never imported by the deployed Worker.
export default {
  async fetch(request) {
    const {
      enabled = true,
      budget = true,
      text = 'A quiet welcome'
    } = await request.json()
    let reservations = 0
    const outcomes = []
    const decision = await selectVariant(
      {
        TYPESAFE_ENABLED: String(enabled),
        TYPESAFE_API_KEY: 'test-only',
        TYPESAFE_MODEL: 'jev-latest',
        BUDGET: {
          getByName: () => ({
            reserve: async () => {
              reservations++
              return budget
            },
            outcome: async (ok) => {
              outcomes.push(ok)
            }
          })
        }
      },
      'source',
      text
    )
    return Response.json({ decision, reservations, outcomes })
  }
}
