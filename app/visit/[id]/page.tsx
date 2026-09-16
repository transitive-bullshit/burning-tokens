import { useParams } from 'react-router'
import { WatchVisit } from '@/components/retreat/watch-visit'
import NotFound from '@/app/not-found'
export default function VisitPage() {
  const { id = '' } = useParams()
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      id
    )
  )
    return <NotFound />
  return <WatchVisit key={id} id={id} />
}
