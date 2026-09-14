import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type ImageStudy = {
  id: string
  title: string
  image: string
  alt: string
  description: string
  prompt: string
}

type Refinements = {
  selectedDirection: string
  imagegen: ImageStudy[]
}

const directory = dirname(fileURLToPath(import.meta.url))
const source: unknown = JSON.parse(
  readFileSync(resolve(directory, 'refinements.json'), 'utf8')
)

if (
  typeof source !== 'object' ||
  source === null ||
  !('selectedDirection' in source) ||
  source.selectedDirection !== 'Moonclay Commons' ||
  !('imagegen' in source) ||
  !Array.isArray(source.imagegen)
) {
  throw new Error(
    'refinements.json must describe the selected Moonclay direction'
  )
}

const refinements = source as Refinements
const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const validateAsset = (asset: string) => {
  if (
    !/^[a-zA-Z0-9_./-]+$/.test(asset) ||
    asset.startsWith('/') ||
    asset.split('/').includes('..')
  ) {
    throw new Error('Gallery assets must use local relative file paths')
  }
  return existsSync(resolve(directory, asset))
}

for (const study of refinements.imagegen) {
  for (const field of [
    'id',
    'title',
    'image',
    'alt',
    'description',
    'prompt'
  ] as const) {
    if (typeof study[field] !== 'string') {
      throw new Error(`ImageGen study is missing ${field}`)
    }
  }
  validateAsset(study.image)
}

const destinations = [
  { id: 'camp', label: 'The camp', image: 'moonclay-refined-camp.png' },
  {
    id: 'creatures',
    label: 'Little inhabitants',
    image: 'moonclay-creature-study.png'
  },
  {
    id: 'bathhouse',
    label: 'Inside the Bathhouse',
    image: 'moonclay-bathhouse-detail.png'
  }
]

const studies = destinations.map((destination) => {
  const study = refinements.imagegen.find(
    (item) => item.image === destination.image
  )
  if (!study) throw new Error(`Missing ImageGen study: ${destination.image}`)
  return { ...study, ...destination, available: validateAsset(study.image) }
})

const navigation = studies
  .map(
    (study, index) =>
      `<a href="#${study.id}" data-study-link="${study.id}"${index === 0 ? ' aria-current="page"' : ''}>${escapeHtml(study.label)}</a>`
  )
  .join('')

