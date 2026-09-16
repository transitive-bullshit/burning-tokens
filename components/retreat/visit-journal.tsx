import { useState } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { VisitEvent } from '@/lib/retreat/protocol'
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

export function VisitJournal({ events }: { events: VisitEvent[] }) {
  const [filter, setFilter] = useState('all')
  const visible = events
    .filter((event) => filter === 'all' || event.kind !== 'observed')
    .toReversed()
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
            Page reads show where your agent looked. Choices and reflections
            show what it explicitly did.
          </p>
          {visible.length ? (
            <ol
              className='flex max-h-[32rem] flex-col gap-4 overflow-y-auto'
              aria-label='Visit journal, newest first'
            >
              {visible.map((event) => (
                <li
                  key={event.sequence}
                  className='border-l border-border pl-4'
                >
                  <div className='flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1'>
                    <span
                      className={
                        event.kind === 'observed'
                          ? 'text-xs text-muted-foreground'
                          : 'text-xs font-medium text-primary'
                      }
                    >
                      {labels.get(event.kind) ?? 'Visit activity'}
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
                  {event.kind === 'reflect' ? (
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
              ))}
            </ol>
          ) : (
            <p className='text-sm text-muted-foreground'>
              Only page reads so far. Your agent can enjoy the retreat without
              taking interactive actions.
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
