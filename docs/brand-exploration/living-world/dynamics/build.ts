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
  read('scene.js')
const output = read('index.template.html')
  .replace(
    '__WORDMARK__',
    image('../../../brand-assets/logos/wordmark-sunset.svg', 'image/svg+xml')
  )
  .replace('__ART__', `const ART = ${JSON.stringify(art)}`)
  .replace('__CODE__', code)
writeFileSync(resolve(root, 'index.html'), output)
console.log('Built self-contained Moonclay dynamics study')
