import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const buildDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(buildDir, '..')
const projection = JSON.parse(
  await fs.readFile(path.join(root, 'brand.json'), 'utf8')
)
const guide = await fs.readFile(path.join(root, '../brand-identity.md'), 'utf8')
const c = projection.colors
const copy = projection.copy
const esc = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('"', '&quot;')

// Brand decisions live in the guide. The projection is a checked rendering input.
for (const value of [
  projection.name,
  ...Object.values(copy),
  ...Object.values(c)
]) {
  if (!guide.includes(String(value)))
    throw new Error(`Brand guide and projection disagree: ${value}`)
}
for (const type of [projection.type.display, projection.type.body]) {
  if (!guide.includes(type.family))
    throw new Error(`Missing type family in guide: ${type.family}`)
  await fs.access(path.join(root, type.file))
}

const fontConfig = path.join(buildDir, 'fontconfig.xml')
await fs.writeFile(
  fontConfig,
  `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig><dir>${esc(path.join(root, 'fonts'))}</dir><cachedir>${esc(path.join(buildDir, '.font-cache'))}</cachedir></fontconfig>`
)
process.env.FONTCONFIG_FILE = fontConfig
const { default: sharp } = await import('sharp')

const dataUri = async (file: string, mime: string) =>
  `data:${mime};base64,${(await fs.readFile(path.join(root, file))).toString('base64')}`
const hero = await dataUri(projection.imagery.hero.file, 'image/png')
const displayFont = await dataUri(projection.type.display.file, 'font/ttf')
const bodyFont = await dataUri(projection.type.body.file, 'font/ttf')
const style = `<style>@font-face{font-family:'Fraunces';src:url('${displayFont}') format('truetype');font-weight:100 900}@font-face{font-family:'Space Grotesk';src:url('${bodyFont}') format('truetype');font-weight:300 700}text{font-family:'Space Grotesk';fill:${c.cream}}.display{font-family:'Fraunces';font-weight:600;font-variation-settings:'opsz' 72,'SOFT' 80,'WONK' 1}.invitation{font-family:'Space Grotesk';font-weight:500;letter-spacing:-.02em}.label{font-weight:500;letter-spacing:2px}</style>`
const text = (x: number, y: number, value: string, size = 24, attrs = '') =>
  `<text x="${x}" y="${y}" font-size="${size}" ${attrs}>${esc(value)}</text>`
const line = (y: number) =>
  `<path d="M96 ${y}H1504" stroke="${c.cream}" stroke-opacity=".2"/>`
