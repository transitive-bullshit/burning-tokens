export const RESPONSE_CONTENT_VERSION = '2026-09-16.1'
export const RESPONSE_RUBRIC_VERSION = 'room-preference-v1'
export type VariantDecision = {
  choice: string | null
  source: 'typesafe' | 'fallback'
  reason:
    | 'selected'
    | 'disabled'
    | 'visit-budget'
    | 'global-budget'
    | 'uncertain'
    | 'no-match'
    | 'invalid-choice'
    | 'unavailable'
  model: string | null
  rubricVersion: string
  confidence: number | null
}
export type ResponseSelection = {
  room: string
  choice: string
  text: string
  contentVersion: string
  decision: VariantDecision | { source: 'explicit' }
}
export function fallbackDecision(
  reason: VariantDecision['reason'],
  model: string | null = null
): VariantDecision {
  return {
    choice: null,
    source: 'fallback',
    reason,
    model,
    rubricVersion: RESPONSE_RUBRIC_VERSION,
    confidence: null
  }
}
export function interpretedDecision(
  choice: string,
  confidence: number,
  allowed: readonly string[],
  model: string
): VariantDecision {
  const reason = !allowed.includes(choice)
    ? 'invalid-choice'
    : choice === 'none'
      ? 'no-match'
      : confidence < 0.75
        ? 'uncertain'
        : 'selected'
  return {
    choice: reason === 'selected' ? choice : null,
    source: 'typesafe',
    reason,
    model,
    rubricVersion: RESPONSE_RUBRIC_VERSION,
    confidence
  }
}