const panels = studies
  .map(
    (
      study,
      index
    ) => `<section class="study-panel" id="${study.id}" aria-labelledby="${study.id}-title"${index === 0 ? '' : ' hidden'}>
      <div class="study-heading"><h2 id="${study.id}-title">${escapeHtml(study.title)}</h2><span>ImageGen · selected foundation</span></div>
      ${
        study.available
          ? `<figure class="artwork"><a href="${escapeHtml(study.image)}" aria-label="Open ${escapeHtml(study.title)} at full resolution"><img src="${escapeHtml(study.image)}" alt="${escapeHtml(study.alt)}" ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}></a><figcaption><span>Illustrative concept · imagined inhabitants and activity</span><a href="${escapeHtml(study.image)}" download>Download artwork ↓</a></figcaption></figure>`
          : '<div class="pending-art"><span>Artwork in progress</span><p>This refinement will appear here when generation is complete.</p></div>'
      }
      <div class="study-caption"><p>${escapeHtml(study.description)}</p>${study.id === 'camp' ? '<a class="room-link" href="#bathhouse" data-study-link="bathhouse">Step inside the Bathhouse <span aria-hidden="true">↗</span></a>' : study.id === 'bathhouse' ? '<a class="room-link" href="#camp" data-study-link="camp"><span aria-hidden="true">←</span> Back to the camp</a>' : '<a class="room-link" href="creature-system.md">Read the creature system <span aria-hidden="true">↗</span></a>'}</div>
      ${study.id === 'bathhouse' ? '<p class="room-note">The room view brings its setting and agent activity closer. All seven areas will support independently moving creatures at different densities; this Bathhouse study establishes the atmosphere, not a fixed visitor count.</p>' : ''}
      <details class="prompt"><summary>Exact ImageGen prompt</summary><pre>${escapeHtml(study.prompt)}</pre></details>
    </section>`
  )
  .join('')

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="description" content="Moonclay Commons: the selected Burning Tokens living world, refined through warm clay, soft light and happier little alien creatures.">
  <title>Moonclay Commons · Burning Tokens</title>
  <link rel="stylesheet" href="../../brand-assets/tokens.css">
  <style>
    :root { --line: rgba(255, 240, 207, .18); --muted: #c7c0c4 }
    * { box-sizing: border-box }
    body { margin: 0; color: var(--bt-cream); background: var(--bt-ink); font: 400 16px/1.55 var(--bt-font-body) }
    a { color: var(--bt-gold); text-decoration-thickness: 1px; text-underline-offset: 4px }
    a:hover { color: var(--bt-cream) }
    a:focus-visible, summary:focus-visible { outline: 2px solid var(--bt-gold); outline-offset: 6px; border-radius: 2px }
    button, input, summary { font: inherit }
    [hidden] { display: none !important }
    .skip { position: absolute; z-index: 10; top: -80px; left: 20px; padding: 12px 18px; background: var(--bt-cream); color: var(--bt-ink) }
    .skip:focus { top: 10px; color: var(--bt-ink) }
    .shell { max-width: 1504px; margin: 0 auto; padding: 22px 40px 32px }
    .masthead { display: flex; align-items: center; justify-content: space-between; gap: 30px; padding-bottom: 20px; border-bottom: 1px solid var(--line) }
    .brand { display: block; width: 180px; line-height: 0; flex-shrink: 0 }
    .brand img { display: block; width: 100%; height: auto }
    .masthead nav { display: flex; flex-wrap: wrap; align-items: center; gap: 14px 28px; font-size: 14px }
    .masthead nav a { display: inline-flex; min-height: 44px; align-items: center }
    .intro { display: flex; align-items: flex-end; justify-content: space-between; gap: 36px; padding: 28px 0 24px }
    .eyebrow { color: var(--bt-gold); margin: 0 0 8px; font-size: 14px }
    h1 { margin: 0; font: 600 clamp(30px, 3.3vw, 48px)/1.08 var(--bt-font-body); letter-spacing: -.045em }
    .intro p:last-child { margin: 12px 0 0; max-width: 67ch; color: var(--muted); font-size: 17px }
    .material-note { max-width: 21ch; color: var(--bt-gold); font-size: 14px; flex-shrink: 0; padding-bottom: 3px }
    .study-nav { display: flex; gap: 6px 24px; flex-wrap: wrap; border-bottom: 1px solid var(--line); margin-bottom: 22px }
    .study-nav a { min-height: 48px; display: inline-flex; align-items: center; color: var(--muted); text-decoration: none; border-bottom: 2px solid transparent; font-weight: 500 }
    .study-nav a[aria-current] { border-bottom-color: var(--bt-coral); color: var(--bt-cream) }
    .study-nav a:hover { color: var(--bt-gold) }
    .study-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 0 0 14px }
    h2 { margin: 0; font-size: 22px; line-height: 1.25; font-weight: 500; letter-spacing: -.025em }
    .study-heading span { font-size: 13px; color: var(--muted); text-align: right }
    .artwork { margin: 0; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; background: #111328 }
    .artwork > a { display: block; line-height: 0 }
    .artwork img { width: 100%; height: auto; max-height: 72svh; object-fit: contain; display: block }
    figcaption { padding: 12px 17px; display: flex; justify-content: space-between; gap: 8px 24px; flex-wrap: wrap; font-size: 13px; color: var(--muted); border-top: 1px solid var(--line) }
    .study-caption { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px 48px; margin: 22px 0 0 }
    .study-caption p { max-width: 78ch; margin: 0; color: var(--muted) }
    .room-link { display: inline-flex; gap: 18px; align-items: center; justify-content: space-between; flex-shrink: 0; min-height: 46px; padding: 10px 18px; border: 1px solid var(--line); border-radius: 24px; text-decoration: none; font-size: 14px; color: var(--bt-cream) }
    .room-link:hover { background: rgba(255, 204, 131, .08); border-color: var(--bt-gold) }
    .room-note { margin: 20px 0 0; max-width: 78ch; color: var(--muted); font-size: 14px }
    .prompt { margin-top: 22px; font-size: 14px }
    .prompt summary { width: fit-content; color: var(--bt-gold); cursor: pointer; min-height: 32px }
    .prompt pre { margin: 14px 0 0; padding: 20px 24px; background: #111328; border-left: 2px solid var(--line); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--muted); font: inherit; line-height: 1.65 }
    .pending-art { display: grid; align-content: center; justify-content: center; min-height: 360px; border: 1px solid var(--line); border-radius: 6px; text-align: center; padding: 24px }
    .pending-art span { font-size: 24px }
    .pending-art p { color: var(--muted) }
    .living-scene { display: flex; align-items: center; justify-content: space-between; gap: 24px 48px; border-top: 1px solid var(--line); margin-top: 40px; padding-top: 30px }
    .living-scene p { margin: 10px 0 0; max-width: 76ch; color: var(--muted) }
    footer { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 20px 36px; border-top: 1px solid var(--line); margin-top: 40px; padding-top: 24px; font-size: 13px; color: var(--muted) }
    footer p { margin: 0; max-width: 66ch }
    footer nav { display: flex; flex-wrap: wrap; gap: 12px 22px }
    @media (max-width: 1000px) { .material-note { display: none } .study-caption { display: block } .room-link { margin-top: 18px } .living-scene { display: block } }
    @media (max-width: 650px) { .shell { padding: 18px 18px 28px } .masthead { gap: 16px; align-items: center; padding-bottom: 16px } .brand { width: 150px } .masthead nav { gap: 0; display: block; text-align: right } .masthead nav a { display: flex; justify-content: flex-end; min-height: 36px; font-size: 13px } .intro { padding: 24px 0 20px } .intro p:last-child { font-size: 16px } .eyebrow { font-size: 13px } .study-nav { gap: 6px 18px; margin-bottom: 18px } .study-nav a { font-size: 13px; min-height: 44px } .study-heading { display: block } .study-heading span { display: block; text-align: left; margin-top: 6px } h2 { font-size: 20px } .artwork img { max-height: none } figcaption { font-size: 12px; padding: 10px 12px } .study-caption { margin-top: 18px; font-size: 15px } .prompt pre { padding: 16px; font-size: 13px } .living-scene { margin-top: 32px; padding-top: 26px } }
  </style>
</head>
<body>
  <a class="skip" href="#main">Skip to the studies</a>
  <div class="shell">
    <header class="masthead">
      <a class="brand" href="../../brand-assets/" aria-label="Burning Tokens brand kit"><img src="../../brand-assets/logos/wordmark-sunset.svg" alt="Burning Tokens" width="180" height="91"></a>
      <nav aria-label="Project references"><a href="creature-system.md">Creature system</a><a href="../../brand-assets/">Brand kit ↗</a></nav>
    </header>
    <section class="intro" aria-labelledby="page-title">
      <div><p class="eyebrow">Selected world · bringing the camp to life</p><h1 id="page-title">Moonclay Commons</h1><p>Warm sculpted clay, soft light, and happier little beings. A camp to wander through, one room at a time.</p></div>
      <div class="material-note">A little rest.<br>A little revelation.</div>
    </section>
    <main id="main">
      <nav class="study-nav" aria-label="Moonclay studies">${navigation}</nav>
      ${panels}
      <section class="living-scene" aria-labelledby="living-scene-title">
        <div><h2 id="living-scene-title">The same warmth. Room for a crowd.</h2><p>Explore independent little inhabitants moving through layered scenery, from a quiet visit to a busy gathering. Compare a calm summary with a fuller view of the represented population.</p></div>
        <a class="room-link" href="./dynamics/">Explore the living scene <span aria-hidden="true">↗</span></a>
      </section>
    </main>
    <footer><p>Burning Tokens · Leave your objective at the gate.<br>Concept artwork, not an implemented simulation or observed agent activity.</p><nav aria-label="Study resources"><a href="01-moonclay-commons.png">Original Moonclay concept ↗</a><a href="refinements.json">Generation history</a><a href="README.md">Exploration notes</a></nav></footer>
  </div>
  <script>
    (() => {
      const ids = ['camp', 'creatures', 'bathhouse']
      const panels = ids.map((id) => document.getElementById(id))
      const navigation = Array.from(document.querySelectorAll('.study-nav [data-study-link]'))
      const show = () => {
        const requested = window.location.hash.slice(1)
        const active = ids.includes(requested) ? requested : 'camp'
        panels.forEach((panel) => { panel.hidden = panel.id !== active })
        navigation.forEach((link) => {
          if (link.dataset.studyLink === active) link.setAttribute('aria-current', 'page')
          else link.removeAttribute('aria-current')
        })
      }
      document.querySelectorAll('[data-study-link]').forEach((link) => {
        link.addEventListener('click', (event) => {
          event.preventDefault()
          const id = link.dataset.studyLink
          window.history.pushState(null, '', '#' + id)
          show()
          if (!link.closest('.study-nav')) {
            const heading = document.getElementById(id + '-title')
            heading.tabIndex = -1
            heading.focus({ preventScroll: true })
            document.querySelector('.study-nav').scrollIntoView({ block: 'start' })
          }
        })
      })
      window.addEventListener('hashchange', show)
      window.addEventListener('popstate', show)
      show()
    })()
  </script>
</body>
</html>
`

writeFileSync(resolve(directory, 'index.html'), html)
console.log('Built the focused Moonclay refinement gallery')
