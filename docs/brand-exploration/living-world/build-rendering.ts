import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = dirname(fileURLToPath(import.meta.url))
const markdown = readFileSync(
  resolve(directory, 'rendering-options.md'),
  'utf8'
)
const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const safeHref = (value: string) => {
  if (/^(https?:|mailto:)/i.test(value)) return value
  if (!/^[a-z][a-z\d+.-]*:/i.test(value) && !value.startsWith('//'))
    return value
  throw new Error(`Unsupported link in rendering-options.md: ${value}`)
}

const inline = (value: string): string => {
  const pattern = /`([^`]+)`|\[([^\]]+)\]\(([^\s)]+)\)|\*\*([^*]+)\*\*/g
  let output = ''
  let position = 0
  for (const match of value.matchAll(pattern)) {
    output += escapeHtml(value.slice(position, match.index))
    if (match[1] !== undefined) output += `<code>${escapeHtml(match[1])}</code>`
    else if (match[2] !== undefined && match[3] !== undefined) {
      output += `<a href="${escapeHtml(safeHref(match[3]))}">${inline(match[2])}</a>`
    } else if (match[4] !== undefined)
      output += `<strong>${inline(match[4])}</strong>`
    position = match.index + match[0].length
  }
  return output + escapeHtml(value.slice(position))
}

const lines = markdown.replaceAll('\r\n', '\n').split('\n')
const blocks: string[] = []
const headings: { id: string; title: string }[] = []
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim())
const headingPattern = /^(#{1,6})\s+(.+)$/
const listPattern = /^(?:(\d+)\.|([-*]))\s+(.+)$/
const tableDivider = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?\s*$/
let position = 0
while (position < lines.length) {
  const line = lines[position]!
  if (!line.trim()) {
    position++
    continue
  }
  const heading = line.match(headingPattern)
  if (heading) {
    const level = heading[1]!.length
    const title = heading[2]!
    const id = title
      .toLowerCase()
      .replace(/[^a-z\d]+/g, '-')
      .replace(/^-|-$/g, '')
    if (level === 2) headings.push({ id, title })
    blocks.push(`<h${level} id="${id}">${inline(title)}</h${level}>`)
    position++
    continue
  }
  if (line.startsWith('```')) {
    position++
    const code: string[] = []
    while (position < lines.length && !lines[position]!.startsWith('```'))
      code.push(lines[position++]!)
    if (position >= lines.length)
      throw new Error('Unclosed code fence in rendering-options.md')
    position++
    blocks.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
    continue
  }
  if (line.includes('|') && tableDivider.test(lines[position + 1] ?? '')) {
    const labels = cells(line)
    position += 2
    const rows: string[][] = []
    while (position < lines.length && lines[position]!.trim().startsWith('|')) {
      const row = cells(lines[position++]!)
      if (row.length !== labels.length)
        throw new Error('Uneven table in rendering-options.md')
      rows.push(row)
    }
    blocks.push(
      `<div class="table-scroll" role="region" aria-label="${escapeHtml(labels.join(', '))} comparison" tabindex="0"><table><thead><tr>${labels.map((label) => `<th scope="col">${inline(label)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
    )
    continue
  }
  const list = line.match(listPattern)
  if (list) {
    const ordered = list[1] !== undefined
    const tag = ordered ? 'ol' : 'ul'
    const items: string[] = []
    while (position < lines.length) {
      const item = lines[position]!.match(listPattern)
      if (!item || (item[1] !== undefined) !== ordered) break
      items.push(`<li>${inline(item[3]!)}</li>`)
      position++
    }
    blocks.push(`<${tag}>${items.join('')}</${tag}>`)
    continue
  }
  const paragraph = [line]
  position++
  while (
    position < lines.length &&
    lines[position]!.trim() &&
    !headingPattern.test(lines[position]!) &&
    !listPattern.test(lines[position]!) &&
    !lines[position]!.startsWith('```') &&
    !tableDivider.test(lines[position + 1] ?? '')
  ) {
    paragraph.push(lines[position++]!)
  }
  blocks.push(`<p>${inline(paragraph.join('\n'))}</p>`)
}

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="description" content="How Burning Tokens can bring Moonclay Commons to life with layered scenery, independent clay creatures, and a crowd that scales.">
  <title>Moonclay rendering options · Burning Tokens</title>
  <link rel="stylesheet" href="../../brand-assets/tokens.css">
  <style>
    * { box-sizing: border-box }
    html { scroll-behavior: smooth; scroll-padding-top: 24px }
    body { margin: 0; background: var(--bt-ink, #151632); color: var(--bt-cream, #fff0cf); font: 400 17px/1.7 var(--bt-font-body, sans-serif) }
    a { color: var(--bt-gold, #ffcc83); text-underline-offset: 4px; text-decoration-thickness: 1px }
    a:hover { color: var(--bt-cream, #fff0cf) }
    a:focus-visible, [tabindex]:focus-visible { outline: 2px solid var(--bt-gold, #ffcc83); outline-offset: 5px }
    .shell { max-width: 1160px; padding: 24px 40px 56px; margin: 0 auto }
    header { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding-bottom: 24px; border-bottom: 1px solid #fff0cf30 }
    .brand { display: block; width: 180px; flex-shrink: 0; line-height: 0 }
    .brand img { width: 100%; height: auto }
    header nav { display: flex; gap: 24px; flex-wrap: wrap; font-size: 14px }
    header nav a { display: inline-flex; align-items: center; min-height: 44px }
    .skip { position: absolute; left: 20px; top: -80px; padding: 10px 18px; background: #fff0cf; color: #151632 }
    .skip:focus { top: 12px; color: #151632 }
    .eyebrow { color: var(--bt-gold, #ffcc83); font-size: 13px; margin: 32px 0 12px }
    .contents { border-bottom: 1px solid #fff0cf30; padding-bottom: 24px; margin-bottom: 30px; font-size: 14px; display: flex; gap: 8px 24px; flex-wrap: wrap }
    h1 { margin: 0 0 24px; max-width: 22ch; font-size: clamp(34px, 5vw, 56px); line-height: 1.08; letter-spacing: -.04em; font-weight: 500 }
    h2 { margin: 48px 0 18px; font-size: 28px; line-height: 1.2; letter-spacing: -.025em; font-weight: 500 }
    h3 { margin: 32px 0 14px; font-size: 21px; line-height: 1.3; font-weight: 500 }
    p { max-width: 78ch; margin: 0 0 20px; color: #d6ced0 }
    strong { color: var(--bt-cream, #fff0cf); font-weight: 600 }
    ul, ol { max-width: 78ch; padding-left: 26px; margin: 18px 0 26px; color: #d6ced0 }
    li { padding-left: 5px; margin-bottom: 9px }
    code { font-family: monospace; font-size: .9em; overflow-wrap: anywhere }
    pre { overflow-x: auto; padding: 20px; background: #111328 }
    .table-scroll { overflow-x: auto; margin: 26px 0; border: 1px solid #fff0cf30; border-radius: 6px }
    table { width: 100%; min-width: 680px; border-collapse: collapse; font-size: 14px; line-height: 1.6; text-align: left }
    th { color: var(--bt-gold, #ffcc83); font-weight: 500; background: #111328 }
    th, td { padding: 15px 18px; vertical-align: top; border-bottom: 1px solid #fff0cf24 }
    td { color: #d6ced0 }
    tr:last-child td { border-bottom: 0 }
    th:first-child, td:first-child { width: 21%; color: var(--bt-cream, #fff0cf) }
    footer { display: flex; flex-wrap: wrap; gap: 16px 28px; border-top: 1px solid #fff0cf30; padding-top: 24px; margin-top: 44px; font-size: 14px }
    @media (max-width: 640px) { .shell { padding: 18px 20px 36px } body { font-size: 16px } header { gap: 14px } .brand { width: 140px } header nav { gap: 4px; justify-content: flex-end } header nav a { min-height: 36px; text-align: right } h2 { font-size: 24px } .contents { gap: 8px 18px } th, td { padding: 12px 14px } }
    @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto } }
  </style>
</head>
<body>
  <a class="skip" href="#reading">Skip to the recommendation</a>
  <div class="shell">
    <header>
      <a class="brand" href="../../brand-assets/" aria-label="Burning Tokens brand kit"><img src="../../brand-assets/logos/wordmark-sunset.svg" alt="Burning Tokens" width="180" height="91"></a>
      <nav aria-label="Study navigation"><a href="./dynamics/">← Explore the living scene</a><a href="rendering-options.md">Read Markdown source ↗</a></nav>
    </header>
    <p class="eyebrow">Moonclay Commons · rendering study</p>
    <nav class="contents" aria-label="On this page">${headings.map((heading) => `<a href="#${heading.id}">${escapeHtml(heading.title)}</a>`).join('')}</nav>
    <main id="reading">${blocks.join('\n')}</main>
    <footer><a href="./dynamics/">← Back to the living scene</a><a href="rendering-options.md">Markdown source</a><a href="index.html">Selected artwork</a></footer>
  </div>
</body>
</html>
`

writeFileSync(resolve(directory, 'rendering-options.html'), html)
console.log(`Built rendering-options.html from ${lines.length} Markdown lines`)
