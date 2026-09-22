export type WorldPreferences = {
  demo: boolean
  count: number
}
export function loadWorldPreferences(): WorldPreferences
export function saveWorldPreferences(next: Partial<WorldPreferences>): void
