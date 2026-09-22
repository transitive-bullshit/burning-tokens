import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { getRoom } from '@/lib/rooms'
import { updateBrowserMetadata } from '@/lib/browser-metadata'

export function NavigationEffects() {
  const { pathname } = useLocation()
  const previousPath = useRef(pathname)
  const scrollPosition = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const rememberScroll = () => {
      scrollPosition.current = { x: window.scrollX, y: window.scrollY }
    }
    window.addEventListener('scroll', rememberScroll, { passive: true })
    return () => window.removeEventListener('scroll', rememberScroll)
  }, [])
  useLayoutEffect(() => {
    updateBrowserMetadata(pathname)
    const isScene = (path: string) =>
      path === '/camp' ||
      (path.startsWith('/camp/') && Boolean(getRoom(path.slice(6))))
    const movingBetweenScenes =
      isScene(previousPath.current) && isScene(pathname)
    previousPath.current = pathname
    if (movingBetweenScenes)
      window.scrollTo(scrollPosition.current.x, scrollPosition.current.y)
    else window.scrollTo(0, 0)
  }, [pathname])
  return null
}
