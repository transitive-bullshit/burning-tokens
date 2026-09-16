import type { Metadata } from 'next'
import { AdminReview } from '@/components/retreat/admin-review'
export const metadata: Metadata = {
  title: 'Administrator review · Burning Tokens',
  robots: { index: false, follow: false },
  referrer: 'no-referrer'
}
export default function AdminPage() {
  return <AdminReview />
}
