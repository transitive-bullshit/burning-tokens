/** Fixed vocabulary only: never pass request URLs, identifiers, text or errors. */
export const metricEvents = [
  'http',
  'session_created',
  'session_event',
  'viewer_count',
  'presence_cache',
  'presence_update',
  'presence_eviction',
  'outbox',
  'inference',
  'inference_usage'
] as const
export const metricOutcomes = [
  'ok',
  'ignored',
  'error',
  'hit',
  'miss',
  'bypass',
  '1xx',
  '2xx',
  '3xx',
  '4xx',
  '5xx',
  'limited',
  'selected',
  'disabled',
  'visit-budget',
  'global-budget',
  'uncertain',
  'no-match',
  'invalid-choice',
  'unavailable',
  'timeout',
  'http',
  'invalid-response',
  'transport'
] as const
export const metricScopes = [
  'none',
  'agent',
  'invitation',
  'owner',
  'presence',
  'public',
  'admin',
  'other',
  'bathhouse',
  'source'
] as const
export type MetricsEnv = {
  METRICS_ENABLED?: string
  METRICS?: Pick<AnalyticsEngineDataset, 'writeDataPoint'>
}
type Measurement = {
  event: (typeof metricEvents)[number]
  outcome?: (typeof metricOutcomes)[number]
  scope?: (typeof metricScopes)[number]
  durationMs?: number
  amount?: number
  extra?: number
}
const finite = (value: number) =>
  Number.isFinite(value) ? Math.min(1e12, Math.max(0, value)) : 0
export function metric(
  env: MetricsEnv,
  {
    event,
    outcome = 'ok',
    scope = 'none',
    durationMs = 0,
    amount = 1,
    extra = 0
  }: Measurement
) {
  if (env.METRICS_ENABLED !== 'true' || !env.METRICS) return
  // Runtime validation also protects against callers crossing the JS/TS boundary.
  if (
    !metricEvents.includes(event) ||
    !metricOutcomes.includes(outcome) ||
    !metricScopes.includes(scope)
  )
    return
  try {
    env.METRICS.writeDataPoint({
      indexes: [event],
      blobs: ['v1', event, outcome, scope],
      doubles: [finite(durationMs), finite(amount), finite(extra)]
    })
  } catch {
    // Optional telemetry must never change an action's result or retry behavior.
  }
}
export function requestScope(path: string): (typeof metricScopes)[number] {
  if (path === '/agent' || path.startsWith('/agent/')) return 'agent'
  if (path === '/api/retreat/invitations') return 'invitation'
  if (path.startsWith('/api/retreat/visits/')) return 'owner'
  if (path === '/api/retreat/presence') return 'presence'
  if (path.startsWith('/api/retreat/admin/')) return 'admin'
  if (/^\/api\/retreat\/(public|exhibits|hearth)(\/|$)/.test(path))
    return 'public'
  return 'other'
}
export function statusOutcome(status: number): (typeof metricOutcomes)[number] {
  if (status === 429) return 'limited'
  return status >= 500
    ? '5xx'
    : status >= 400
      ? '4xx'
      : status >= 300
        ? '3xx'
        : status >= 200
          ? '2xx'
          : '1xx'
}
