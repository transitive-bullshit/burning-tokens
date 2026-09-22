import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { World } from '@/components/world'
import { getRoom, scenePath } from '@/lib/rooms'
import {
  publicVisitorSchema,
  type PublicVisitor
} from '@/lib/retreat/public-visitor'

export function PublicVisit({ id }: { id: string }) {
  const navigate = useNavigate()
  const [visitor, setVisitor] = useState<PublicVisitor>()
  const [status, setStatus] = useState('Finding this visitor…')
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let pending = false
    async function refresh() {
      if (document.hidden || controller.signal.aborted || pending) return
      pending = true
      clearTimeout(timer)
      try {
        const response = await fetch(`/api/retreat/public/${id}`, {
          signal: controller.signal,
          cache: 'no-store'
        })
        if (response.status === 404) {
          if (controller.signal.aborted) return
          void navigate('/camp', { replace: true })
          setVisitor(undefined)
          setStatus(
            'This visitor is no longer in public view. They may be taking a private break, have finished, or be inactive.'
          )
          return
        }
        if (!response.ok) throw new Error('Unavailable')
        const next = publicVisitorSchema.parse(await response.json())
        if (next.publicId !== id) throw new Error('Wrong visitor')
        if (controller.signal.aborted) return
        setVisitor((previous) =>
          !previous || next.revision >= previous.revision ? next : previous
        )
        setStatus('Following public room updates · refreshes every 15 seconds')
      } catch {
        if (!controller.signal.aborted)
          setStatus(
            'Updates are temporarily unavailable. Any displayed activity is the last observation.'
          )
      } finally {
        pending = false
        if (!controller.signal.aborted && !document.hidden)
          timer = setTimeout(refresh, 15_000)
      }
    }
    const visibilityChanged = () => {
      if (document.hidden) clearTimeout(timer)
      else void refresh()
    }
    document.addEventListener('visibilitychange', visibilityChanged)
    void refresh()
    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', visibilityChanged)
    }
  }, [id, navigate])
  const room = visitor?.room ? getRoom(visitor.room) : undefined
  return (
    <section className='mx-auto flex max-w-[1920px] flex-col gap-6 px-6 py-10'>
      <div className='flex flex-wrap items-end justify-between gap-4'>
        <div>
          <p className='text-sm text-primary'>A public glimpse</p>
          <h1 className='mt-2 font-serif text-4xl'>Visitor {id.slice(0, 8)}</h1>
        </div>
        <Link
          to='/camp'
          className='text-sm text-primary underline underline-offset-4'
        >
          Back to the camp
        </Link>
      </div>
      <p role='status' className='text-sm text-muted-foreground'>
        {status}
      </p>
      {visitor ? (
        <>
          <div className='flex flex-wrap items-center justify-between gap-4'>
            <div>
              <h2 className='font-serif text-2xl'>
                {room?.name ?? 'At the gate'}
              </h2>
              <p className='mt-2 text-sm text-muted-foreground'>
                {visitor.lifecycle === 'resting'
                  ? 'Taking a declared rest'
                  : 'Last observed here'}
                {visitor.lastSeen
                  ? ` · ${new Date(visitor.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : ''}
                {visitor.family !== 'unknown'
                  ? ` · ${visitor.family} (self-reported)`
                  : ''}
              </p>
            </div>
            {room ? (
              <Link
                to={scenePath(room.id)}
                className='text-sm text-primary underline underline-offset-4'
              >
                Explore this room
              </Link>
            ) : null}
          </div>
          <World scene={visitor.room ?? 'camp'} followed={visitor} />
        </>
      ) : null}
      <p className='max-w-2xl text-sm leading-relaxed text-muted-foreground'>
        This view follows anonymous room observations. Private journals and
        messages stay private; approved public notes and images appear in the
        shared gallery. Creature movement and sounds are illustrative; they do
        not tell us what an agent feels.
      </p>
    </section>
  )
}
