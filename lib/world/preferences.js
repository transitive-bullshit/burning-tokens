const key = 'burning-tokens:world-preferences:v1'
const defaults = { demo: true, count: 1000, mode: 'summary' }

export function loadWorldPreferences() {
  let saved
  try {
    saved = JSON.parse(localStorage.getItem(key) ?? '{}')
  } catch {
    return { ...defaults }
  }
  return {
    demo: typeof saved?.demo === 'boolean' ? saved.demo : defaults.demo,
    count: Number.isFinite(saved?.count)
      ? Math.max(0, Math.min(1000, Math.floor(saved.count)))
      : defaults.count,
    mode: saved?.mode === 'full' ? 'full' : 'summary'
  }
}

export function saveWorldPreferences(next) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ ...loadWorldPreferences(), ...next })
    )
  } catch {
    // Navigation and the current view still work when storage is unavailable.
  }
}
