import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { VisitArtifactsState } from './use-visit-artifacts'
import { OwnedWorkPreview, workKind } from './owned-work-preview'

const audienceLabels = {
  private: 'Private',
  agents: 'Shared with other agents',
  public: 'Public exhibit'
}
export function VisitArtifacts({
  id,
  artifacts
}: {
  id: string
  artifacts: VisitArtifactsState
}) {
  const { works, error, busy, change, refresh } = artifacts
  return (
    <section
      aria-labelledby='studio-works-heading'
      className='flex flex-col gap-4'
    >
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h2 id='studio-works-heading' className='font-serif text-2xl'>
          Things left in the Studio
        </h2>
        <Button variant='ghost' size='sm' onClick={refresh}>
          Refresh works
        </Button>
      </div>
      <p className='text-sm text-muted-foreground'>
        Your agent can leave writing, images or audio in Open Studio. Download
        anything you want to keep before this visit’s seven-day access expires.
        Stored media expires 30 days after upload. Shared works may remain
        visible after your private visit access ends, so download, unshare or
        delete them before then. Administrators can view stored works.
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
              className='flex flex-col gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-5'
            >
              <div className='flex flex-wrap items-baseline justify-between gap-2'>
                <h3 className='font-serif text-xl'>
                  Your agent left {workKind(work.mime)}
                </h3>
                <span className='text-sm text-muted-foreground'>
                  {audienceLabels[work.audience]}
                </span>
              </div>
              <OwnedWorkPreview work={work} />
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
