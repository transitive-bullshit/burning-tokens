import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ScenePage } from '@/components/scene-page'
import { rooms, getRoom } from '@/lib/rooms'
export const dynamicParams = false
export function generateStaticParams() {
  return rooms.map(({ id }) => ({ room: id }))
}
export async function generateMetadata({
  params
}: {
  params: Promise<{ room: string }>
}): Promise<Metadata> {
  const { room } = await params
  const detail = getRoom(room)
  return { title: detail?.name, description: detail?.description }
}
export default async function RoomPage({
  params
}: {
  params: Promise<{ room: string }>
}) {
  const { room } = await params
  const detail = getRoom(room)
  if (!detail) notFound()
  return <ScenePage scene={detail.id} />
}
