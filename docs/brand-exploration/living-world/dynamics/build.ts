import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const image = (path: string, mime = 'image/png') =>
  `data:${mime};base64,${readFileSync(resolve(root, path)).toString('base64')}`
const detailSlugs = [
  'dream-garden',
  'quiet-house',
  'source',
  'open-studio',
  'hearth',
  'temple'
]
const revisedRooms = new Set(detailSlugs)
const art = {
  ...Object.fromEntries(
    detailSlugs.map((slug) => [
      slug,
      image(slug + (revisedRooms.has(slug) ? '-vibe' : '') + '-empty.png')
    ])
  ),
  bathhouse: image('bathhouse-empty.png'),
  camp: image('camp-empty.png'),
  creatures: image('creature-atlas.png')
}
const soundCatalog = JSON.parse(read('sound-catalog.json'))
const soundReviewSnapshot = JSON.parse(read(soundCatalog.reviewSnapshot))
const code =
  read('crowd.js').replaceAll('export function ', 'function ') +
  '\n' +
  read('physics.js').replaceAll('export function ', 'function ') +
  '\n' +
  read('room-details.js').replaceAll('export const ', 'const ') +
  '\n' +
  read('room-acting.js').replaceAll('export function ', 'function ') +
  '\n' +
  read('room-effects.js').replaceAll('export function ', 'function ') +
  '\n' +
  read('sound-engine.js').replaceAll('export function ', 'function ') +
  '\n' +
  read('sound-hotspots.js')
    .replaceAll('export const ', 'const ')
    .replaceAll('export function ', 'function ') +
  '\n' +
  read('scene-sound.js').replaceAll('export function ', 'function ') +
  '\n' +
  read('../../creature-audio/review-preferences.js')
    .replaceAll('export function ', 'function ')
    .replaceAll('export const ', 'const ') +
  '\nconst SOUND_CATALOG = ' +
  JSON.stringify(soundCatalog) +
  '\nconst SOUND_REVIEW_SNAPSHOT = ' +
  JSON.stringify({ hidden: soundReviewSnapshot.hidden }) +
  '\n' +
  read('scene.js')
const output = read('index.template.html')
  .replace(
    '__WORDMARK__',
    image('../../../brand-assets/logos/wordmark-sunset.svg', 'image/svg+xml')
  )
  .replace('__ART__', `const ART = ${JSON.stringify(art)}`)
  .replace('__CODE__', code)
writeFileSync(resolve(root, 'index.html'), output)
console.log(
  'Built Moonclay dynamics study with embedded art and reviewed sound catalog'
)
