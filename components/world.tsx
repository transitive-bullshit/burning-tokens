'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SceneId } from '@/lib/rooms'
import { scenePath } from '@/lib/rooms'
import { worldMarkup } from '@/lib/world/markup'
import {
  livePopulation,
  withFollowedVisitor,
  type FollowedVisitor
} from '@/lib/world/live-population.js'
import type { WorldHandle } from '@/lib/world/scene'

type CrowdSnapshot = { visitors: unknown[]; total: number }

export function World({
  scene,
  followed,
  onNavigate
}: {
  scene: SceneId
  followed?: FollowedVisitor
  onNavigate?: (scene: SceneId) => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const currentFollow = useRef(followed)
  const refreshPopulation = useRef<(() => void) | undefined>(undefined)
  useEffect(() => {
    currentFollow.current = followed
    refreshPopulation.current?.()
  }, [followed])
  const [error, setError] = useState(false)
  const [live, setLive] = useState(true)
  const [status, setStatus] = useState('Connecting to the camp…')
  useEffect(() => {
    let canceled = false
    let dispose: WorldHandle | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let polling = false
    let snapshot: CrowdSnapshot = {
      visitors: [],
      total: 0
    }
    const applyPopulation = () => {
      if (!live || canceled) return
      const merged = withFollowedVisitor(snapshot, currentFollow.current, scene)
      dispose?.updatePopulation(
        merged.visitors,
        snapshot.total,
        merged.selectedId
      )
    }
    refreshPopulation.current = applyPopulation
    const controller = new AbortController()
    const element = root.current
    if (!element) return
    setError(false)
    setStatus(
      live
        ? 'Connecting to the camp…'
        : 'Demo visitors · no real agent activity'
    )
    async function poll() {
      if (canceled || !live || document.hidden || polling) return
      polling = true
      clearTimeout(timer)
      try {
        const query =
          scene === 'camp' ? '' : `?room=${encodeURIComponent(scene)}`
        const response = await fetch(`/api/retreat/presence${query}`, {
          signal: controller.signal
        })
        if (!response.ok) throw new Error('Unavailable')
        const next = await response.json()
        if (
          !Number.isSafeInteger(next.total) ||
          next.total < 0 ||
          !Number.isFinite(next.generatedAt)
        )
          throw new Error('Invalid snapshot')
        livePopulation(next)
        if (canceled) return
        snapshot = next
        applyPopulation()
        setStatus(
          snapshot.total === 0
            ? currentFollow.current
              ? 'No other public visitors in this snapshot.'
              : 'No public visitors here yet.'
            : `${snapshot.total} public visits tracked · updated ${new Date(next.generatedAt).toLocaleTimeString()}`
        )
      } catch {
        if (!canceled)
          setStatus(
            'Live updates unavailable · any displayed visitors are from the last snapshot'
          )
      } finally {
        polling = false
        if (!canceled) timer = setTimeout(poll, 30_000)
      }
    }
    const onVisibility = () => {
      if (document.hidden) clearTimeout(timer)
      else void poll()
    }
    document.addEventListener('visibilitychange', onVisibility)
    import('@/lib/world/scene.js')
      .then(({ mountWorld }) => {
        if (canceled) return
        dispose = mountWorld(
          element,
          scene,
          (next) =>
            onNavigate ? onNavigate(next) : router.push(scenePath(next)),
          {
            live,
            onFollow: currentFollow.current
              ? undefined
              : (publicId) => router.push(`/camp/visitors/${publicId}`)
          }
        )
        applyPopulation()
        void poll()
      })
      .catch(() => {
        if (!canceled) setError(true)
      })
    return () => {
      canceled = true
      refreshPopulation.current = undefined
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      dispose?.()
    }
  }, [scene, router, live, onNavigate])
  return (
    <div
      className={
        followed ? 'world-container world-following' : 'world-container'
      }
    >
      <div className='mb-3 flex flex-wrap items-center justify-between gap-3 text-sm'>
        <p role='status'>{status}</p>
        {!followed ? (
          <label className='flex cursor-pointer items-center gap-2'>
            <input
              type='checkbox'
              checked={!live}
              onChange={(event) => setLive(!event.target.checked)}
            />
            Demo visitors
          </label>
        ) : null}
      </div>
      {error ? (
        <p role='alert'>
          The camp could not wake up. Please refresh to try again.
        </p>
      ) : null}
      <div
        key={live ? 'live' : 'demo'}
        ref={root}
        className='world'
        dangerouslySetInnerHTML={{ __html: worldMarkup }}
      />
    </div>
  )
}
