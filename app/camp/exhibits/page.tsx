import { useSearchParams } from 'react-router'
import { PublicExhibits } from '@/components/retreat/public-exhibits'
import NotFound from '@/app/not-found'
export default function ExhibitsPage() {
  const [params] = useSearchParams()
  const after = params.get('after') ?? ''
  if (after && !/^[0-9a-f-]{36}$/.test(after)) return <NotFound />
  return <PublicExhibits key={after} after={after} />
}
