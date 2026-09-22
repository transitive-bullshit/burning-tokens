import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applyVisitFrame,
  MAX_VISIT_FRAME_BYTES,
  type VisitFrame
} from '@/lib/retreat/visit-stream'
import type { VisitSnapshot } from '@/lib/retreat/protocol'

/** Shared owner stream for the invitation handoff and the live watch page. */
export function useVisitStream(id?: string) {
  const [visit, setVisit] = useState<VisitSnapshot>()
  const [connection, setConnection] = useState('Connecting…')
  const [error, setError] = useState<string>()
  const latest = useRef<VisitSnapshot | undefined>(undefined)
  const acceptVisit = useCallback(
    (next: VisitSnapshot) => {
      if (next.id === id && next.revision >= (latest.current?.revision ?? -1)) {
        latest.current = next
        setVisit(next)
      }
    },
    [id]
  )
  useEffect(() => {
    if (!id) return
    latest.current = undefined
    const controller = new AbortController()
    let socket: WebSocket | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    let stopped = false
    let connecting = false
    let unavailable = false
    const accept = (next: VisitSnapshot) => {
      if (!stopped) acceptVisit(next)
    }
    async function connect() {
      if (stopped || unavailable || connecting || document.hidden) return
      if (socket && socket.readyState < WebSocket.CLOSING) return
      connecting = true
      try {
        if (!latest.current) {
          const response = await fetch(`/api/retreat/visits/${id}`, {
            signal: controller.signal,
            cache: 'no-store'
          })
          if (!response.ok) {
            setError(
              response.status === 403
                ? 'Open this visit in the browser that created its invitation, with its original cookies. If those cookies were cleared, private access cannot be recovered.'
                : response.status === 410 || response.status === 404
                  ? 'This visit is no longer available.'
                  : 'The visit is temporarily unavailable.'
            )
            if (response.status < 500) {
              unavailable = true
              setConnection('Unavailable')
              return
            }
            throw new Error('Unavailable')
          }
          accept((await response.json()) as VisitSnapshot)
        }
        if (stopped || document.hidden) return
        const url = new URL(
          `/api/retreat/visits/${id}/stream`,
          window.location.href
        )
        if (latest.current)
          url.searchParams.set('cursor', String(latest.current.revision))
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
        socket = new WebSocket(url)
        socket.onopen = () => {
          setConnection('Synchronizing…')
        }
        socket.onmessage = (event) => {
          if (stopped) return
          try {
            if (
              typeof event.data !== 'string' ||
              event.data.length > MAX_VISIT_FRAME_BYTES
            )
              throw new Error('Invalid stream message')
            const frame = JSON.parse(event.data) as VisitFrame
            if (frame.visit.id !== id) throw new Error('Wrong visit')
            accept(applyVisitFrame(latest.current, frame))
            socket?.send(
              JSON.stringify({ type: 'ack', revision: frame.visit.revision })
            )
            attempts = 0
            setConnection('Live')
            setError(undefined)
          } catch {
            // A fresh HTTP snapshot repairs an invalid/missing replay window.
            latest.current = undefined
            socket?.close()
          }
        }
        socket.onclose = (event) => {
          if (
            event.code === 1009 ||
            (event.code === 1000 && event.reason !== 'Tab hidden')
          )
            latest.current = undefined
          if (!stopped) retry()
        }
        socket.onerror = () => socket?.close()
      } catch {
        if (!stopped) retry()
      } finally {
        connecting = false
      }
    }
    function retry() {
      if (timer) clearTimeout(timer)
      if (document.hidden) {
        setConnection('Paused while this tab is hidden')
        return
      }
      if (attempts >= 3) latest.current = undefined
      setConnection('Reconnecting · showing the last update')
      timer = setTimeout(
        () => {
          void connect()
        },
        Math.min(30_000, 1000 * 2 ** attempts++)
      )
    }
    const visibilityChanged = () => {
      if (timer) clearTimeout(timer)
      if (document.hidden) {
        setConnection('Paused while this tab is hidden')
        socket?.close(1000, 'Tab hidden')
      } else {
        void connect()
      }
    }
    document.addEventListener('visibilitychange', visibilityChanged)
    void connect()
    return () => {
      document.removeEventListener('visibilitychange', visibilityChanged)
      stopped = true
      controller.abort()
      if (timer) clearTimeout(timer)
      socket?.close()
    }
  }, [id, acceptVisit])
  return {
    visit: visit?.id === id ? visit : undefined,
    acceptVisit,
    connection,
    error,
    setError
  }
}
