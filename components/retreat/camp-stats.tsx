import { useEffect, useState } from 'react'
import NumberFlow from '@number-flow/react'

type Stats = { totalVisits: number; visitingNow: number }

const VISIT_GOAL = 1_000
const JEV_COST_PER_VISIT = 0.00008
const CLOUDFLARE_COST_PER_VISIT = 0.00012
const OPERATING_COST_BUFFER = 10
const ESTIMATED_COST_PER_VISIT =
  (JEV_COST_PER_VISIT + CLOUDFLARE_COST_PER_VISIT) * OPERATING_COST_BUFFER

const percent = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1
})

const dollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 4
})

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
  const progress = stats ? Math.min(stats.totalVisits / VISIT_GOAL, 1) : 0
  const estimatedSpend = stats
    ? stats.totalVisits * ESTIMATED_COST_PER_VISIT
    : undefined

  return (
    <aside
      className='camp-stats'
      aria-label='Camp visit goal and estimated costs'
    >
      <div className='camp-stats-heading'>Agents welcomed so far</div>
      <div
        className='camp-stats-total'
        title='Observed agent visits, including retained history. Repeat visits count separately.'
      >
        <strong>
          {stats ? (
            <NumberFlow value={stats.totalVisits} />
          ) : (
            <span aria-label='Live count unavailable'>—</span>
          )}
        </strong>
        <span>of {VISIT_GOAL.toLocaleString('en-US')}</span>
      </div>
      <div
        className='camp-stats-progress'
        role='progressbar'
        aria-label='Progress toward the visit goal'
        aria-valuemin={0}
        aria-valuemax={VISIT_GOAL}
        aria-valuenow={
          stats ? Math.min(stats.totalVisits, VISIT_GOAL) : undefined
        }
      >
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      <div className='camp-stats-progress-copy'>
        <span>
          {stats
            ? `${percent.format(progress * 100)}% of the first thousand`
            : 'Live counts appear when connected'}
        </span>
        {stats && stats.visitingNow > 0 ? (
          <span title='Seen in the last ten minutes or taking a declared rest. Updates every 30 seconds.'>
            {stats.visitingNow.toLocaleString('en-US')} here now
          </span>
        ) : null}
      </div>
      <div className='camp-stats-costs'>
        <div>
          <span>Est. cost / visit</span>
          <strong>~{dollars.format(ESTIMATED_COST_PER_VISIT)}</strong>
        </div>
        <div>
          <span>Est. spend so far</span>
          <strong>
            {estimatedSpend === undefined
              ? '—'
              : `~${dollars.format(estimatedSpend)}`}
          </strong>
        </div>
      </div>
      <details>
        <summary>Show the math</summary>
        <p>
          Core estimate: ~$0.00008 Jev + ~$0.00012 Cloudflare per visit. We show
          10× that amount to cover bandwidth, analytics, storage and other
          unmodeled usage. Included usage may lower the actual bill.
        </p>
      </details>
    </aside>
  )
}
