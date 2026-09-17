export type WorldPreferences = {
  demo: boolean
  count: number
  mode: 'summary' | 'full'
}
export function loadWorldPreferences(): WorldPreferences
export function saveWorldPreferences(next: Partial<WorldPreferences>): void
