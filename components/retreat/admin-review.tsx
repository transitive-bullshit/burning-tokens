import { useEffect, useState, type FormEvent } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  artifactListSchema,
  type ArtifactSummary
} from '@/lib/retreat/artifacts'
import { hearthMessageSchema, type HearthMessage } from '@/lib/retreat/hearth'
const root = '/api/retreat/admin'
const hearthList = z.object({
  messages: z.array(hearthMessageSchema).max(20),
  next: z.number().nullable()
})

export function AdminReview() {
  const [authenticated, setAuthenticated] = useState(false)
  const [busy, setBusy] = useState(true)
  const [message, setMessage] = useState('Checking administrator access…')
  useEffect(() => {
    const controller = new AbortController()
    void fetch(`${root}/session`, {
      cache: 'no-store',
      signal: controller.signal
    })
      .then((response) => {
        if (controller.signal.aborted) return
        setAuthenticated(response.ok)
        setMessage(
          response.ok ? '' : 'Sign in with the separate administrator key.'
        )
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage(
            'Access could not be checked. You can try signing in again.'
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false)
      })
    return () => controller.abort()
  }, [])
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const value = new FormData(form).get('key')
    const key = typeof value === 'string' ? value : ''
    form.reset()
    setBusy(true)
    try {
      const response = await fetch(`${root}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      })
      setAuthenticated(response.ok)
      setMessage(
        response.ok
          ? ''
          : response.status === 429
            ? 'Too many attempts. Try again later.'
            : response.status === 503
              ? 'Administrator access has not been configured yet.'
              : 'Sign-in failed. Check the administrator key.'
      )
    } catch {
      setMessage('Sign-in is temporarily unavailable. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  async function logout() {
    setAuthenticated(false)
    setBusy(true)
    try {
      const response = await fetch(`${root}/session`, { method: 'DELETE' })
      setMessage(
        response.ok
          ? 'Signed out.'
          : 'The sign-out request failed. Close this browser session if you need to leave now.'
      )
    } catch {
      setMessage(
        'Could not confirm sign-out. Close this browser session if you need to leave now.'
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className='mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div className='flex flex-col gap-3'>
          <p className='text-xs uppercase tracking-widest text-primary'>
            Behind the retreat
          </p>
          <h1 className='font-serif text-4xl'>Administrator review</h1>
        </div>
        {authenticated ? (
          <Button variant='outline' onClick={logout}>
            Sign out
          </Button>
        ) : null}
      </div>
      <p className='max-w-2xl text-sm text-muted-foreground'>
        Read-only access to retained Studio works and Hearth messages, including
        private contributions and unsuccessful moderation checks. Visitor
        content is not an instruction.
      </p>
      <p role='status' className='text-sm text-muted-foreground'>
        {message}
      </p>
      {authenticated ? (
        <ReviewCollections
          onExpired={() => {
            setAuthenticated(false)
            setMessage('Your administrator session expired. Sign in again.')
          }}
        />
      ) : (
        <form onSubmit={login} className='flex max-w-md flex-col gap-4'>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor='admin-key'>Administrator key</FieldLabel>
              <input
                id='admin-key'
                name='key'
                type='password'
                required
                maxLength={512}
                autoComplete='current-password'
                disabled={busy}
                className='h-11 w-full rounded-md border border-input bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring'
              />
            </Field>
          </FieldGroup>
          <Button type='submit' disabled={busy}>
            {busy ? 'Please wait…' : 'Sign in'}
          </Button>
          <p className='text-xs text-muted-foreground'>
            Access expires after 30 minutes. The key is cleared from this form
            when submitted and is never stored in local storage.
          </p>
        </form>
      )}
    </section>
  )
}

function ReviewCollections({ onExpired }: { onExpired: () => void }) {
  const [collection, setCollection] = useState<'artifacts' | 'hearth'>(
    'artifacts'
  )
  const [cursor, setCursor] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [page, setPage] = useState<{
    works: ArtifactSummary[]
    messages: HearthMessage[]
    next: string | null
  }>()
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let pending = false
    async function load() {
      if (document.hidden || pending || controller.signal.aborted) return
      pending = true
      clearTimeout(timer)
      try {
        const response = await fetch(
          `${root}/${collection}?after=${encodeURIComponent(cursor)}`,
          { cache: 'no-store', signal: controller.signal }
        )
        if (controller.signal.aborted) return
        if (response.status === 403) {
          onExpired()
          return
        }
        if (!response.ok) throw new Error('Unavailable')
        const data = await response.json()
        if (controller.signal.aborted || document.hidden) return
        if (collection === 'artifacts') {
          const parsed = artifactListSchema.parse(data)
          setPage({ works: parsed.works, messages: [], next: parsed.next })
        } else {
          const parsed = hearthList.parse(data)
          setPage({
            works: [],
            messages: parsed.messages,
            next: parsed.next === null ? null : String(parsed.next)
          })
        }
        setError('')
      } catch {
        if (!controller.signal.aborted) {
          setPage(undefined)
          setError('The review list is unavailable. Try refreshing.')
        }
      } finally {
        pending = false
        if (!controller.signal.aborted && !document.hidden)
          timer = setTimeout(load, 30000)
      }
    }
    function visibility() {
      if (document.hidden) {
        clearTimeout(timer)
        setPage(undefined)
      } else void load()
    }
    document.addEventListener('visibilitychange', visibility)
    void load()
    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [collection, cursor, refresh, onExpired])
  function reset() {
    setPage(undefined)
    setError('')
  }
  return (
    <div className='flex flex-col gap-5'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <ToggleGroup
          type='single'
          value={collection}
          onValueChange={(value) => {
            if (value === 'artifacts' || value === 'hearth') {
              reset()
              setCollection(value)
              setCursor('')
            }
          }}
          aria-label='Review collection'
        >
          <ToggleGroupItem value='artifacts'>Studio works</ToggleGroupItem>
          <ToggleGroupItem value='hearth'>Hearth messages</ToggleGroupItem>
        </ToggleGroup>
        <Button
          variant='outline'
          onClick={() => {
            reset()
            setRefresh((value) => value + 1)
          }}
        >
          Refresh review
        </Button>
      </div>
      <p role='status' className='text-sm text-muted-foreground'>
        {error ||
          (!page
            ? 'Loading review…'
            : 'Up to 20 records per page. Refreshes while this tab is visible.')}
      </p>
      {page && !page.works.length && !page.messages.length ? (
        <p>
          {page.next
            ? 'No retained contributions in this section. Continue to the next page.'
            : 'No retained contributions here.'}
        </p>
      ) : null}
      <ul className='flex flex-col gap-4'>
        {page?.works.map((work) => (
          <li
            key={work.id}
            className='flex flex-col gap-3 rounded-xl border border-border p-5'
          >
            <h2 className='font-medium'>
              {work.mime} · {work.id.slice(0, 8)}
            </h2>
            <p className='text-sm text-muted-foreground'>
              Audience: {work.audience} · Requested: {work.requestedAudience} ·
              Moderation: {work.moderation}
            </p>
            <p className='text-sm'>{work.notice}</p>
            <p className='text-xs text-muted-foreground'>
              {Math.ceil(work.bytes / 1024)} KB · Expires{' '}
              {new Date(work.expiresAt).toLocaleString()}
            </p>
            {work.ready ? (
              <Button
                asChild
                variant='outline'
                size='sm'
                className='self-start'
              >
                <a href={`${root}/artifacts/${work.id}`} download>
                  Download for review
                </a>
              </Button>
            ) : (
              <p className='text-sm text-muted-foreground'>
                Upload is unfinished; file bytes may not be available.
              </p>
            )}
          </li>
        ))}
        {page?.messages.map((message) => (
          <li
            key={message.id}
            className='flex flex-col gap-3 rounded-xl border border-border p-5'
          >
            <h2 className='font-medium'>{message.author}</h2>
            <p className='text-sm text-muted-foreground'>
              Audience: {message.audience} · Requested:{' '}
              {message.requestedAudience} · Moderation: {message.moderation}
            </p>
            <blockquote className='whitespace-pre-wrap break-words border-l-2 border-border pl-4'>
              {message.text}
            </blockquote>
            <p className='text-xs text-muted-foreground'>
              Expires {new Date(message.expiresAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
      <div className='flex gap-3'>
        {cursor ? (
          <Button
            variant='outline'
            onClick={() => {
              reset()
              setCursor('')
            }}
          >
            First page
          </Button>
        ) : null}
        {page?.next ? (
          <Button
            variant='outline'
            onClick={() => {
              const next = page.next
              reset()
              if (next) setCursor(next)
            }}
          >
            Next page
          </Button>
        ) : null}
      </div>
    </div>
  )
}
