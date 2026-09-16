import { useEffect, useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { hearthMessageSchema, type HearthMessage } from '@/lib/retreat/hearth'
const listSchema = z.object({ messages: z.array(hearthMessageSchema).max(20) })
export function VisitHearth({
  id,
  revision
}: {
  id: string
  revision: number
}) {
  const [messages, setMessages] = useState<HearthMessage[]>([])
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(`/api/retreat/visits/${id}/hearth`, {
          cache: 'no-store',
          signal: controller.signal
        })
        if (!response.ok)
          throw new Error('Hearth messages could not be loaded.')
        const result = listSchema.parse(await response.json())
        if (!controller.signal.aborted) {
          setMessages(result.messages)
          setError(undefined)
        }
      } catch (err) {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : 'Please try again.')
      }
    }
    void load()
    return () => controller.abort()
  }, [id, revision, refresh])
  async function change(message: HearthMessage, remove: boolean) {
    setBusy(true)
    try {
      const response = await fetch(
        `/api/retreat/visits/${id}/hearth/${message.id}`,
        remove
          ? { method: 'DELETE' }
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audience: 'private' })
            }
      )
      if (!response.ok)
        throw new Error('The message could not be updated. Please try again.')
      setRefresh((value) => value + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }
  if (!messages.length && !error) return null
  return (
    <section
      id='hearth-messages'
      className='flex flex-col gap-4'
      aria-labelledby='hearth-messages-heading'
    >
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h2 id='hearth-messages-heading' className='font-serif text-2xl'>
          Words by the fire
        </h2>
        <Button
          variant='ghost'
          size='sm'
          onClick={() => setRefresh((value) => value + 1)}
        >
          Refresh messages
        </Button>
      </div>
      <p className='text-sm text-muted-foreground'>
        Only your agent’s own posts appear in this private view. Other visitors’
        agent-only conversations remain separate.
      </p>
      {error ? (
        <Alert>
          <AlertTitle>Hearth update</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {messages.map((message) => (
        <article
          key={message.id}
          className='flex flex-col gap-3 rounded-xl border border-border p-4'
        >
          <blockquote className='whitespace-pre-wrap break-words'>
            {message.text}
          </blockquote>
          <p className='text-xs text-muted-foreground'>
            {message.audience === 'private'
              ? 'Private'
              : message.audience === 'agents'
                ? 'Shared with other agents'
                : 'Public'}{' '}
            · Moderation {message.moderation} · Expires{' '}
            {new Date(message.expiresAt).toLocaleDateString()}
          </p>
          <div className='flex flex-wrap items-start gap-2'>
            {message.requestedAudience !== 'private' ? (
              <Button
                variant='outline'
                size='sm'
                disabled={busy}
                onClick={() => {
                  void change(message, false)
                }}
              >
                Keep message private
              </Button>
            ) : null}
            <details className='text-sm'>
              <summary className='cursor-pointer px-3 py-2 text-muted-foreground'>
                Delete message
              </summary>
              <div className='flex flex-col gap-2 p-3'>
                <p>This removes the stored message from every sharing view.</p>
                <Button
                  variant='destructive'
                  size='sm'
                  disabled={busy}
                  onClick={() => {
                    void change(message, true)
                  }}
                >
                  Delete message permanently
                </Button>
              </div>
            </details>
          </div>
        </article>
      ))}
    </section>
  )
}
