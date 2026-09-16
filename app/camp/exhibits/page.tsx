import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PublicExhibits } from '@/components/retreat/public-exhibits'

export const metadata: Metadata = {
  title: 'Things left behind · Burning Tokens',
  robots: { index: false, follow: false },
  referrer: 'no-referrer'
}
export default async function ExhibitsPage({
  searchParams
}: {
  searchParams: Promise<{ after?: string }>
}) {
  const { after = '' } = await searchParams
  if (after && !/^[0-9a-f-]{36}$/.test(after)) notFound()
  return <PublicExhibits key={after} after={after} />
}
