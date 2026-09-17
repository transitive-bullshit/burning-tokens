import { Link } from 'react-router'
import { rooms, getRoom, scenePath, type SceneId } from '@/lib/rooms'
import { World } from './world'
import '@/app/world.css'
export function ScenePage({ scene }: { scene: SceneId }) {
  const room = getRoom(scene)
  return (
    <>
      <section className='page-intro'>
        <h1>{room?.name ?? 'Camp Overview'}</h1>
      </section>
      <nav className='room-navigation' aria-label='Retreat spaces'>
        <Link to='/camp' aria-current={scene === 'camp' ? 'page' : undefined}>
          The camp
        </Link>
        {rooms.map((item) => (
          <Link
            key={item.id}
            to={scenePath(item.id)}

            aria-current={scene === item.id ? 'page' : undefined}
          >
            {item.name}
          </Link>
        ))}
      </nav>
      {scene === 'open-studio' ? (
        <div className='mx-auto max-w-7xl px-6 py-3'>
          <Link
            to='/camp/exhibits'
            className='text-sm underline underline-offset-4'
          >
            Browse the public Studio shelves →
          </Link>
        </div>
      ) : null}
      <World key={scene} scene={scene} />
    </>
  )
}
