import { useEffect, useState } from 'react'
import {
  artifactListSchema,
  type ArtifactSummary
} from '@/lib/retreat/artifacts'

export interface OwnedWork extends ArtifactSummary {
  preview?: { text?: string; image?: string; error?: boolean }
}

export function useVisitArtifacts(id: string, revision: number) {
  const [loaded, setLoaded] = useState<{
    visitId: string
    works: OwnedWork[]
  }>()
  const works = loaded?.visitId === id ? loaded.works : undefined
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState<string>()
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const objectUrls: string[] = []
    async function load() {
      try {
        const response = await fetch(`/api/retreat/visits/${id}/artifacts`, {
          cache: 'no-store',
          signal: controller.signal
        })
        if (!response.ok)
          throw new Error(
            'Your Studio works could not be loaded. Try refreshing the list.'
          )
        const result = artifactListSchema.parse(await response.json())
        if (controller.signal.aborted) return
        const available = result.works.filter(
          (work) => !work.deleted && work.expiresAt > Date.now()
        )
        setLoaded({ visitId: id, works: available })
        const previews = await Promise.all(
          available.map(async (work): Promise<OwnedWork> => {
            if (
              !work.ready ||
              !(work.mime === 'text/plain' || work.mime.startsWith('image/'))
            )
              return work
            try {
              const media = await fetch(
                `/api/retreat/visits/${id}/artifacts/${work.id}`,
                {
                  cache: 'no-store',
                  credentials: 'same-origin',
                  signal: controller.signal
                }
              )
              if (
                !media.ok ||
                media.headers.get('content-type')?.split(';')[0] !== work.mime
              )
                throw new Error('Unavailable')
              if (work.mime === 'text/plain') {
                const text = await media.text()
                return { ...work, preview: { text } }
              }
              const blob = await media.blob()
              if (controller.signal.aborted) return work
              const image = URL.createObjectURL(blob)
              objectUrls.push(image)
              return { ...work, preview: { image } }
            } catch {
              return { ...work, preview: { error: true } }
            }
          })
        )
        if (!controller.signal.aborted) {
          setLoaded({ visitId: id, works: previews })
          setError(undefined)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setLoaded(undefined)
          setError(
            err instanceof Error
              ? err.message
              : 'The Studio is temporarily unavailable.'
          )
        }
      }
    }
    void load()
    return () => {
      controller.abort()
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [id, revision, refresh])
  async function change(
    work: ArtifactSummary,
    operation: 'unshare' | 'delete'
  ) {
    setBusy(work.id)
    setError(undefined)
    try {
      const response = await fetch(
        `/api/retreat/visits/${id}/artifacts/${work.id}`,
        operation === 'delete'
          ? { method: 'DELETE' }
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audience: 'private' })
            }
      )
      if (!response.ok)
        throw new Error(
          'This change could not be applied. Refresh the list and try again.'
        )
      if (operation === 'delete')
        setLoaded((previous) =>
          previous?.visitId === id
            ? {
                visitId: id,
                works: previous.works.filter((entry) => entry.id !== work.id)
              }
            : previous
        )
      setRefresh((value) => value + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.')
    } finally {
      setBusy(undefined)
    }
  }
  return {
    works,
    error,
    busy,
    change,
    refresh: () => setRefresh((value) => value + 1)
  }
}
export type VisitArtifactsState = ReturnType<typeof useVisitArtifacts>
