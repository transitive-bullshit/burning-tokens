import { getPageMetadata, metadataTags } from './site-metadata'

/** Share crawlers get these tags from the Worker; client navigation uses the same definitions. */
export function updateBrowserMetadata(pathname: string) {
  const origin =
    document.querySelector<HTMLMetaElement>('meta[name="retreat:origin"]')
      ?.content ?? window.location.origin
  const allowIndexing =
    document.querySelector<HTMLMetaElement>('meta[name="retreat:indexable"]')
      ?.content === 'true'
  const page = getPageMetadata(pathname, origin, allowIndexing)
  document.title = page.title
  document.head
    .querySelectorAll('[data-retreat-metadata]')
    .forEach((node) => node.remove())
  for (const tag of metadataTags(page)) {
    const element = document.createElement(tag.name)
    element.setAttribute('data-retreat-metadata', '')
    for (const [name, value] of Object.entries(tag.attributes))
      element.setAttribute(name, value)
    if (tag.text) element.textContent = tag.text
    document.head.append(element)
  }
}
