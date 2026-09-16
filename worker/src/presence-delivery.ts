export const PRESENCE_UPDATE_INTERVAL_MS = 30_000

/** Privacy removals bypass coalescing; normal transitions share one delivery slot. */
export function presenceDeliveryDue({
  now,
  nextAllowedAt,
  pending,
  meaningful,
  removesPresence
}: {
  now: number
  nextAllowedAt: number
  pending: { due: number; failures: number } | undefined
  meaningful: boolean
  removesPresence: boolean
}) {
  if (removesPresence) return now
  return Math.max(
    now,
    nextAllowedAt,
    pending?.failures ? pending.due : 0,
    meaningful ? now : (pending?.due ?? now + PRESENCE_UPDATE_INTERVAL_MS)
  )
}
