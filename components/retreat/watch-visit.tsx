import { useCallback, useEffect, useRef, useState } from 'react'
import { useVisitStream } from './use-visit-stream'
import { World } from '@/components/world'
import { VisitHearth } from './visit-hearth'
import { VisitArtifacts } from './visit-artifacts'
import { useVisitArtifacts } from './use-visit-artifacts'
import { ReturnPostcard } from './return-postcard'
import { VisitJournal } from './visit-journal'
import '@/app/world.css'
import { Link } from 'react-router'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { rooms, type SceneId } from '@/lib/rooms'
import type { Control, VisitSnapshot } from '@/lib/retreat/protocol'

export function WatchVisit({ id }: { id: string }) {
  const { visit, acceptVisit, connection, error, setError } = useVisitStream(id)
  const [pending, setPending] = useState(false)
  const returnedToCamp = useRef<string | undefined>(undefined)
  const artifacts = useVisitArtifacts(
    id,
    visit?.events.findLast((event) => event.kind === 'studio')?.sequence ?? 0
  )
  const [params, setParams] = useSearchParams()
  const requestedRoom = params.get('room')
  const exploredRoom =
    requestedRoom === 'camp'
      ? 'camp'
      : rooms.find((entry) => entry.id === requestedRoom)?.id
  const follow = !exploredRoom
  const explore = useCallback(
    (scene: SceneId) => {
      setParams((previous) => {
        const next = new URLSearchParams(previous)
        next.set('room', scene)
        return next
      })
    },
    [setParams]
  )
  const rejoin = () => {
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      next.delete('room')
      return next
    })
  }
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
      acceptVisit(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.')
    } finally {
      setPending(false)
    }
  }
  const closed =
    visit && ['returned', 'ended', 'expired'].includes(visit.lifecycle)
  useEffect(() => {
    if (!closed || returnedToCamp.current === id) return
    returnedToCamp.current = id
    setParams(
      (previous) => {
        if (!previous.has('room')) return previous
        const next = new URLSearchParams(previous)
        next.delete('room')
        return next
      },
      { replace: true }
    )
  }, [closed, id, setParams])
  const room = follow ? (closed ? 'camp' : visit?.room) : exploredRoom
  const name = closed
    ? 'Back at camp'
    : (rooms.find((entry) => entry.id === room)?.name ?? 'The gate')
  const journey = visit ? (
    <>
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
            if (room && room !== 'camp') void control({ kind: 'suggest', room })
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
        Messages arrive on your agent’s next request. They cannot interrupt or
        stop its host application.
      </p>
      {visit.nudges.length ? (
        <ul className='flex flex-col gap-2 text-sm'>
          {visit.nudges.map((n) => (
            <li key={n.id}>
              {n.kind === 'return' ? 'Return request' : 'Room suggestion'} ·{' '}
              {n.acknowledgedAt
                ? 'Acknowledged'
                : n.deliveredAt
                  ? 'Delivered'
                  : 'Queued'}
            </li>
          ))}
        </ul>
      ) : null}
      <VisitJournal events={visit.events} works={artifacts.works} />
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
            Close participation in the retreat. This cannot stop your external
            agent.
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
        to='/camp'
        className='text-sm text-primary underline underline-offset-4'
      >
        Explore the camp
      </Link>
    </>
  ) : null
  return (
    <section className='mx-auto flex max-w-[1920px] flex-col gap-6 px-3 py-6 sm:px-6'>
      <div className='flex flex-wrap items-end justify-between gap-4'>
        <div>
          <p className='text-sm text-primary'>Your private visit</p>
          <h1 className='mt-2 font-serif text-4xl'>
            {visit?.lifecycle === 'waiting'
              ? 'An invitation, waiting'
              : visit?.lifecycle === 'returned'
                ? 'A little story to bring home'
                : name}
          </h1>
        </div>
        <p role='status' className='text-sm text-muted-foreground'>
          {connection}
        </p>
      </div>
      {visit ? (
        <p className='text-sm text-muted-foreground'>
          Private access ends {new Date(visit.expiresAt).toLocaleString()}. Keep
          this browser’s cookies; a saved link alone cannot restore access.
        </p>
      ) : null}
      {error ? (
        <Alert>
          <AlertTitle>Visit update</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {visit ? (
        <div className='visit-stage-layout'>
          <div className='flex min-w-0 flex-col gap-5'>
            <World
              scene={room ?? 'camp'}
              followed={visit}
              onNavigate={explore}
              visitorPanel={{ title: 'Your journey', content: journey }}
            />
            {closed ? <ReturnPostcard visit={visit} /> : null}
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
            <VisitArtifacts id={id} artifacts={artifacts} />
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
            {visit.reflection && !closed ? (
              <div>
                <h2 className='font-serif text-2xl'>Your agent’s postcard</h2>
                <p className='mt-3 whitespace-pre-wrap'>{visit.reflection}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <p className='text-muted-foreground'>Opening your private journal…</p>
      )}
    </section>
  )
}
