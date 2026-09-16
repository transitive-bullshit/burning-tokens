type Counter = { window: number; count: number }
type Storage = {
  get<T>(key: string): T | undefined
  put<T>(key: string, value: T): void
}
const limit = (
  value: string | undefined,
  fallback: number,
  maximum: number
) => {
  if (value === undefined) return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0
    ? Math.min(maximum, parsed)
    : 0
}

/** Synchronous reservations serialize inside one daily Durable Object. */
export function reserveVisit(
  storage: Storage,
  network: string,
  now: number,
  config: {
    INVITATIONS_DAILY_LIMIT?: string
    INVITATIONS_MINUTE_LIMIT?: string
  }
): boolean {
  if (!/^[a-f0-9]{64}$/.test(network)) return false
  const day = Math.floor(now / 86_400_000)
  const total = storage.get<Counter>('visits:day') ?? { window: day, count: 0 }
  // The caller selects a new object each UTC day; a stale object never reopens.
  if (total.window !== day) return false
  const minute = Math.floor(now / 60_000)
  const previousMinute = storage.get<Counter>('visits:minute')
  const burst =
    previousMinute?.window === minute
      ? previousMinute
      : { window: minute, count: 0 }
  const hour = Math.floor(now / 3_600_000)
  const previousNetwork = storage.get<Counter>(`network:${network}`)
  const client =
    previousNetwork?.window === hour
      ? previousNetwork
      : { window: hour, count: 0 }
  if (
    total.count >= limit(config.INVITATIONS_DAILY_LIMIT, 10_000, 10_000) ||
    burst.count >= limit(config.INVITATIONS_MINUTE_LIMIT, 120, 1000) ||
    client.count >= 20
  )
    return false
  storage.put('visits:day', { window: day, count: total.count + 1 })
  storage.put('visits:minute', { window: minute, count: burst.count + 1 })
  storage.put(`network:${network}`, { window: hour, count: client.count + 1 })
  return true
}
