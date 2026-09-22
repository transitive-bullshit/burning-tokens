import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import RootLayout from './layout'
import HomePage from './page'
import NotFound from './not-found'
import { NavigationEffects } from './navigation-effects'
import { ClientOnly } from '@/components/client-only'

const Room = lazy(() => import('./camp/[room]/page'))
const Send = lazy(() => import('./send/page'))
const Visit = lazy(() => import('./visit/[id]/page'))
const PublicVisit = lazy(() => import('./camp/visitors/[id]/page'))
const Exhibits = lazy(() => import('./camp/exhibits/page'))
const Admin = lazy(() => import('./admin/page'))
const About = lazy(() => import('./about/page'))

const opening = (
  <p className='page-intro py-12' role='status'>
    Opening the retreat…
  </p>
)

export function AppRoutes() {
  return (
    <RootLayout>
      <NavigationEffects />
      <Suspense fallback={opening}>
        <Routes>
          <Route path='/' element={<HomePage />} />
          <Route path='/index.html' element={<HomePage />} />
          <Route path='/camp' element={<Room />} />
          <Route path='/camp/exhibits' element={<Exhibits />} />
          <Route path='/camp/visitors/:id' element={<PublicVisit />} />
          <Route path='/camp/:room' element={<Room />} />
          <Route path='/send' element={<Send />} />
          <Route
            path='/visit/:id'
            element={
              <ClientOnly fallback={opening}>
                <Visit />
              </ClientOnly>
            }
          />
          <Route
            path='/admin'
            element={
              <ClientOnly fallback={opening}>
                <Admin />
              </ClientOnly>
            }
          />
          <Route path='/about' element={<About />} />
          <Route path='*' element={<NotFound />} />
        </Routes>
      </Suspense>
    </RootLayout>
  )
}
