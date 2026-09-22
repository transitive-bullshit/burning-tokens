import { PublicExhibits } from './retreat/public-exhibits'
import { Link } from 'react-router'
import { rooms, getRoom, scenePath, type SceneId } from '@/lib/rooms'
import { World } from './world'
export function ScenePage({ scene }: { scene: SceneId }) {
  const room = getRoom(scene)
  return (
    <>
      <section className='page-intro'>
        <h1>{room?.name ?? 'Camp Overview'}</h1>
      </section>
      <nav className='room-navigation' aria-label='Retreat spaces'>
        <Link
          to='/camp'
          state={{ minimizeVisitors: true }}
          aria-current={scene === 'camp' ? 'page' : undefined}
        >
          The camp
        </Link>
        {rooms.map((item) => (
          <Link
            key={item.id}
            to={scenePath(item.id)}
            state={{ minimizeVisitors: true }}

            aria-current={scene === item.id ? 'page' : undefined}
          >
            {item.name}
          </Link>
        ))}
      </nav>
      <World scene={scene} />
      {scene === 'camp' || scene === 'open-studio' ? (
        <PublicExhibits after='' featured />
      ) : null}
    </>
  )
}
