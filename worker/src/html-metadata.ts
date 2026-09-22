import {
  escapeHtml,
  getPageMetadata,
  renderMetadata
} from '../../lib/site-metadata'
import type { Env } from './env'
import { renderPage } from '../../app/entry-server'

export async function humanHtml(request: Request, env: Env) {
  const url = new URL(request.url)
  const page = getPageMetadata(
    url.pathname,
    env.PUBLIC_ORIGIN,
    env.SITE_INDEXABLE === 'true'
  )
  // Fetch the actual shell explicitly: social bots don't send browser navigation headers.
  const shellUrl = new URL('/', url)
  const shell = await env.ASSETS.fetch(
    new Request(shellUrl, { method: request.method })
  )
  if (!shell.headers.get('Content-Type')?.includes('text/html')) return shell
  const markup = request.method === 'HEAD' ? '' : await renderPage(url)
  const transformed = new HTMLRewriter()
    .on('#root', {
      element(element) {
        element.setInnerContent(markup, { html: true })
      }
    })
    .on('[data-retreat-metadata]', {
      element(element) {
        element.remove()
      }
    })
    .on('title', {
      element(element) {
        element.setInnerContent(page.title)
      }
    })
    .on('head', {
      element(element) {
        element.append(
          `<meta name="retreat:origin" content="${escapeHtml(new URL(env.PUBLIC_ORIGIN).origin)}">` +
            `<meta name="retreat:indexable" content="${env.SITE_INDEXABLE === 'true'}">` +
            renderMetadata(page),
          { html: true }
        )
      }
    })
    .transform(shell)
  const headers = new Headers(transformed.headers)
  headers.delete('ETag')
  headers.delete('Content-Length')
  headers.set('Cache-Control', 'no-store')
  if (!page.indexable) headers.set('X-Robots-Tag', 'noindex, nofollow')
  return new Response(transformed.body, {
    status: page.notFound ? 404 : shell.status,
    headers
  })
}
