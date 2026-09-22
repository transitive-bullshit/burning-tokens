import { escapeHtml, publicPagePaths } from '../../lib/site-metadata'
import type { Env } from './env'

/** Authored public URLs only; no storage reads or visitor identifiers. */
export function crawlMetadata(request: Request, env: Env): Response | null {
  const path = new URL(request.url).pathname
  if (path !== '/robots.txt' && path !== '/sitemap.xml') return null
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } })

  const origin = new URL(env.PUBLIC_ORIGIN).origin
  const indexable = env.SITE_INDEXABLE === 'true'
  // Allow crawling so bots can read page-level noindex and social metadata.
  const robots = `User-agent: *\nAllow: /\n${indexable ? `\nSitemap: ${origin}/sitemap.xml\n` : ''}`
  const urls = indexable ? publicPagePaths : []
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escapeHtml(new URL(url, origin).href)}</loc></url>`).join('\n')}\n</urlset>\n`
  const headers = new Headers({
    'Content-Type':
      path === '/robots.txt'
        ? 'text/plain; charset=utf-8'
        : 'application/xml; charset=utf-8',
    'Cache-Control': 'no-store'
  })
  if (!indexable) headers.set('X-Robots-Tag', 'noindex, nofollow')
  return new Response(
    request.method === 'HEAD'
      ? null
      : path === '/robots.txt'
        ? robots
        : sitemap,
    { headers }
  )
}
