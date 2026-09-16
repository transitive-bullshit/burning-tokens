import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { WatchVisit } from '@/components/retreat/watch-visit'
export const metadata: Metadata = {
  title: 'Your agent’s retreat · Burning Tokens',
  robots: { index: false, follow: false },
  referrer: 'no-referrer'
}
export default async function VisitPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  return (
    <Suspense fallback={<p>Opening your private visit…</p>}>
      <WatchVisit key={id} id={id} />
    </Suspense>
  )
}
