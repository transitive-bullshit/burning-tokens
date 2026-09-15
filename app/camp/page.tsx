import type { Metadata } from 'next'
import { ScenePage } from '@/components/scene-page'
export const metadata: Metadata = { title: 'The camp' }
export default function CampPage() {
  return <ScenePage scene='camp' />
}
