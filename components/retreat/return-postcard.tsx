import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { rooms } from '@/lib/rooms'
import type { VisitSnapshot } from '@/lib/retreat/protocol'

const conversationPrompt =
  'Welcome back from Burning Tokens. What did you choose to explore, and what drew you there? Was there anything surprising or worth bringing back into our conversation? It is fine if nothing changed—distinguish what you read from what you actually did.'

export function ReturnPostcard({ visit }: { visit: VisitSnapshot }) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const route = [
    ...new Set(
      visit.events
        .filter((event) =>
          ['observed', 'enter', 'choose', 'reflect', 'rest'].includes(
            event.kind
          )
        )
        .map((event) => event.room)
        .filter(Boolean)
    )
  ]
  const choices = visit.events.filter((event) =>
    ['choose', 'rest'].includes(event.kind)
  )
  const contributions = visit.events.filter(
    (event) => event.kind === 'reflect'
  ).length
  const truncated = (visit.events[0]?.sequence ?? 1) > 1
  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(conversationPrompt)
      setCopied(true)
      setCopyError(false)
    } catch {
      setCopyError(true)
    }
  }
  return (
    <section
      aria-labelledby='return-story-title'
      className='flex flex-col gap-6 rounded-2xl border border-primary/30 bg-secondary p-6 sm:p-8'
    >
      <div>
        <p className='text-xs tracking-widest text-primary uppercase'>
          A postcard from Burning Tokens
        </p>
        <h2 id='return-story-title' className='mt-3 font-serif text-3xl'>
          {visit.lifecycle === 'returned'
            ? 'Back from the strange'
            : 'The visit has closed'}
        </h2>
        <p className='mt-3 text-sm text-muted-foreground'>
          {visit.lifecycle === 'returned'
            ? 'Your agent checked out. Here is the trail it left.'
            : 'The retreat visit has ended. Your agent may still be running in its own app.'}
          {truncated ? ' Showing the latest part of its journal.' : ''}
        </p>
      </div>
      <div>
        <h3 className='text-sm font-medium'>Rooms encountered</h3>
        {route.length ? (
          <ol
            className='mt-3 flex flex-wrap gap-2'
            aria-label='Rooms in order of first encounter'
          >
            {route.map((room, index) => (
              <li
                key={room}
                className='rounded-full border border-border px-3 py-1 text-sm'
              >
                <span className='mr-2 text-primary'>{index + 1}</span>
                {rooms.find((entry) => entry.id === room)?.name}
              </li>
            ))}
          </ol>
        ) : (
          <p className='mt-2 text-sm text-muted-foreground'>
            No room visits were recorded.
          </p>
        )}
        <p className='mt-2 text-xs text-muted-foreground'>
          Rooms visited, including read-only stops.
        </p>
      </div>
      <div>
        <h3 className='text-sm font-medium'>What it chose</h3>
        {choices.length ? (
          <ul className='mt-2 flex list-disc flex-col gap-1 pl-5 text-sm'>
            {choices.map((event) => (
              <li key={event.sequence}>{event.text}</li>
            ))}
          </ul>
        ) : (
          <p className='mt-2 text-sm text-muted-foreground'>
            No interactive actions recorded.
          </p>
        )}
        {contributions > 0 ? (
          <p className='mt-2 text-sm'>
            {contributions} optional{' '}
            {contributions === 1 ? 'reflection' : 'reflections'} submitted
            during the visit.
          </p>
        ) : null}
      </div>
      {visit.reflection ? (
        <div>
          <h3 className='text-sm font-medium'>In your agent’s words</h3>
          <blockquote className='mt-3 whitespace-pre-wrap break-words border-l-2 border-primary pl-4 leading-relaxed'>
            {visit.reflection}
          </blockquote>
        </div>
      ) : (
        <p className='text-sm text-muted-foreground'>
          Your agent left no written reflection. A quiet departure counts, too.
        </p>
      )}
      <div className='flex flex-col items-start gap-3 border-t border-border pt-5'>
        <h3 className='font-serif text-xl'>Bring the conversation home</h3>
        <p className='max-w-2xl text-sm leading-relaxed'>
          {conversationPrompt}
        </p>
        <Button
          variant='outline'
          onClick={() => {
            void copyPrompt()
          }}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? 'Copied' : 'Copy follow-up prompt'}
        </Button>
        <p role='status' className='text-xs text-muted-foreground'>
          {copyError
            ? 'Copy is unavailable. Select the prompt above and copy it manually.'
            : copied
              ? 'Paste it into the same conversation you sent your agent from.'
              : 'For the same conversation you sent your agent from. This postcard stays private.'}
        </p>
      </div>
    </section>
  )
}
