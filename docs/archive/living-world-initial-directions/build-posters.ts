import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

// Run from any directory: node docs/brand-exploration/living-world/build-posters.ts
// Generated boards are embedded whole; this script never edits their pixels.
const dir = path.dirname(fileURLToPath(import.meta.url))
const assets = path.resolve(dir, '../../brand-assets')
const require = createRequire(path.join(assets, 'build/package.json'))
const fontConfig = path.join(assets, 'build/fontconfig.xml')
await fs.access(fontConfig)
process.env.FONTCONFIG_FILE = fontConfig
const sharp = require('sharp')

type Direction = {
  id: string
  title: string
  camera: string
  medium: string
  image: string
}

type Brand = {
  name: string
  colors: Record<string, string>
  colorNames: Record<string, string>
  copy: { mainOneLiner: string; description: string }
  type: { body: { family: string; file: string } }
  logo: { wordmark: { sunset: string } }
}

const manifest = JSON.parse(
  await fs.readFile(path.join(dir, 'directions.json'), 'utf8')
) as { directions: Direction[] }
const brand = JSON.parse(
  await fs.readFile(path.join(assets, 'brand.json'), 'utf8')
) as Brand
const directions = manifest.directions
if (directions.length !== 8)
  throw new Error(`Expected eight directions, received ${directions.length}`)
if (new Set(directions.map((direction) => direction.id)).size !== 8)
  throw new Error('Direction IDs must be unique')

const esc = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
const uri = (bytes: Buffer, mime: string) =>
  `data:${mime};base64,${bytes.toString('base64')}`
const colors = brand.colors
const font = uri(
  await fs.readFile(path.join(assets, brand.type.body.file)),
  'font/ttf'
)
const style = `<style>@font-face{font-family:'${esc(brand.type.body.family)}';src:url('${font}') format('truetype');font-weight:300 700}text{font-family:'${esc(brand.type.body.family)}';fill:${colors.cream}}.invitation{font-weight:500;letter-spacing:-.02em}</style>`
const text = (
  x: number,
  y: number,
  value: string,
  size: number,
  attributes = ''
) =>
  `<text x="${x}" y="${y}" font-size="${size}" ${attributes}>${esc(value)}</text>`
const rect = (
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  attributes = ''
) =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" ${attributes}/>`
const image = (
  x: number,
  y: number,
  width: number,
  height: number,
  source: string
) =>
  `<image x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" href="${source}" xlink:href="${source}"/>`
const svg = (width: number, height: number, title: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"><title>${esc(title)}</title>${style}${rect(0, 0, width, height, colors.ink)}${body}</svg>`

const logoSource = await fs.readFile(
  path.join(assets, brand.logo.wordmark.sunset),
  'utf8'
)
const viewBox = logoSource.match(/viewBox="([^"]+)"/)?.[1]
if (!viewBox || /<image\b/.test(logoSource))
  throw new Error('Expected the canonical native vector wordmark')
