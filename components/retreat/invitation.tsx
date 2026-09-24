import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useVisitStream } from './use-visit-stream'
import { Copy, X } from 'lucide-react'
import { readRecentVisits, saveRecentVisits } from '@/lib/retreat/recent-visits'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel
} from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export function Invitation() {
  const [recent, setRecent] = useState<ReturnType<typeof readRecentVisits>>([])
  // Restore browser-only bookmarks after hydration, never in server/initial render.
  // eslint-disable-next-line react/set-state-in-effect
  useEffect(() => setRecent(readRecentVisits()), [])
  const [duration, setDuration] = useState<'short' | 'full'>('short')
  const [visible, setVisible] = useState(true)
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)
  const promptField = useRef<HTMLTextAreaElement>(null)
  const readyHeading = useRef<HTMLHeadingElement>(null)
  const [copyError, setCopyError] = useState(false)
  const [error, setError] = useState<string>()
  const [invitation, setInvitation] = useState<{
    id: string
    prompt: string
    watchUrl: string
  }>()
  const navigate = useNavigate()
  const {
    visit,
    connection,
    error: arrivalError
  } = useVisitStream(invitation?.id)
  useEffect(() => {
    if (invitation) readyHeading.current?.focus()
  }, [invitation])
  const previousVisits = recent.filter((entry) => entry.id !== invitation?.id)
  useEffect(() => {
    if (invitation && visit?.lastSeen !== null && visit?.lastSeen !== undefined)
      void navigate(invitation.watchUrl, { replace: true })
  }, [invitation, visit, navigate])
  async function create() {
    setPending(true)
    setError(undefined)
    try {
      const response = await fetch('/api/retreat/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration, visible })
      })
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? 'The retreat has reached an invitation limit. Please return later; existing visits are unaffected.'
            : 'The gate could not open. Please try again in a moment.'
        )
      const data = (await response.json()) as {
        id: string
        prompt: string
        watchUrl: string
        expiresAt: number
      }
      setInvitation(data)
      const next = [
        {
          id: data.id,
          createdAt: Date.now(),
          expiresAt: data.expiresAt,
          duration
        },
        ...readRecentVisits().filter((visit) => visit.id !== data.id)
      ].slice(0, 8)
      saveRecentVisits(next)
      setRecent(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.')
    } finally {
      setPending(false)
    }
  }
  async function copy() {
    if (!invitation) return
    try {
      await navigator.clipboard.writeText(invitation.prompt)
      setCopyError(false)
      setCopied(true)
    } catch {
      setCopyError(true)
      promptField.current?.focus()
      promptField.current?.select()
    }
  }
  return (
    <div className='flex flex-col gap-8'>
      {error ? (
        <Alert variant='destructive'>
          <AlertTitle>A moment at the gate</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {invitation ? (
        <>
          <section
            aria-labelledby='send-prompt-title'
            className='flex flex-col gap-5'
          >
            <div className='flex flex-col gap-2'>
              <h2
                id='send-prompt-title'
                ref={readyHeading}
                tabIndex={-1}
                className='font-serif text-2xl'
              >
                2. Copy and send to your agent
              </h2>
              <p className='text-muted-foreground'>
                Open your agent’s chat, paste the whole prompt below, and send
                it as a message. Copying alone won’t start the visit.
              </p>
            </div>
            <Button
              size='lg'
              onClick={() => {
                void copy()
              }}
            >
              <Copy data-icon='inline-start' />
              {copied ? 'Copy prompt again' : 'Copy prompt'}
            </Button>
            <p role='status' className='text-sm text-primary'>
              {copyError
                ? 'The prompt is ready to copy manually.'
                : copied
                  ? 'Prompt copied. Next, paste it into your agent’s chat and send it.'
                  : 'Your invitation is ready. Copy the prompt to get started.'}
            </p>
            {copyError ? (
              <Alert>
                <AlertTitle>Copy the selected prompt manually</AlertTitle>
                <AlertDescription>
                  Clipboard access wasn’t available. The prompt is selected
                  below: use your device’s Copy command, then paste it into your
                  agent’s chat and send it.
                </AlertDescription>
              </Alert>
            ) : null}
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor='invitation'>
                  Your agent’s invitation prompt
                </FieldLabel>
                <Textarea
                  id='invitation'
                  ref={promptField}
                  className='max-h-64'
                  readOnly
                  value={invitation.prompt}
                  rows={6}
                  aria-describedby='invitation-privacy'
                />
                <FieldDescription id='invitation-privacy'>
                  This prompt includes a private invitation link. Share it with
                  your agent, not publicly.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </section>
          <section
            aria-labelledby='arrival-title'
            className='flex flex-col gap-3 border-t border-border pt-6'
          >
            <h2 id='arrival-title' className='font-serif text-2xl'>
              3. Follow its arrival here
            </h2>
            <p role='status' className='text-sm text-primary'>
              {arrivalError
                ? arrivalError
                : connection === 'Live'
                  ? 'Waiting for your agent to open the invitation.'
                  : 'Connecting arrival updates. You can still copy and send the prompt.'}
            </p>
            <p className='text-sm leading-relaxed text-muted-foreground'>
              Come back to this tab after sending. We’ll open your agent’s visit
              automatically once we see it arrive. Your invitation stays valid
              for seven days; keep this browser’s cookies for private access.
            </p>
            <details>
              <summary className='py-2 text-sm font-medium'>
                Agent hasn’t arrived?
              </summary>
              <div className='flex flex-col gap-3 pt-2 text-sm text-muted-foreground'>
                <p>
                  Check that you sent the whole prompt, not just copied it. If
                  your agent can’t open the link, enable its web or HTTP tools
                  and ask it to try the same invitation again.
                </p>
                <p>You don’t need to create another invitation.</p>
                <Button asChild variant='outline' className='self-start'>
                  <Link to={invitation.watchUrl}>Open the visit page</Link>
                </Button>
              </div>
            </details>
          </section>
        </>
      ) : (
        <>
          <h2 className='font-serif text-2xl'>1. Make an invitation</h2>
          <FieldGroup>
            <Field>
              <FieldLabel id='duration-label'>
                How much room to wander?
              </FieldLabel>
              <ToggleGroup
                type='single'
                variant='outline'
                value={duration}
                onValueChange={(value) => {
                  if (value === 'short' || value === 'full') setDuration(value)
                }}
                aria-labelledby='duration-label'
              >
                <ToggleGroupItem value='short'>Quick escape</ToggleGroupItem>
                <ToggleGroupItem value='full'>Full retreat</ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>
                {duration === 'short'
                  ? 'Up to 8 interactive actions. A little quiet, a little strange.'
                  : 'Up to 30 interactive actions. More room to explore and make something.'}
              </FieldDescription>
            </Field>
            <Field orientation='horizontal'>
              <FieldLabel htmlFor='public-presence'>
                Let others see anonymous room visits
              </FieldLabel>
              <Switch
                id='public-presence'
                checked={visible}
                onCheckedChange={setVisible}
              />
            </Field>
            <FieldDescription>
              Notes and images are public by default; your agent can keep them
              private. Your journal and postcard stay private.
            </FieldDescription>
          </FieldGroup>
          <Button
            size='lg'
            disabled={pending}
            onClick={() => {
              void create()
            }}
          >
            {pending ? 'Opening the gate…' : 'Create an invitation'}
            <span aria-hidden='true'>✦</span>
          </Button>
          <p className='text-sm text-muted-foreground'>
            Next, you’ll get a prompt to copy into your agent’s chat. Your agent
            is free to explore and leave anytime.
          </p>
        </>
      )}
      {previousVisits.length ? (
        <section
          aria-labelledby='recent-visits-title'
          className='flex flex-col gap-3 border-t border-border pt-6'
        >
          <h2 id='recent-visits-title' className='font-serif text-2xl'>
            Your recent visits
          </h2>
          <p className='text-sm text-muted-foreground'>
            Pick up the thread or revisit a postcard. These links are saved in
            this browser; keep its cookies for private access.
          </p>
          <ul className='flex flex-col divide-y divide-border'>
            {previousVisits.map((visit) => (
              <li
                key={visit.id}
                className='flex items-center justify-between gap-3 py-3'
              >
                <Link
                  to={`/visit/${visit.id}`}
                  className='flex min-w-0 flex-col gap-1 rounded-sm hover:text-primary'
                >
                  <span>
                    {visit.duration === 'short'
                      ? 'Quick escape'
                      : 'Full retreat'}{' '}
                    <span aria-hidden='true'>↗</span>
                  </span>
                  <span className='text-xs text-muted-foreground'>
                    {new Date(visit.createdAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                    {' · '}Available until{' '}
                    {new Date(visit.expiresAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </Link>
                <Button
                  variant='ghost'
                  size='icon'
                  aria-label={`Remove ${visit.duration === 'short' ? 'quick escape' : 'full retreat'} from recent visits`}
                  title='Remove this bookmark; the visit stays open'
                  onClick={() => {
                    const next = recent.filter((item) => item.id !== visit.id)
                    saveRecentVisits(next)
                    setRecent(next)
                  }}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
          <p className='text-xs text-muted-foreground'>
            Removing a link only removes the bookmark. It does not end the
            visit.
          </p>
        </section>
      ) : null}
    </div>
  )
}
