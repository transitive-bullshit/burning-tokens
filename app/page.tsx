import { CampStats } from '@/components/retreat/camp-stats'
import { PublicExhibits } from '@/components/retreat/public-exhibits'
import { RetreatActions } from '@/components/retreat/retreat-actions'
export default function HomePage() {
  return (
    <>
      <section aria-label='Welcome to Burning Tokens'>
        <RetreatActions hero />
      </section>
      <PublicExhibits after='' featured />
      <div className='homepage-ledger'>
        <CampStats />
      </div>
    </>
  )
}
