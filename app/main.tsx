import { hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { AppRoutes } from './routes'

hydrateRoot(
  document.getElementById('root')!,
  <BrowserRouter>
    <AppRoutes />
  </BrowserRouter>
)
