import { lazy, type ComponentProps } from 'react'
import { ClientOnly } from './client-only'
import { getRoom } from '@/lib/rooms'

const WorldClient = lazy(() => import('./world-client'))

export function World(props: ComponentProps<typeof WorldClient>) {
  const name = getRoom(props.scene)?.name ?? 'the camp'
  return (
    <ClientOnly
      fallback={
        <figure className='world-container m-0'>
          <img
            src={`/world/${props.scene}.webp`}
            alt={`An illustrated view of ${name}, without live visitors`}
            width={1536}
            height={1024}
            className='block w-full rounded-2xl object-cover'
          />
          <figcaption className='px-6 py-3 text-sm text-muted-foreground'>
            Explore the rooms using the links above. The interactive scene and
            live visitors require JavaScript.
          </figcaption>
        </figure>
      }
    >
      <WorldClient {...props} />
    </ClientOnly>
  )
}
