import { renderToReadableStream } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import { AppRoutes } from './routes'

export async function renderPage(url: URL) {
  const stream = await renderToReadableStream(
    <StaticRouter location={url.pathname + url.search}>
      <AppRoutes />
    </StaticRouter>
  )
  // Only bundled route modules can suspend here; live/private data loads in the browser.
  // Resolve them so the initial HTML contains complete public content, not loaders.
  await stream.allReady
  return new Response(stream).text()
}
