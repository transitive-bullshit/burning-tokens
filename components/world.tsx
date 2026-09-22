import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router'
import type { SceneId } from '@/lib/rooms'
import { scenePath } from '@/lib/rooms'
import { worldMarkup } from '@/lib/world/markup'
import {
  loadWorldPreferences,
  saveWorldPreferences
} from '@/lib/world/preferences.js'
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
  onNavigate,
  visitorPanel
}: {
  scene: SceneId
  followed?: FollowedVisitor
  onNavigate?: (scene: SceneId) => void
  visitorPanel?: { title: string; content: ReactNode }
}) {
  const root = useRef<HTMLDivElement>(null)
  const [statusTarget, setStatusTarget] = useState<Element | null>(null)
  const [controlsTarget, setControlsTarget] = useState<Element | null>(null)
  const [panelTitleTarget, setPanelTitleTarget] = useState<Element | null>(null)
  const [panelContentTarget, setPanelContentTarget] = useState<Element | null>(
    null
  )
  const attachRoot = useCallback((element: HTMLDivElement | null) => {
    root.current = element
    setStatusTarget(element?.querySelector('#visitor-status') ?? null)
    setControlsTarget(
      element?.querySelector('#visitor-display-controls') ?? null
    )
    setPanelTitleTarget(element?.querySelector('#visitor-panel-title') ?? null)
    setPanelContentTarget(
      element?.querySelector('#visitor-panel-content') ?? null
    )
  }, [])
  const navigate = useNavigate()
  const location = useLocation()
  const hasVisitorPanel = Boolean(visitorPanel)
  const minimizeVisitors =
    !followed && (scene !== 'camp' || location.state?.minimizeVisitors === true)
  const currentFollow = useRef(followed)
  const refreshPopulation = useRef<(() => void) | undefined>(undefined)
  useLayoutEffect(() => {
    currentFollow.current = followed
    refreshPopulation.current?.()
  }, [followed])
  const [error, setError] = useState(false)
  const [demo, setDemo] = useState(() => loadWorldPreferences().demo)
  const live = Boolean(followed) || !demo
  const liveMode = useRef(live)
  useEffect(() => {
    liveMode.current = live
    refreshPopulation.current?.()
  }, [live])
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
      if (!liveMode.current || canceled) return
      const merged = withFollowedVisitor(snapshot, currentFollow.current, scene)
      dispose?.updatePopulation(
        merged.visitors,
        snapshot.total,
        merged.selectedId
      )
    }
    refreshPopulation.current = () => {
      dispose?.setLive(liveMode.current)
      applyPopulation()
      void poll()
    }
    const controller = new AbortController()
    const element = root.current
    if (!element) return
    setError(false)
    setStatus(liveMode.current ? 'Connecting to the camp…' : 'Demo visitors')
    async function poll() {
      if (canceled || !liveMode.current || document.hidden || polling) return
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
            onNavigate
              ? onNavigate(next)
              : navigate(scenePath(next), {
                  state: { minimizeVisitors: true }
                }),
          {
            live: liveMode.current,
            minimizeVisitors,
            openVisitors: hasVisitorPanel,
            onFollow: currentFollow.current
              ? undefined
              : (publicId) => navigate(`/camp/visitors/${publicId}`)
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
  }, [scene, navigate, onNavigate, minimizeVisitors, hasVisitorPanel])
  return (
    <div
      className={
        followed ? 'world-container world-following' : 'world-container'
      }
    >
      {statusTarget
        ? createPortal(
            live ? <span role='status'>{status}</span> : null,
            statusTarget
          )
        : null}
      {panelTitleTarget
        ? createPortal(visitorPanel?.title ?? 'Visitors', panelTitleTarget)
        : null}
      {visitorPanel && panelContentTarget
        ? createPortal(
            <div className='visit-journey'>{visitorPanel.content}</div>,
            panelContentTarget
          )
        : null}
      {!followed && controlsTarget
        ? createPortal(
            <label className='flex cursor-pointer select-none items-center gap-2'>
              <input
                type='checkbox'
                checked={!live}
                onChange={(event) => {
                  setDemo(event.target.checked)
                  saveWorldPreferences({ demo: event.target.checked })
                }}
              />
              Demo visitors
            </label>,
            controlsTarget
          )
        : null}

      {error ? (
        <p role='alert'>
          The camp could not wake up. Please refresh to try again.
        </p>
      ) : null}
      <div
        ref={attachRoot}
        className='world'
        dangerouslySetInnerHTML={{ __html: worldMarkup }}
      />
    </div>
  )
}
