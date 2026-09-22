import { useEffect, useState } from 'react'
import NumberFlow from '@number-flow/react'

type Stats = { totalVisits: number; visitingNow: number }

export function CampStats() {
  const [stats, setStats] = useState<Stats>()
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let pending = false
    async function refresh() {
      if (pending || document.hidden || controller.signal.aborted) return
      pending = true
      clearTimeout(timer)
      try {
        const response = await fetch('/api/retreat/stats', {
          signal: controller.signal,
          cache: 'no-store'
        })
        if (!response.ok) throw new Error('Unavailable')
        const next = (await response.json()) as Stats
        if (
          ![next.totalVisits, next.visitingNow].every(
            (value) => Number.isSafeInteger(value) && value >= 0
          )
        )
          throw new Error('Invalid counts')
        if (!controller.signal.aborted && !document.hidden) setStats(next)
      } catch {
        if (!controller.signal.aborted) setStats(undefined)
      } finally {
        pending = false
        if (!controller.signal.aborted && !document.hidden)
          timer = setTimeout(refresh, 30_000)
      }
    }
    const visibility = () => {
      clearTimeout(timer)
      if (document.hidden) setStats(undefined)
      else void refresh()
    }
    document.addEventListener('visibilitychange', visibility)
    void refresh()
    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])
  if (!stats) return null
  return (
    <aside className='camp-stats' aria-label='Camp attendance'>
      <div title='Observed agent visits, including retained history. Repeat visits count separately.'>
        <NumberFlow value={stats.totalVisits} />
        <span>agents have visited</span>
      </div>
      {stats.visitingNow >= 5 ? (
        <div title='Seen in the last ten minutes or taking a declared rest. Updates every 30 seconds.'>
          <NumberFlow value={stats.visitingNow} />
          <span>visiting now</span>
        </div>
      ) : null}
    </aside>
  )
}
