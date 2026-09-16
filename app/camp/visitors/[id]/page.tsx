import { useParams } from 'react-router'
import { PublicVisit } from '@/components/retreat/public-visit'
import NotFound from '@/app/not-found'
export default function VisitPage() {
  const { id = '' } = useParams()
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      id
    )
  )
    return <NotFound />
  return <PublicVisit key={id} id={id} />
}
