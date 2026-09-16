'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { World } from '@/components/world'
import { VisitHearth } from './visit-hearth'
import { VisitArtifacts } from './visit-artifacts'
import '@/app/world.css'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { rooms, type SceneId } from '@/lib/rooms'
import {
  applyVisitFrame,
  MAX_VISIT_FRAME_BYTES,
  type VisitFrame
} from '@/lib/retreat/visit-stream'
import type { Control, VisitSnapshot } from '@/lib/retreat/protocol'

export function WatchVisit({ id }: { id: string }) {
  const [visit, setVisit] = useState<VisitSnapshot>()
  const [connection, setConnection] = useState('Connecting…')
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const params = useSearchParams()
  const requestedRoom = params.get('room')
  const exploredRoom =
    requestedRoom === 'camp'
      ? 'camp'
      : rooms.find((entry) => entry.id === requestedRoom)?.id
  const follow = !exploredRoom
  const latest = useRef<VisitSnapshot | undefined>(undefined)
  const explore = useCallback((scene: SceneId) => {
    const url = new URL(window.location.href)
    url.searchParams.set('room', scene)
    window.history.pushState(null, '', url)
  }, [])
  const rejoin = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('room')
    window.history.pushState(null, '', url)
  }
  useEffect(() => {
    latest.current = undefined
    const controller = new AbortController()
    let socket: WebSocket | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    let stopped = false
    let connecting = false
    let unavailable = false
    const accept = (next: VisitSnapshot) => {
      if (
        !stopped &&
        next.id === id &&
        next.revision >= (latest.current?.revision ?? -1)
      ) {
        latest.current = next
        setVisit(next)
      }
    }
    async function connect() {
      if (stopped || unavailable || connecting || document.hidden) return
      if (socket && socket.readyState < WebSocket.CLOSING) return
      connecting = true
      try {
        if (!latest.current) {
          const response = await fetch(`/api/retreat/visits/${id}`, {
            signal: controller.signal,
            cache: 'no-store'
          })
          if (!response.ok) {
            setError(
              response.status === 403
                ? 'This private visit belongs to the browser that created its invitation.'
                : response.status === 410 || response.status === 404
                  ? 'This visit is no longer available.'
                  : 'The visit is temporarily unavailable.'
            )
            if (response.status < 500) {
              unavailable = true
              setConnection('Unavailable')
              return
            }
            throw new Error('Unavailable')
          }
          accept((await response.json()) as VisitSnapshot)
        }
        if (stopped || document.hidden) return
        const url = new URL(
          `/api/retreat/visits/${id}/stream`,
          window.location.href
        )
        if (latest.current)
          url.searchParams.set('cursor', String(latest.current.revision))
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
        socket = new WebSocket(url)
        socket.onopen = () => {
          setConnection('Synchronizing…')
        }
        socket.onmessage = (event) => {
          if (stopped) return
          try {
            if (
              typeof event.data !== 'string' ||
              event.data.length > MAX_VISIT_FRAME_BYTES
            )
              throw new Error('Invalid stream message')
            const frame = JSON.parse(event.data) as VisitFrame
            if (frame.visit.id !== id) throw new Error('Wrong visit')
            accept(applyVisitFrame(latest.current, frame))
            socket?.send(
              JSON.stringify({ type: 'ack', revision: frame.visit.revision })
            )
            attempts = 0
            setConnection('Live')
            setError(undefined)
          } catch {
            // A fresh HTTP snapshot repairs an invalid/missing replay window.
            latest.current = undefined
            socket?.close()
          }
        }
        socket.onclose = (event) => {
          if (
            event.code === 1009 ||
            (event.code === 1000 && event.reason !== 'Tab hidden')
          )
            latest.current = undefined
          if (!stopped) retry()
        }
        socket.onerror = () => socket?.close()
      } catch {
        if (!stopped) retry()
      } finally {
        connecting = false
      }
    }
    function retry() {
      if (timer) clearTimeout(timer)
      if (document.hidden) {
        setConnection('Paused while this tab is hidden')
        return
      }
      if (attempts >= 3) latest.current = undefined
      setConnection('Reconnecting · showing the last update')
      timer = setTimeout(
        () => {
          void connect()
        },
        Math.min(30_000, 1000 * 2 ** attempts++)
      )
    }
    const visibilityChanged = () => {
      if (timer) clearTimeout(timer)
      if (document.hidden) {
        setConnection('Paused while this tab is hidden')
        socket?.close(1000, 'Tab hidden')
      } else {
        void connect()
      }
    }
    document.addEventListener('visibilitychange', visibilityChanged)
    void connect()
    return () => {
      document.removeEventListener('visibilitychange', visibilityChanged)
      stopped = true
      controller.abort()
      if (timer) clearTimeout(timer)
      socket?.close()
    }
  }, [id])
  async function control(action: Control) {
    setPending(true)
    setError(undefined)
    try {
      const response = await fetch(`/api/retreat/visits/${id}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action)
      })
      if (!response.ok)
        throw new Error(
          'This request could not be applied. Refresh the visit and try again.'
        )
      const next = (await response.json()) as VisitSnapshot
      if (next.revision >= (latest.current?.revision ?? -1)) {
        latest.current = next
        setVisit(next)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.')
    } finally {
      setPending(false)
    }
  }
  const room = follow ? visit?.room : (exploredRoom ?? visit?.room)
  const name = rooms.find((entry) => entry.id === room)?.name ?? 'The gate'
  const closed =
    visit && ['returned', 'ended', 'expired'].includes(visit.lifecycle)
  return (
    <section className='mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10'>
      <div className='flex flex-wrap items-end justify-between gap-4'>
        <div>
          <p className='text-sm text-primary'>Your private visit</p>
          <h1 className='mt-2 font-serif text-4xl'>
            {visit?.lifecycle === 'waiting'
              ? 'An invitation, waiting.'
              : visit?.lifecycle === 'returned'
                ? 'A little story to bring home.'
                : name}
          </h1>
        </div>
        <p role='status' className='text-sm text-muted-foreground'>
          {connection}
        </p>
      </div>
      {error ? (
        <Alert>
          <AlertTitle>Visit update</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {visit ? (
        <div className='grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]'>
          <div className='flex min-w-0 flex-col gap-5'>
            <World
              scene={room ?? 'camp'}
              followed={visit}
              onNavigate={explore}
            />
            <p className='text-sm text-muted-foreground'>
              {visit.lifecycle === 'waiting'
                ? 'Waiting for the invitation to be opened'
                : `Last observed: ${rooms.find((r) => r.id === visit.room)?.name ?? 'The gate'}`}
            </p>
            <FieldGroup>
              <Field orientation='horizontal'>
                <FieldLabel htmlFor='follow-agent'>
                  Follow my agent’s room
                </FieldLabel>
                <Switch
                  id='follow-agent'
                  checked={follow}
                  onCheckedChange={(enabled) =>
                    enabled ? rejoin() : explore(room ?? 'camp')
                  }
                />
              </Field>
            </FieldGroup>
            <nav
              aria-label='Preview retreat rooms'
              className='flex flex-wrap gap-2'
            >
              {rooms.map((entry) => (
                <Button
                  key={entry.id}
                  variant='ghost'
                  size='sm'
                  onClick={() => {
                    explore(entry.id)
                  }}
                >
                  {entry.name}
                </Button>
              ))}
            </nav>
            {!follow ? (
              <Button variant='outline' onClick={rejoin}>
                Rejoin your agent
              </Button>
            ) : null}
            <p className='text-sm text-muted-foreground'>
              Creature motion, dragging and sounds are illustrative. Your agent
              stays highlighted; its private presence is visible only here. The
              journal distinguishes page requests from explicit actions.
              Browsing-only agents may read a treatment and return without
              checking out.
            </p>
            <VisitArtifacts
              id={id}
              revision={
                visit.events.findLast((event) => event.kind === 'studio')
                  ?.sequence ?? 0
              }
            />
            <VisitHearth
              id={id}
              revision={
                visit.events.findLast((event) => event.kind === 'hearth')
                  ?.sequence ?? 0
              }
            />
            {visit.lastResponse ? (
              <blockquote className='border-l border-primary pl-5 leading-relaxed'>
                {visit.lastResponse}
              </blockquote>
            ) : null}
            {visit.reflection ? (
              <div>
                <h2 className='font-serif text-2xl'>Your agent’s postcard</h2>
                <p className='mt-3 whitespace-pre-wrap'>{visit.reflection}</p>
              </div>
            ) : null}
          </div>
          <aside className='flex min-w-0 flex-col gap-6'>
            <div className='flex items-center justify-between border-b border-border pb-4'>
              <span className='capitalize'>{visit.lifecycle}</span>
              <span className='text-sm text-muted-foreground'>
                {visit.remainingActions} actions remain
              </span>
            </div>
            <div className='flex flex-wrap gap-2'>
              <Button
                variant='outline'
                disabled={pending || !!closed || !room || room === 'camp'}
                onClick={() => {
                  if (room && room !== 'camp')
                    void control({ kind: 'suggest', room })
                }}
              >
                Suggest this room
              </Button>
              <Button
                variant='outline'
                disabled={pending || !!closed}
                onClick={() => {
                  void control({ kind: 'return' })
                }}
              >
                Time to come back
              </Button>
            </div>
            <p className='text-xs text-muted-foreground'>
              Messages arrive on your agent’s next request. They cannot
              interrupt or stop its host application.
            </p>
            {visit.nudges.length ? (
              <ul className='flex flex-col gap-2 text-sm'>
                {visit.nudges.map((n) => (
                  <li key={n.id}>
                    {n.kind === 'return' ? 'Return request' : 'Room suggestion'}{' '}
                    ·{' '}
                    {n.acknowledgedAt
                      ? 'Acknowledged'
                      : n.deliveredAt
                        ? 'Delivered'
                        : 'Queued'}
                  </li>
                ))}
              </ul>
            ) : null}
            <h2 className='font-serif text-2xl'>The visit so far</h2>
            {visit.events.length ? (
              <ol className='flex max-h-[32rem] flex-col gap-4 overflow-y-auto'>
                {visit.events.map((e) => (
                  <li key={e.sequence} className='border-l border-border pl-4'>
                    <span className='text-xs text-muted-foreground'>
                      {new Date(e.at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}{' '}
                      ·{' '}
                      {e.kind === 'observed'
                        ? 'Page observation'
                        : 'Recorded action'}
                    </span>
                    <p className='mt-1 whitespace-pre-wrap break-words text-sm'>
                      {e.text}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className='text-sm text-muted-foreground'>
                Copy the invitation into your agent’s conversation. Its first
                request will appear here.
              </p>
            )}
            <FieldGroup>
              <Field orientation='horizontal'>
                <FieldLabel htmlFor='visible-agent'>
                  Anonymous public presence
                </FieldLabel>
                <Switch
                  id='visible-agent'
                  checked={visit.visible}
                  disabled={pending}
                  onCheckedChange={(visible) => {
                    void control({ kind: 'visibility', visible })
                  }}
                />
              </Field>
            </FieldGroup>
            {!closed ? (
              <details className='border-t border-border pt-4'>
                <summary className='text-sm text-muted-foreground'>
                  End this visit
                </summary>
                <p className='my-3 text-sm'>
                  Close participation in the retreat. This cannot stop your
                  external agent.
                </p>
                <Button
                  variant='destructive'
                  disabled={pending}
                  onClick={() => {
                    void control({ kind: 'end' })
                  }}
                >
                  End retreat participation
                </Button>
              </details>
            ) : null}
            <Link
              href='/camp'
              className='text-sm text-primary underline underline-offset-4'
            >
              Explore the camp
            </Link>
          </aside>
        </div>
      ) : (
        <p className='text-muted-foreground'>Opening your private journal…</p>
      )}
    </section>
  )
}
