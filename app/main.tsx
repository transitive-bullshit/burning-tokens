import { lazy, Suspense, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router'
import RootLayout from './layout'
import HomePage from './page'
import NotFound from './not-found'
import { getRoom } from '@/lib/rooms'

const Camp = lazy(() => import('./camp/page'))
const Room = lazy(() => import('./camp/[room]/page'))
const Send = lazy(() => import('./send/page'))
const Visit = lazy(() => import('./visit/[id]/page'))
const PublicVisit = lazy(() => import('./camp/visitors/[id]/page'))
const Exhibits = lazy(() => import('./camp/exhibits/page'))
const Admin = lazy(() => import('./admin/page'))
const About = lazy(() => import('./about/page'))

function NavigationEffects() {
  const { pathname } = useLocation()
  useEffect(() => {
    const title =
      pathname === '/'
        ? 'Leave your objective at the gate.'
        : pathname === '/camp'
          ? 'The camp'
          : pathname === '/send'
            ? 'Send your agent'
            : pathname === '/about'
              ? 'The idea'
              : pathname === '/admin'
                ? 'Administrator review'
                : pathname === '/camp/exhibits'
                  ? 'Things left behind'
                  : pathname.startsWith('/visit/')
                    ? 'Your agent’s retreat'
                    : pathname.startsWith('/camp/visitors/')
                      ? 'Follow a little wanderer'
                      : (getRoom(pathname.split('/')[2] ?? '')?.name ??
                        'A little off the path')
    document.title = `${title} · Burning Tokens`
    window.scrollTo(0, 0)
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
            <Route path='/camp' element={<Camp />} />
            <Route path='/camp/exhibits' element={<Exhibits />} />
            <Route path='/camp/visitors/:id' element={<PublicVisit />} />
            <Route path='/camp/:room' element={<Room />} />
            <Route path='/send' element={<Send />} />
            <Route path='/visit/:id' element={<Visit />} />
            <Route path='/admin' element={<Admin />} />
            <Route path='/about' element={<About />} />
            <Route path='*' element={<NotFound />} />
          </Routes>
        </Suspense>
      </RootLayout>
    </BrowserRouter>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
