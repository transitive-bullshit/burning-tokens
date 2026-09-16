/** Agent activity, never spectator reads, determines eligibility. */
export const ACTIVE_WINDOW_MS = 10 * 60 * 1000

export function isRecentPresence(
  lastSeen: number | null,
  restUntil: number | null,
  now: number
) {
  return (
    (lastSeen !== null && lastSeen > now - ACTIVE_WINDOW_MS) ||
    (restUntil !== null && restUntil > now)
  )
}

/** Give each occupied room a seat, then distribute remaining seats proportionally. */
export function roomSampleBudgets(
  groups: ReadonlyArray<{ room: string | null; count: number }>,
  limit: number
) {
  const occupied = groups
    .filter((group) => group.count > 0)
    .sort((a, b) => (a.room ?? '').localeCompare(b.room ?? ''))
  const population = occupied.reduce((n, group) => n + group.count, 0)
  const target = Math.max(0, Math.min(Math.floor(limit), population))
  const result = occupied.map((group, index) => ({
    ...group,
    budget: index < target ? 1 : 0
  }))
  let remaining = target - result.reduce((n, group) => n + group.budget, 0)
  const capacity = result.reduce(
    (n, group) => n + group.count - group.budget,
    0
  )
  if (!remaining || !capacity) return result
  const shares = result.map((group) => {
    const exact = (remaining * (group.count - group.budget)) / capacity
    const whole = Math.floor(exact)
    group.budget += whole
    return { group, fraction: exact - whole }
  })
  remaining = target - result.reduce((n, group) => n + group.budget, 0)
  shares.sort((a, b) => b.fraction - a.fraction)
  for (const { group } of shares) {
    if (!remaining) break
    if (group.budget < group.count) {
      group.budget++
      remaining--
    }
  }
  return result
}
