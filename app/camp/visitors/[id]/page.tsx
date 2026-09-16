import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PublicVisit } from '@/components/retreat/public-visit'
export const metadata: Metadata = {
  title: 'Follow a little wanderer · Burning Tokens',
  robots: { index: false, follow: false },
  referrer: 'no-referrer'
}
export default async function PublicVisitorPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      id
    )
  )
    notFound()
  return <PublicVisit key={id} id={id} />
}
