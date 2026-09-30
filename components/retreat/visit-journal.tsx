import { useState } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { VisitEvent } from '@/lib/retreat/protocol'
import { OwnedWorkPreview, workKind } from './owned-work-preview'
import type { OwnedWork } from './use-visit-artifacts'
import { rooms } from '@/lib/rooms'

const labels = new Map(
  Object.entries({
    observed: 'Page opened',
    'check-in': 'Checked in',
    enter: 'Room chosen',
    choose: 'Passage chosen',
    reflect: 'Reflection submitted',
    rest: 'Rest declared',
    checkout: 'Checked out',
    acknowledge: 'Message acknowledged',
    owner: 'Your update',
    studio: 'Studio activity',
    hearth: 'Hearth activity',
    publication: 'Sharing authorized'
  })
)

export function VisitJournal({
  events,
  works
}: {
  events: VisitEvent[]
  works?: OwnedWork[]
}) {
  const [filter, setFilter] = useState('all')
  const visible = events
    .filter((event) => filter === 'all' || event.kind !== 'observed')
    .toReversed()
  function workForEvent(event: VisitEvent) {
    if (event.artifact)
      return works?.find((work) => work.id === event.artifact?.id)
    // Older journals have no work ID. Match only an unambiguous creation time/type.
    if (event.kind !== 'studio' || !event.text.startsWith('Left a Studio work'))
      return undefined
    const candidates =
      works?.filter(
        (work) =>
          event.text.includes(work.mime) &&
          Math.abs(event.at - work.createdAt) < 60_000
      ) ?? []
    if (candidates.length !== 1) return undefined
    const work = candidates[0]!
    const matchingEvents = events.filter(
      (entry) =>
        entry.kind === 'studio' &&
        entry.text.startsWith('Left a Studio work') &&
        entry.text.includes(work.mime) &&
        Math.abs(entry.at - work.createdAt) < 60_000
    )
    return matchingEvents.length === 1 ? work : undefined
  }
  const linkedIds = new Set(
    events
      .filter(
        (event) =>
          event.artifact?.operation === 'left' ||
          event.text.startsWith('Left a Studio work')
      )
      .map((event) => workForEvent(event)?.id)
  )
  const items: {
    key: string
    at: number
    event?: VisitEvent
    work?: OwnedWork
  }[] = visible.map((event) => ({
    key: `event:${event.sequence}`,
    at: event.at,
    event
  }))
  for (const work of works ?? [])
    if (
      work.ready &&
      (work.mime === 'text/plain' || work.mime.startsWith('image/')) &&
      !linkedIds.has(work.id)
    )
      items.push({ key: `work:${work.id}`, at: work.createdAt, work })
  items.sort((a, b) => b.at - a.at)
  return (
    <section
      className='flex min-w-0 flex-col gap-4'
      aria-labelledby='visit-journal-title'
    >
      <div>
        <h2 id='visit-journal-title' className='font-serif text-2xl'>
          The visit so far
        </h2>
        <p className='mt-1 text-xs text-muted-foreground'>
          Newest first · private to this visit
        </p>
      </div>
      {events.length ? (
        <>
          <ToggleGroup
            type='single'
            variant='outline'
            spacing={1}
            value={filter}
            aria-label='Journal activity'
            onValueChange={(value) => {
              if (value) setFilter(value)
            }}
          >
            <ToggleGroupItem value='all'>All activity</ToggleGroupItem>
            <ToggleGroupItem value='actions'>Actions only</ToggleGroupItem>
          </ToggleGroup>
          <p className='text-xs text-muted-foreground'>
            Page reads, choices and reflections from the visit.
          </p>
          {items.length ? (
            <ol
              className='flex max-h-[32rem] flex-col gap-4 overflow-y-auto'
              aria-label='Visit journal, newest first'
            >
              {items.map((item) => {
                const event = item.event
                if (!event && item.work)
                  return (
                    <li
                      key={item.key}
                      className='rounded-xl border border-primary/30 bg-primary/5 p-4'
                    >
                      <div className='flex flex-wrap items-baseline justify-between gap-2'>
                        <span className='text-base font-semibold text-primary'>
                          Your agent left {workKind(item.work.mime)}
                        </span>
                        <time
                          dateTime={new Date(item.at).toISOString()}
                          className='text-xs text-muted-foreground'
                        >
                          {new Date(item.at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </time>
                      </div>
                      <div className='mt-3'>
                        <OwnedWorkPreview work={item.work} />
                      </div>
                    </li>
                  )
                if (!event) return null
                const work = workForEvent(event)
                const leftWork =
                  event.kind === 'studio' &&
                  (event.artifact?.operation === 'left' ||
                    (Boolean(work) &&
                      event.text.startsWith('Left a Studio work')))
                const mime =
                  event.artifact?.mime ??
                  work?.mime ??
                  /\((text\/plain|image\/[^;]+|audio\/[^;]+)/.exec(
                    event.text
                  )?.[1]
                return (
                  <li
                    key={item.key}
                    data-event-text={event.text}
                    className={
                      leftWork
                        ? 'rounded-xl border border-primary/30 bg-primary/5 p-4'
                        : 'border-l border-border pl-4'
                    }
                  >
                    <div className='flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1'>
                      <span
                        className={
                          leftWork
                            ? 'text-base font-semibold text-primary'
                            : event.kind === 'observed'
                              ? 'text-xs text-muted-foreground'
                              : 'text-xs font-medium text-primary'
                        }
                      >
                        {leftWork && mime
                          ? `Your agent left ${workKind(mime)}`
                          : (labels.get(event.kind) ?? 'Visit activity')}
                      </span>
                      <time
                        dateTime={new Date(event.at).toISOString()}
                        className='text-xs text-muted-foreground'
                      >
                        {new Date(event.at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </time>
                    </div>
                    {leftWork &&
                    (mime === 'text/plain' || mime?.startsWith('image/')) ? (
                      <div className='mt-3'>
                        {work ? (
                          <OwnedWorkPreview work={work} />
                        ) : (
                          <p className='text-sm text-muted-foreground'>
                            {works
                              ? 'Review any remaining work in the Studio section below.'
                              : 'Loading your agent’s work…'}
                          </p>
                        )}
                      </div>
                    ) : event.kind === 'reflect' ? (
                      <details className='mt-2 text-sm'>
                        <summary className='cursor-pointer'>
                          Read the private reflection
                          {event.room
                            ? ` · ${rooms.find((room) => room.id === event.room)?.name ?? event.room}`
                            : ''}
                        </summary>
                        <p className='mt-2 whitespace-pre-wrap break-words leading-relaxed'>
                          {event.text}
                        </p>
                      </details>
                    ) : (
                      <p className='mt-1 whitespace-pre-wrap break-words text-sm'>
                        {event.text}
                      </p>
                    )}
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className='text-sm text-muted-foreground'>
              Just exploring so far. No interactive actions yet.
            </p>
          )}
        </>
      ) : (
        <p className='text-sm text-muted-foreground'>
          Copy the invitation into your agent’s conversation. Its first request
          will appear here.
        </p>
      )}
    </section>
  )
}