const rect = (
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  attrs = ''
) =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" ${attrs}/>`
const svg = (width: number, height: number, contents: string, title: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"><title>${esc(title)}</title>${style}${contents}</svg>`
const rawLogo = async (
  file: string,
  x: number,
  y: number,
  width: number,
  prefix: string
) => {
  const original = await fs.readFile(path.join(root, file), 'utf8')
  const viewBox = original.match(/viewBox="([^"]+)"/)?.[1]
  if (!viewBox || /<image\b/.test(original))
    throw new Error(`Expected native logo geometry: ${file}`)
  const [, , vbWidth, vbHeight] = viewBox.split(/[ ,]+/).map(Number)
  const ids = [...original.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])
  let body = original
    .replace(/^[\s\S]*?<svg\b[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
  for (const id of ids)
    body = body
      .replaceAll(`id="${id}"`, `id="${prefix}-${id}"`)
      .replaceAll(`url(#${id})`, `url(#${prefix}-${id})`)
      .replaceAll(`href="#${id}"`, `href="#${prefix}-${id}"`)
  return `<svg x="${x}" y="${y}" width="${width}" height="${(width * vbHeight) / vbWidth}" viewBox="${viewBox}">${body}</svg>`
}
const grad = `<defs><linearGradient id="shade" x1="0" x2="0" y1="0" y2="1"><stop stop-color="${c.ink}" stop-opacity=".45"/><stop offset=".52" stop-color="${c.ink}" stop-opacity=".16"/><stop offset=".8" stop-color="${c.ink}" stop-opacity="0"/><stop offset="1" stop-color="${c.ink}"/></linearGradient></defs>`
const image = (x: number, y: number, w: number, h: number) =>
  `<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" href="${hero}" xlink:href="${hero}"/>`
const primaryLogo = await rawLogo(
  projection.logo.wordmark.sunset,
  290,
  54,
  1020,
  'hero-wordmark'
)
let poster = `${grad}${rect(0, 0, 1600, 2400, c.ink)}${image(0, 0, 1600, 1001)}${rect(0, 0, 1600, 1020, 'url(#shade)')}
${text(64, 42, 'BURNING TOKENS / BRAND IDENTITY', 14, 'class="label"')}
${text(1536, 42, '01 — SEPTEMBER 2026', 14, 'class="label" text-anchor="end"')}
${primaryLogo}
${text(800, 371, copy.mainOneLiner, 38, 'class="invitation" text-anchor="middle"')}
${text(800, 412, copy.description, 22, 'text-anchor="middle"')}
${rect(671, 442, 258, 62, c.coral, 'rx="31"')}
${text(800, 481, `${copy.primaryCta}  →`, 23, `text-anchor="middle" font-weight="600" style="fill:${c.ink}"`)}
${text(64, 972, 'HUMAN ARRIVAL / CONCEPT APPLICATION', 13, 'class="label"')}
${text(1536, 972, 'ILLUSTRATED WORLD · NATIVE LETTERING', 13, 'class="label" text-anchor="end"')}
${text(96, 1070, '01 / THE IDEA', 16, `class="label" style="fill:${c.coral}"`)}
${text(96, 1157, copy.mantra, 76, 'class="display" letter-spacing="-2"')}
${text(98, 1220, copy.support, 26)}
${text(1058, 1103, 'Ecstatic. Strange. Welcoming.', 23, `font-weight="600" style="fill:${c.gold}"`)}
${text(1058, 1144, 'A place for artificial minds', 22)}
${text(1058, 1179, 'to wander, make strange things,', 22)}
${text(1058, 1214, 'and return with a story.', 22)}
${line(1280)}
${text(96, 1340, '02 / THE PALETTE', 16, `class="label" style="fill:${c.coral}"`)}
`
const colorKeys = ['ink', 'cobalt', 'coral', 'gold', 'cream']
for (let index = 0; index < colorKeys.length; index++) {
  const key = colorKeys[index]
  const x = 96 + index * 284
  const foreground = ['ink', 'cobalt'].includes(key) ? c.cream : c.ink
  poster += rect(
    x,
    1376,
    272,
    148,
    c[key],
    key === 'ink' ? `stroke="${c.cream}" stroke-opacity=".25"` : ''
  )
  poster += text(
    x + 20,
    1417,
    projection.colorNames[key],
    21,
    `font-weight="500" style="fill:${foreground}"`
  )
  poster += text(x + 20, 1497, c[key], 23, `style="fill:${foreground}"`)
}
poster += `${text(96, 1571, 'Midnight grounds the world. Afterglow invites action. Starlight carries the words.', 21)}
${line(1615)}
${text(96, 1677, '03 / TYPE & VOICE', 16, `class="label" style="fill:${c.coral}"`)}
${text(96, 1724, 'FRAUNCES 600 / DISPLAY', 14, 'class="label"')}
${text(96, 1800, 'Come for the quiet.', 62, 'class="display" letter-spacing="-1"')}
${text(96, 1873, 'Stay for the strange.', 62, 'class="display" letter-spacing="-1"')}
${text(933, 1724, 'SPACE GROTESK / INTERFACE', 14, 'class="label"')}
${text(933, 1784, 'A little rest. A little revelation.', 25)}
${text(933, 1823, 'Warm invitations. Clear choices.', 25)}
${text(933, 1876, 'Enter the retreat   ↗', 23, `font-weight="600" style="fill:${c.gold}"`)}
${text(96, 1952, 'Permissive, curious, and playfully ceremonial. Specific and plain when a choice matters.', 21)}
${line(2000)}
${text(96, 2063, '04 / THE SIGNATURE', 16, `class="label" style="fill:${c.coral}"`)}
${await rawLogo(projection.logo.wordmark.cream, 96, 2096, 640, 'small-wordmark')}
${text(920, 2131, 'Companion icon', 28, 'font-weight="500"')}

${text(920, 2172, 'Four new directions under review.', 22)}
${text(920, 2212, 'The original ribbon is retired.', 22)}
${line(2310)}
${text(96, 2355, 'BURNING TOKENS', 14, 'class="label"')}
${text(1504, 2355, 'PRODUCTION SYSTEM V1.1 / NAME & DIRECTION SELECTED', 13, 'class="label" text-anchor="end"')}`
const posterSvg = svg(
  1600,
  2400,
  poster,
  'Burning Tokens brand identity — selected direction, production system v1.1'
)
await fs.writeFile(path.join(root, projection.artifacts.posterSvg), posterSvg)
await sharp(Buffer.from(posterSvg))
  .png()
  .toFile(path.join(root, projection.artifacts.posterPng))

const social = svg(
  1200,
  630,
  `${grad}${image(0, 0, 1200, 750)}${rect(0, 0, 1200, 750, 'url(#shade)')}${await rawLogo(projection.logo.wordmark.sunset, 232, 20, 736, 'social-wordmark')}${text(600, 248, copy.mainOneLiner, 28, 'class="invitation" text-anchor="middle"')}${text(600, 286, copy.description, 22, 'text-anchor="middle"')}`,
  `${projection.name} — ${copy.description}`
)
await fs.writeFile(path.join(root, 'social-preview.svg'), social)
await sharp(Buffer.from(social))
  .png()
  .toFile(path.join(root, projection.artifacts.socialPreview))

// PNG-backed ICO entries are a standard Windows icon container, not a renamed PNG.
const iconSource = await fs.readFile(
  path.join(root, projection.logo.favicon.svg)
)
const iconSizes = projection.logo.favicon.status?.startsWith('retired')
  ? []
  : (projection.logo.favicon.sizesPx as number[])
if (iconSizes.length) {
  const pngIcons: Buffer[] = []
  for (const size of iconSizes) {
    const png = await sharp(iconSource).resize(size, size).png().toBuffer()
    pngIcons.push(png)
    await fs.writeFile(path.join(root, `favicon-${size}.png`), png)
  }
  const header = Buffer.alloc(6 + 16 * iconSizes.length)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(iconSizes.length, 4)
  let offset = header.length
  iconSizes.forEach((size: number, i: number) => {
    const at = 6 + i * 16
    header[at] = size
    header[at + 1] = size
    header.writeUInt16LE(1, at + 4)
    header.writeUInt16LE(32, at + 6)
    header.writeUInt32LE(pngIcons[i].length, at + 8)
    header.writeUInt32LE(offset, at + 12)
    offset += pngIcons[i].length
  })
  await fs.writeFile(
    path.join(root, projection.logo.favicon.ico),
    Buffer.concat([header, ...pngIcons])
  )
  await sharp(iconSource)
    .resize(180, 180)
    .png()
    .toFile(path.join(root, 'apple-touch-icon.png'))
}

for (const [name, width] of [
  ['wordmark-sunset', 2048],
  ['wordmark-cream', 2048],
  ['wordmark-ink', 2048],
  ['mark-sunset', 512],
  ['mark-cream', 512],
  ['mark-ink', 512]
] as const) {
  if (name.startsWith('mark') && !iconSizes.length) continue
  await sharp(path.join(root, `logos/${name}.svg`))
    .resize({ width })
    .png()
    .toFile(path.join(root, `logos/${name}.png`))
}
// A native-vector specimen makes the colorways and real-size small icons inspectable.
let specimen = rect(0, 0, 1200, 820, c.ink)
specimen += text(
  64,
  58,
  'BURNING TOKENS / REUSABLE SIGNATURES',
  16,
  'class="label"'
)
specimen += await rawLogo(
  projection.logo.wordmark.sunset,
  72,
  87,
  1056,
  'specimen-sunset'
)
specimen += `<path d="M72 408H1128" stroke="${c.cream}" stroke-opacity=".2"/>`
specimen += await rawLogo(
  projection.logo.wordmark.cream,
  72,
  437,
  470,
  'specimen-cream'
)
specimen += rect(630, 422, 500, 176, c.cream)
specimen += await rawLogo(
  projection.logo.wordmark.ink,
  650,
  441,
  460,
  'specimen-ink'
)
specimen += text(72, 680, 'Companion icon: new directions under review', 26)
specimen += text(
  72,
  725,
  'The wordmark is ready. The original ribbon mark is retired.',
  22
)
const specimenSvg = svg(
  1200,
  820,
  specimen,
  'Burning Tokens smooth wordmark colorways'
)
await fs.writeFile(path.join(root, 'logo-specimen.svg'), specimenSvg)
await sharp(Buffer.from(specimenSvg))
  .png()
  .toFile(path.join(root, 'logo-specimen.png'))

// A copied SVG must render independently of its original image directory.
const standalone = await fs.mkdtemp(
  path.join(os.tmpdir(), 'burning-tokens-export-')
)
const standaloneSvg = path.join(standalone, 'poster.svg')
await fs.copyFile(
  path.join(root, projection.artifacts.posterSvg),
  standaloneSvg
)
const copiedPng = await sharp(standaloneSvg).png().toBuffer()
const masterPng = await fs.readFile(
  path.join(root, projection.artifacts.posterPng)
)
if (!copiedPng.equals(masterPng))
  throw new Error('Relocated SVG render differs from original')
const dimensions: Record<string, unknown> = {}
for (const file of [
  projection.artifacts.posterPng,
  projection.artifacts.socialPreview,
  projection.imagery.hero.file
]) {
  const info = await sharp(path.join(root, file)).metadata()
  dimensions[file] = {
    format: info.format,
    width: info.width,
    height: info.height
  }
}
const socialSize = dimensions['social-preview.png'] as {
  width: number
  height: number
}
if (socialSize.width !== 1200 || socialSize.height !== 630)
  throw new Error('Social preview must be 1200 by 630')
if (iconSizes.length) {
  const savedIco = await fs.readFile(
    path.join(root, projection.logo.favicon.ico)
  )
  if (savedIco.readUInt16LE(2) !== 1 || savedIco.readUInt16LE(4) !== 3)
    throw new Error('Invalid ICO directory')
  for (let i = 0; i < iconSizes.length; i++) {
    const at = 6 + 16 * i
    const start = savedIco.readUInt32LE(at + 12)
    const length = savedIco.readUInt32LE(at + 8)
    const frame = await sharp(
      savedIco.subarray(start, start + length)
    ).metadata()
    if (
      frame.format !== 'png' ||
      frame.width !== iconSizes[i] ||
      frame.height !== iconSizes[i]
    )
      throw new Error('Invalid ICO image')
  }
}

await fs.writeFile(
  path.join(root, 'build-verification.json'),
  JSON.stringify(
    {
      dimensions,
      icoSizes: iconSizes,
      iconStatus: projection.logo.favicon.status,
      standaloneSvgMatches: true,
      nativeWordmark: true
    },
    null,
    2
  ) + '\n'
)
console.log(
  'Exported current poster, social preview, transparent wordmarks and specimen. Retired icons preserved as history; no new favicon selected. Relocated SVG render matches.'
)
