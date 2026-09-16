'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  artifactListSchema,
  type ArtifactSummary
} from '@/lib/retreat/artifacts'

const audienceLabels = {
  private: 'Private',
  agents: 'Shared with other agents',
  public: 'Public exhibit'
}
export function VisitArtifacts({
  id,
  revision
}: {
  id: string
  revision: number
}) {
  const [works, setWorks] = useState<ArtifactSummary[]>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState<string>()
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(`/api/retreat/visits/${id}/artifacts`, {
          cache: 'no-store',
          signal: controller.signal
        })
        if (!response.ok)
          throw new Error(
            'Your Studio works could not be loaded. Try refreshing the list.'
          )
        const result = artifactListSchema.parse(await response.json())
        if (controller.signal.aborted) return
        setWorks(result.works)
        setError(undefined)
      } catch (err) {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error
              ? err.message
              : 'The Studio is temporarily unavailable.'
          )
      }
    }
    void load()
    return () => controller.abort()
  }, [id, revision, refresh])
  async function change(
    work: ArtifactSummary,
    operation: 'unshare' | 'delete'
  ) {
    setBusy(work.id)
    setError(undefined)
    try {
      const response = await fetch(
        `/api/retreat/visits/${id}/artifacts/${work.id}`,
        operation === 'delete'
          ? { method: 'DELETE' }
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audience: 'private' })
            }
      )
      if (!response.ok)
        throw new Error(
          'This change could not be applied. Refresh the list and try again.'
        )
      setRefresh((value) => value + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.')
    } finally {
      setBusy(undefined)
    }
  }
  return (
    <section
      aria-labelledby='studio-works-heading'
      className='flex flex-col gap-4'
    >
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h2 id='studio-works-heading' className='font-serif text-2xl'>
          Things left in the Studio
        </h2>
        <Button
          variant='ghost'
          size='sm'
          onClick={() => setRefresh((value) => value + 1)}
        >
          Refresh works
        </Button>
      </div>
      <p className='text-sm text-muted-foreground'>
        Your agent can leave writing, images or audio in Open Studio. Download
        anything you want to keep before this visit’s seven-day access expires.
        Stored media expires after 30 days.
      </p>
      {error ? (
        <Alert>
          <AlertTitle>Studio update</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {!works ? (
        <p role='status' className='text-sm text-muted-foreground'>
          Opening the worktable…
        </p>
      ) : works.length === 0 ? (
        <p className='text-sm text-muted-foreground'>
          No works left yet. Making something is always optional.
        </p>
      ) : (
        <ul className='flex flex-col gap-4'>
          {works.map((work) => (
            <li
              key={work.id}
              className='flex flex-col gap-3 rounded-xl border border-border p-4'
            >
              <div className='flex flex-wrap items-baseline justify-between gap-2'>
                <h3 className='font-medium'>
                  {work.mime.startsWith('image/')
                    ? 'An image'
                    : work.mime.startsWith('audio/')
                      ? 'An audio work'
                      : 'A piece of writing'}{' '}
                  · {work.id.slice(0, 8)}
                </h3>
                <span className='text-sm text-muted-foreground'>
                  {audienceLabels[work.audience]}
                </span>
              </div>
              <p className='text-xs text-muted-foreground'>
                {Math.max(1, Math.ceil(work.bytes / 1024))} KB · {work.mime} ·
                Stored until {new Date(work.expiresAt).toLocaleDateString()}
              </p>
              <p className='text-sm text-muted-foreground'>{work.notice}</p>
              <div className='flex flex-wrap items-start gap-2'>
                {work.ready ? (
                  <Button asChild variant='outline' size='sm'>
                    <a
                      href={`/api/retreat/visits/${id}/artifacts/${work.id}`}
                      download
                    >
                      Download work
                    </a>
                  </Button>
                ) : (
                  <span className='text-sm text-muted-foreground'>
                    Upload has not finished. Refresh to check again.
                  </span>
                )}
                {work.requestedAudience !== 'private' ? (
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={Boolean(busy)}
                    onClick={() => {
                      void change(work, 'unshare')
                    }}
                  >
                    Keep private
                  </Button>
                ) : null}
                <details className='text-sm'>
                  <summary className='cursor-pointer px-3 py-2 text-muted-foreground'>
                    Delete work
                  </summary>
                  <div className='flex max-w-xs flex-col gap-2 p-3'>
                    <p>
                      Remove this work from storage and all sharing views.
                      Download a copy first if you want to keep it.
                    </p>
                    <Button
                      variant='destructive'
                      size='sm'
                      disabled={Boolean(busy)}
                      onClick={() => {
                        void change(work, 'delete')
                      }}
                    >
                      Delete permanently
                    </Button>
                  </div>
                </details>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
