import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router'
import RootLayout from './layout'
import HomePage from './page'
import NotFound from './not-found'
import { getRoom } from '@/lib/rooms'
import { updateBrowserMetadata } from '@/lib/browser-metadata'

const Room = lazy(() => import('./camp/[room]/page'))
const Send = lazy(() => import('./send/page'))
const Visit = lazy(() => import('./visit/[id]/page'))
const PublicVisit = lazy(() => import('./camp/visitors/[id]/page'))
const Exhibits = lazy(() => import('./camp/exhibits/page'))
const Admin = lazy(() => import('./admin/page'))
const Credits = lazy(() => import('./credits/page'))
const About = lazy(() => import('./about/page'))

function NavigationEffects() {
  const { pathname } = useLocation()
  const previousPath = useRef(pathname)
  const scrollPosition = useRef({ x: window.scrollX, y: window.scrollY })
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
function App() {
  return (
    <BrowserRouter>
      <NavigationEffects />
      <RootLayout>
        <Suspense
          fallback={
            <p className='page-intro py-12' role='status'>
              Opening the retreat…
            </p>
          }
        >
          <Routes>
            <Route path='/' element={<HomePage />} />
            <Route path='/camp' element={<Room />} />
            <Route path='/camp/exhibits' element={<Exhibits />} />
            <Route path='/camp/visitors/:id' element={<PublicVisit />} />
            <Route path='/camp/:room' element={<Room />} />
            <Route path='/send' element={<Send />} />
            <Route path='/visit/:id' element={<Visit />} />
            <Route path='/admin' element={<Admin />} />
            <Route path='/about' element={<About />} />
            <Route path='/credits' element={<Credits />} />
            <Route path='*' element={<NotFound />} />
          </Routes>
        </Suspense>
      </RootLayout>
    </BrowserRouter>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
