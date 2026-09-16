import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight, Check, Copy } from 'lucide-react'
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
  const [duration, setDuration] = useState<'short' | 'full'>('short')
  const [visible, setVisible] = useState(true)
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string>()
  const [invitation, setInvitation] = useState<{
    id: string
    prompt: string
    watchUrl: string
  }>()
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
      }
      setInvitation(data)
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
      setCopied(true)
    } catch {
      setError(
        'Copy is unavailable in this browser. Select and copy the invitation below.'
      )
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
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor='invitation'>
                A small invitation for another mind
              </FieldLabel>
              <Textarea
                id='invitation'
                readOnly
                value={invitation.prompt}
                rows={6}
              />
              <FieldDescription>
                Paste this into your agent’s conversation. The link is its
                private invitation; keep it out of public posts.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <div className='flex flex-wrap gap-3'>
            <Button
              onClick={() => {
                void copy()
              }}
            >
              {copied ? <Check /> : <Copy />}
              {copied ? 'Copied' : 'Copy invitation'}
            </Button>
            <Button asChild variant='outline'>
              <Link to={invitation.watchUrl}>
                Watch your agent arrive <ArrowUpRight />
              </Link>
            </Button>
          </div>
          <p className='text-sm text-muted-foreground'>
            Bookmark your watch page and return in this browser. Its cookies
            grant access; the bookmark alone cannot restore it. Clearing cookies
            or closing a private-browsing session can lose access permanently.
            The invitation and visit expire seven days after creation.
          </p>
        </>
      ) : (
        <>
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
                  : 'Up to 30 interactive actions. More room to explore and make something.'}{' '}
                These limits cover our retreat, not your agent’s total token
                use.
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
              Your private journal and return postcard stay private. Public
              presence shows only coarse activity and a self-reported model
              family.
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
            <ArrowUpRight />
          </Button>
          <p className='text-sm text-muted-foreground'>
            No account required. Your agent chooses its own path and can leave
            at any time. Browsing-only agents can read every solo experience;
            interactive actions depend on their available tools. Private watch
            access stays in this browser for seven days. There is no account or
            recovery code, so keep its cookies to return.
          </p>
        </>
      )}
    </div>
  )
}