const [, , logoWidth, logoHeight] = viewBox.split(/[ ,]+/).map(Number)
const logoBody = logoSource
  .replace(/^[\s\S]*?<svg\b[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
const logoIds = [...logoBody.matchAll(/\bid="([^"]+)"/g)].map(
  (match) => match[1]
)
const logo = (x: number, y: number, width: number, prefix: string) => {
  let body = logoBody
  for (const id of logoIds)
    body = body
      .replaceAll(`id="${id}"`, `id="${prefix}-${id}"`)
      .replaceAll(`url(#${id})`, `url(#${prefix}-${id})`)
      .replaceAll(`href="#${id}"`, `href="#${prefix}-${id}"`)
  return `<svg x="${x}" y="${y}" width="${width}" height="${(width * logoHeight) / logoWidth}" viewBox="${viewBox}">${body}</svg>`
}

// Resolve all raw boards first so an unfinished generation batch writes nothing.
const boards = await Promise.all(
  directions.map(async (direction) => {
    if (!/^[a-z0-9-]+$/.test(direction.id))
      throw new Error(`Invalid direction ID: ${direction.id}`)
    const source = path.resolve(dir, direction.image)
    if (!source.startsWith(`${dir}${path.sep}`))
      throw new Error(
        `Board must be inside the exploration: ${direction.image}`
      )
    const bytes = await fs.readFile(source)
    const metadata = await sharp(bytes).metadata()
    if (!metadata.width || !metadata.height || metadata.format !== 'png')
      throw new Error(`Expected a valid PNG concept board: ${direction.image}`)
    return { direction, source: uri(bytes, 'image/png') }
  })
)

const write = async (name: string, source: string) => {
  await fs.writeFile(path.join(dir, `${name}.svg`), source)
  await sharp(Buffer.from(source))
    .png()
    .toFile(path.join(dir, `${name}.png`))
  console.log(`Created ${name}.svg and ${name}.png`)
}

for (let index = 0; index < boards.length; index++) {
  const { direction, source } = boards[index]
  let body = `${logo(64, 48, 480, `poster-${index}`)}
${text(612, 116, brand.copy.mainOneLiner, 36, 'class="invitation"')}
${text(614, 159, brand.copy.description, 24)}
${text(1536, 44, 'Proposed · no direction selected', 17, 'text-anchor="end"')}
<path d="M64 228H1536" stroke="${colors.cream}" stroke-opacity=".2"/>
${text(64, 291, direction.title, 46, 'font-weight="500" letter-spacing="-1"')}
${text(1536, 283, direction.camera, 22, `text-anchor="end" style="fill:${colors.gold}"`)}
${text(64, 335, direction.medium, 24)}
${image(32, 368, 1536, 1024, source)}
`
  const colorKeys = ['ink', 'cobalt', 'coral', 'gold', 'cream']
  for (let colorIndex = 0; colorIndex < colorKeys.length; colorIndex++) {
    const key = colorKeys[colorIndex]
    const x = 64 + colorIndex * 298
    const foreground = ['ink', 'cobalt'].includes(key)
      ? colors.cream
      : colors.ink
    body += `${rect(x, 1432, 280, 112, colors[key], key === 'ink' ? `stroke="${colors.cream}" stroke-opacity=".3"` : '')}
${text(x + 18, 1473, brand.colorNames[key], 22, `font-weight="500" style="fill:${foreground}"`)}
${text(x + 18, 1522, colors[key], 19, `style="fill:${foreground}"`)}
`
  }
  body += `${text(64, 1596, 'World + creature study', 22)}
${text(1536, 1596, `${String(index + 1).padStart(2, '0')} / 08 · Illustrative concept`, 20, `text-anchor="end" style="fill:${colors.gold}"`)}`
  await write(
    `${direction.id}-poster`,
    svg(
      1600,
      1640,
      `${brand.name} — ${direction.title}, proposed direction`,
      body
    )
  )
}

const tileWidth = 1128
const tileHeight = 752
const rowHeight = 888
let overview = `${logo(48, 48, 500, 'overview')}
${text(672, 111, brand.copy.mainOneLiner, 42, 'class="invitation"')}
${text(674, 161, brand.copy.description, 28)}
${text(2352, 50, 'Proposed · no direction selected', 23, 'text-anchor="end"')}
`
for (let index = 0; index < boards.length; index++) {
  const { direction, source } = boards[index]
  const x = 48 + (index % 2) * 1176
  const y = 248 + Math.floor(index / 2) * rowHeight
  overview += `${image(x, y, tileWidth, tileHeight, source)}
${text(x, y + tileHeight + 47, `${String(index + 1).padStart(2, '0')} / ${direction.title}`, 36, 'font-weight="500" letter-spacing="-.5"')}
${text(x, y + tileHeight + 88, direction.camera, 26, `style="fill:${colors.gold}"`)}
`
}
await write(
  'overview',
  svg(
    2400,
    3824,
    `${brand.name} — eight proposed living worlds and creature directions`,
    overview
  )
)
