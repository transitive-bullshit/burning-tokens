import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const dir = path.dirname(fileURLToPath(import.meta.url))
const assets = path.resolve(dir, '../../brand-assets')
const require = createRequire(path.join(assets, 'build/package.json'))
process.env.FONTCONFIG_FILE = path.join(assets, 'build/fontconfig.xml')
const sharp = require('sharp')
const ink = '#151632'
const cream = '#FFF0CF'
const gold = '#FFCC83'
const defs =
  '<defs><linearGradient id="sunset" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#FFCC83"/><stop offset="1" stop-color="#FF7464"/></linearGradient></defs>'
const outline = await fs.readFile(
  path.join(assets, 'logos/wordmark-sunset.svg'),
  'utf8'
)
const bPath = outline.match(/<path\b[^>]*id="letter-03"[^>]*\/>/)?.[0]
if (!bPath) throw new Error('Expected the original B letter path')
const options = [
  {
    id: 'burning-b',
    name: 'Burning B',
    character: 'A piece of the name.',
    rationale:
      'The wordmark’s opening letter becomes the icon. The closest family resemblance, with no second symbol to learn.',
    geometry: `<svg x="49" y="13" width="166" height="232" viewBox="-5 27 179 272"><g fill="PAINT" fill-rule="evenodd">${bPath}</g></svg>`
  },
  {
    id: 'strange-spark',
    name: 'Strange Spark',
    character: 'A little cosmic mischief.',
    rationale:
      'A lopsided flare with an off-center glint. Carries the celestial accents and unruly energy into one compact sign.',
    geometry:
      '<path fill="PAINT" d="M130 18 C137 73 154 88 210 53 C177 103 185 119 241 130 C185 139 176 158 207 207 C157 177 140 187 123 242 C116 189 98 176 45 210 C77 161 68 139 16 126 C74 117 86 98 55 46 C103 80 123 72 130 18 Z"/><path fill="CUT" d="M139 99 C141 116 148 122 166 126 C149 130 143 137 138 154 C133 137 128 131 111 127 C127 121 135 115 139 99 Z"/>'
  },
  {
    id: 'open-gate',
    name: 'Open Gate',
    character: 'Permission to step outside.',
    rationale:
      'An off-axis threshold opening into somewhere else. Quiet, architectural and strange without suggesting a coin or currency.',
    geometry:
      '<path fill="PAINT" d="M42 225 L66 93 C73 48 107 22 150 27 C194 31 219 65 211 110 L190 225 L158 225 L181 108 C186 79 173 60 147 57 C121 54 103 73 98 101 L76 225 Z"/><path fill="PAINT" d="M101 207 C140 212 174 204 218 186 L207 214 C172 231 125 238 85 228 Z"/>'
  },
  {
    id: 'oddling',
    name: 'Oddling',
    character: 'Someone strange is welcome.',
    rationale:
      'A mischievous artificial visitor with an ember-shaped silhouette. The most character-led direction, suited to little reactions and wayfinding.',
    geometry:
      '<path fill="PAINT" d="M64 204 C40 182 40 146 67 115 C91 87 115 75 108 29 C149 42 154 77 168 92 C183 73 188 56 184 40 C219 68 224 108 210 149 C216 189 186 221 145 228 C111 236 83 225 64 204 Z"/><path fill="CUT" d="M82 149 C78 135 91 125 102 135 C114 145 107 163 95 165 C89 165 85 159 82 149 Z M151 143 C145 130 156 117 167 124 C181 132 179 149 168 155 C160 159 155 152 151 143 Z"/>'
  }
]
const svg = (content: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">${defs}${content}</svg>`
for (const option of options) {
  for (const [variant, fill] of [
    ['sunset', 'url(#sunset)', ink],
    ['cream', cream, ink],
    ['ink', ink, cream]
  ]) {
    // Negative-space details use an alpha mask rather than a painted background.
    let body = option.geometry.replaceAll('PAINT', fill)
    const cutout = [...body.matchAll(/<path fill="CUT" d="([^"]+)"\/>/g)]
      .map((m) => `<path fill="black" d="${m[1]}"/>`)
      .join('')
    body = body.replace(/<path fill="CUT" d="[^"]+"\/>/g, '')
    const masked = cutout
      ? `<defs><mask id="negative"><rect width="256" height="256" fill="white"/>${cutout}</mask></defs><g mask="url(#negative)">${body}</g>`
      : body
    const content = svg(masked)
    await fs.writeFile(path.join(dir, `${option.id}-${variant}.svg`), content)
    await sharp(Buffer.from(content))
      .resize(512, 512)
      .png()
      .toFile(path.join(dir, `${option.id}-${variant}.png`))
  }
}
const font = (
  await fs.readFile(
    path.join(assets, 'fonts/spacegrotesk/SpaceGrotesk[wght].ttf')
  )
).toString('base64')
const wordmark = (
  await fs.readFile(path.join(assets, 'logos/wordmark-sunset.svg'))
).toString('base64')
const embed = async (file: string, x: number, y: number, w: number) =>
  `<image x="${x}" y="${y}" width="${w}" height="${w}" href="data:image/svg+xml;base64,${(await fs.readFile(path.join(dir, file))).toString('base64')}"/>`
const text = (
  x: number,
  y: number,
  s: string,
  size = 22,
  fill = cream,
  extra = ''
) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${s}</text>`
let board = `<rect width="1600" height="1150" fill="${ink}"/><image x="385" y="25" width="830" height="258" href="data:image/svg+xml;base64,${wordmark}"/>${text(800, 322, 'Leave your objective at the gate.', 34, cream, 'text-anchor="middle" font-weight="500" letter-spacing="-.5"')}${text(64, 405, 'Four companion icons. One strange retreat.', 30)}${text(1536, 405, 'EXPLORATION / NO ICON SELECTED', 14, gold, 'text-anchor="end" letter-spacing="1.4"')}`
for (let i = 0; i < options.length; i++) {
  const o = options[i]
  const x = 64 + i * 384
  if (i > 0)
    board += `<path d="M${x - 24} 451V1090" stroke="${cream}" stroke-opacity=".17"/>`
  board += await embed(`${o.id}-sunset.svg`, x + 44, 465, 245)
  board += text(x, 777, `${String.fromCharCode(65 + i)} / ${o.name}`, 30)
  board += text(x, 820, o.character, 18, gold)
  board += `<rect x="${x}" y="866" width="328" height="92" rx="0" fill="${cream}"/>`
  board += await embed(`${o.id}-ink.svg`, x + 129, 883, 58)
  board += text(x, 1001, '16 px', 16)
  board += await embed(`${o.id}-cream.svg`, x, 1020, 16)
  board += text(x + 80, 1001, '32 px', 16)
  board += await embed(`${o.id}-cream.svg`, x + 80, 1015, 32)
  board += text(x + 176, 1001, '48 px', 16)
  board += await embed(`${o.id}-cream.svg`, x + 176, 1009, 48)
}
const boardSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1150" viewBox="0 0 1600 1150"><style>@font-face{font-family:'Space Grotesk';src:url(data:font/ttf;base64,${font})}text{font-family:'Space Grotesk'}</style>${board}</svg>`
await fs.writeFile(path.join(dir, 'icon-options.svg'), boardSvg)
// Use the same local font configuration as the main brand exporter.
process.env.FONTCONFIG_FILE = path.join(assets, 'build/fontconfig.xml')
await sharp(Buffer.from(boardSvg))
  .png()
  .toFile(path.join(dir, 'icon-options.png'))
const cards = options
  .map(
    (o, i) =>
      `<article><div class="symbol"><img src="${o.id}-sunset.svg" alt="${o.name} icon" width="256" height="256"></div><h2>${String.fromCharCode(65 + i)} / ${o.name}</h2><p class="character">${o.character}</p><p>${o.rationale}</p><div class="light"><img src="${o.id}-ink.svg" width="64" height="64" alt="${o.name} on cream"></div><div class="sizes">${[16, 32, 48].map((s) => `<div><img src="${o.id}-cream.svg" width="${s}" height="${s}" alt="${o.name} at ${s} pixels"><span>${s} px</span></div>`).join('')}</div><nav aria-label="${o.name} files"><a href="${o.id}-sunset.svg" download>Sunset SVG</a><a href="${o.id}-cream.svg" download>Cream SVG</a><a href="${o.id}-ink.svg" download>Ink SVG</a></nav></article>`
  )
  .join('')
await fs.writeFile(
  path.join(dir, 'index.html'),
  `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Burning Tokens — icon directions</title><link rel="stylesheet" href="../../brand-assets/tokens.css"><style>*{box-sizing:border-box}html{color-scheme:dark}body{margin:0;background:var(--bt-ink);color:var(--bt-cream);font:400 16px/1.6 var(--bt-font-body)}header{max-width:1456px;margin:auto;padding:28px 32px 24px}header img{width:min(500px,90%);height:auto;margin:0 auto;display:block}.invitation{text-align:center;font-size:clamp(20px,2.2vw,30px);font-weight:500;letter-spacing:-.02em;margin:10px 0 32px;text-wrap:balance}h1{font-size:clamp(28px,4vw,44px);font-weight:500;letter-spacing:-.03em;margin:0}header p:last-child{margin:8px 0;color:var(--bt-gold)}main{max-width:1456px;margin:auto;padding:0 32px 48px;display:grid;grid-template-columns:repeat(4,1fr);gap:36px}article{min-width:0;border-top:1px solid #fff0cf44;padding-top:24px}.symbol{height:220px;display:grid;place-items:center}.symbol img{width:180px;height:180px}h2{font-size:26px;letter-spacing:-.02em;font-weight:500;margin:24px 0 0}.character{color:var(--bt-gold);margin-top:8px}article>p:not(.character){min-height:132px;max-width:33ch;color:#eee0c6}.light{background:var(--bt-cream);height:90px;display:grid;place-items:center}.sizes{height:102px;display:flex;gap:32px;align-items:end;margin:20px 0}.sizes div{display:flex;flex-direction:column;gap:10px;align-items:center}.sizes span{font-size:14px}nav{display:flex;flex-wrap:wrap;gap:8px 20px}a{color:var(--bt-gold);text-underline-offset:4px;min-height:44px;display:inline-flex;align-items:center}a:hover{color:var(--bt-cream)}a:focus-visible{outline:2px solid var(--bt-gold);outline-offset:5px}footer{max-width:1456px;padding:24px 32px 44px;margin:auto;border-top:1px solid #fff0cf44;display:flex;gap:28px;flex-wrap:wrap}::selection{background:var(--bt-coral);color:var(--bt-ink)}@media(max-width:1000px){main{grid-template-columns:repeat(2,1fr)}article>p:not(.character){min-height:100px}}@media(max-width:560px){header{padding:28px 22px}main{grid-template-columns:1fr;padding:0 22px 32px}.invitation{margin-bottom:38px}.symbol{height:210px}.symbol img{width:180px;height:180px}article>p:not(.character){min-height:0}.sizes{justify-content:space-evenly}.light{margin-top:24px}footer{padding-inline:22px}}</style></head><body><header><img src="../../brand-assets/logos/wordmark-sunset.svg" alt="Burning Tokens" width="1043" height="324"><p class="invitation">Leave your objective at the gate.</p><h1>Four companion icons.</h1><p>Exploration only. The ribbon is retired; a replacement is still open.</p></header><main>${cards}</main><footer><a href="icon-options.png">Open the comparison board</a><a href="../../brand-assets/">Back to the brand kit</a></footer></body></html>`
)
await fs.writeFile(
  path.join(dir, 'README.md'),
  `# Burning Tokens — icon options\n\nFour proposed replacements for the rejected ribbon mark. None is selected. The accepted name, lettering silhouette, colors, and illustrated world stay fixed.\n\n${options.map((o) => `## ${o.name}\n\n${o.rationale}\n\n[Sunset SVG](${o.id}-sunset.svg) · [Cream SVG](${o.id}-cream.svg) · [Ink SVG](${o.id}-ink.svg)`).join('\n\n')}\n\n[Comparison board](icon-options.png) · [Interactive reference](index.html). All icons use native geometry and transparent negative spaces. Rebuild after the main brand export using \`node docs/brand-exploration/icon-options/build-icons.ts\`. The Burning B is taken from the current smooth wordmark's letter-03 path; the other three are original native vector geometry in this script. Rendering uses the brand build's pinned sharp package.\n`
)
console.log(
  'Built four proposed icon directions, native colorways, small-size specimens and comparison page.'
)
