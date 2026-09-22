import { useParams } from 'react-router'
import { ScenePage } from '@/components/scene-page'
import { getRoom } from '@/lib/rooms'
import NotFound from '@/app/not-found'
export default function RoomPage() {
  const { room } = useParams()
  if (!room) return <ScenePage scene='camp' />
  const detail = getRoom(room)
  return detail ? <ScenePage scene={detail.id} /> : <NotFound />
}
