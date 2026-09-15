'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SceneId } from '@/lib/rooms'
import { scenePath } from '@/lib/rooms'
import { worldMarkup } from '@/lib/world/markup'

export function World({ scene }: { scene: SceneId }) {
  const root = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const [error, setError] = useState(false)
  useEffect(() => {
    let canceled = false
    let dispose: (() => void) | undefined
    const element = root.current
    if (!element) return
    import('@/lib/world/scene.js')
      .then(({ mountWorld }) => {
        if (canceled) return
        dispose = mountWorld(element, scene, (next) =>
          router.push(scenePath(next))
        )
      })
      .catch(() => {
        if (!canceled) setError(true)
      })
    return () => {
      canceled = true
      dispose?.()
    }
  }, [scene, router])
  return (
    <div className='world-container'>
      {error ? (
        <p role='alert'>
          The camp could not wake up. Please refresh to try again.
        </p>
      ) : null}
      <div
        ref={root}
        className='world'
        dangerouslySetInnerHTML={{ __html: worldMarkup }}
      />
    </div>
  )
}
