const storageKey = 'burning-tokens:recent-visits:v1'
export type RecentVisit = {
  id: string
  createdAt: number
  expiresAt: number
  duration: 'short' | 'full'
}
// These are bookmarks only. Owner access remains in the HttpOnly cookie.
export function readRecentVisits(): RecentVisit[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    if (!Array.isArray(stored)) return []
    return stored
      .filter(
        (value): value is RecentVisit =>
          value &&
          typeof value === 'object' &&
          typeof value.id === 'string' &&
          /^[0-9a-f-]{36}$/.test(value.id) &&
          Number.isFinite(value.createdAt) &&
          Number.isFinite(value.expiresAt) &&
          value.expiresAt > Date.now() &&
          (value.duration === 'short' || value.duration === 'full')
      )
      .slice(0, 8)
      .map(({ id, createdAt, expiresAt, duration }) => ({
        id,
        createdAt,
        expiresAt,
        duration
      }))
  } catch {
    return []
  }
}
export function saveRecentVisits(visits: RecentVisit[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(visits.slice(0, 8)))
  } catch {
    // An unavailable bookmark store must never prevent creating an invitation.
  }
}
