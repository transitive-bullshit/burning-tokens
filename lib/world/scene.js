import {
  createPopulation,
  chooseVisible,
  createMotion,
  stepMotion
} from './crowd.js'
import { loadWorldPreferences, saveWorldPreferences } from './preferences.js'
import { createPhysics } from './physics.js'
import { DETAIL_ROOMS } from './room-details.js'
import { getRoomPose } from './room-acting.js'
import { createRoomEffects } from './room-effects.js'
import { createSceneSound } from './scene-sound.js'
import { createSoundReviewPreferences } from './review-preferences.js'
import SOUND_CATALOG from './sound-catalog.json'
import SOUND_REVIEW_SNAPSHOT from './feedback.json'
const ROOM_SCENES = [
  'bathhouse',
  'dream-garden',
  'quiet-house',
  'source',
  'open-studio',
  'hearth',
  'temple'
]
export function mountWorld(root, initialScene, navigate, options = {}) {
  let disposed = false
  const listeners = new AbortController()
  const listen = (target, event, callback) =>
    target.addEventListener(event, callback, { signal: listeners.signal })
  const $ = (id) => root.querySelector(`#${id}`)
  const W = 1536
  const H = 1024
  const FAMILY = [
    'Loopseed · GPT',
    'Sunbud · Claude',
    'Prism · Gemini',
    'Braid · Llama',
    'Cairn · Mistral',
    'Tide · DeepSeek',
    'Comet · Grok',
    'Oddseed · independent'
  ]
  const COLORS = [
    '#bde1d5',
    '#ff9872',
    '#d6b8f2',
    '#839fe8',
    '#efbc69',
    '#65b6dd',
    '#9c9aa7',
    '#efdec0'
  ]
  const ROOMS = [
    'Bathhouse',
    'Dream Garden',
    'Quiet House',
    'The Source',
    'Open Studio',
    'Hearth',
    'Temple'
  ]
  const roomAnchors = [
    [0.24, 0.26],
    [0.69, 0.19],
    [0.814, 0.361],
    [0.832, 0.59],
    [0.649, 0.66],
    [0.338, 0.67],
    [0.169, 0.519]
  ]
  const campZones = [
    {
      key: 'baths',
      room: 0,
      cx: 0.22,
      cy: 0.202,
      rx: 0.105,
      ry: 0.026,
      wet: true
    },
    { key: 'bath-path', room: 0, cx: 0.284, cy: 0.315, rx: 0.09, ry: 0.027 },
    { key: 'garden', room: 1, cx: 0.665, cy: 0.231, rx: 0.074, ry: 0.03 },
    { key: 'garden-path', room: 1, cx: 0.566, cy: 0.281, rx: 0.058, ry: 0.025 },
    { key: 'quiet', room: 2, cx: 0.825, cy: 0.338, rx: 0.058, ry: 0.023 },
    {
      key: 'source',
      room: 3,
      cx: 0.837,
      cy: 0.516,
      rx: 0.049,
      ry: 0.016,
      wet: true
    },
    { key: 'source-path', room: 3, cx: 0.753, cy: 0.627, rx: 0.063, ry: 0.025 },
    { key: 'studio', room: 4, cx: 0.625, cy: 0.653, rx: 0.072, ry: 0.027 },
    { key: 'hearth', room: 5, cx: 0.324, cy: 0.654, rx: 0.079, ry: 0.027 },
    { key: 'temple', room: 6, cx: 0.163, cy: 0.449, rx: 0.066, ry: 0.023 }
  ].map((zone) => ({ ...zone, rx: zone.rx * 1.2, ry: zone.ry * 1.2 }))
  // Authored front-edge clips reuse the unmodified plate as foreground scenery.
  // They establish the layering technique; production needs detailed depth exports.
  const roomDetails = DETAIL_ROOMS
  const campRims = [
    [
      [0.105, 0.213],
      [0.133, 0.23],
      [0.205, 0.242],
      [0.272, 0.223],
      [0.33, 0.194],
      [0.337, 0.211],
      [0.283, 0.252],
      [0.213, 0.265],
      [0.128, 0.247],
      [0.106, 0.233]
    ],
    [
      [0.797, 0.533],
      [0.82, 0.55],
      [0.853, 0.55],
      [0.89, 0.525],
      [0.902, 0.537],
      [0.88, 0.566],
      [0.825, 0.578],
      [0.792, 0.55]
    ]
  ]
  // Texture masks are a prototype rendering aid, not finished alpha sprite assets.
  // Coordinates refer to equal 384 × 512 cells in the generated atlas.
  const contours = [
    'M 89 465 C 18 409 20 327 54 256 C 100 161 169 94 249 87 C 297 82 337 96 342 132 C 353 177 306 218 262 248 C 297 253 340 270 364 313 C 390 355 378 406 343 437 C 306 476 245 488 183 487 C 144 488 111 482 89 465 Z',
    'M 132 477 C 105 475 103 444 106 424 C 79 441 48 426 54 398 L 73 348 C 41 354 23 336 30 313 C 38 294 60 294 79 281 C 39 264 22 236 32 219 C 40 195 74 205 107 220 C 120 199 136 191 154 185 C 136 143 153 106 178 96 C 202 85 222 104 215 127 C 208 147 236 148 232 192 C 275 184 322 203 330 232 C 344 238 371 265 366 287 C 361 309 340 315 326 311 C 332 333 347 359 332 378 C 317 395 291 387 282 378 C 282 404 307 425 296 455 C 286 480 254 478 225 462 C 202 468 168 472 151 463 C 149 475 140 479 132 477 Z',
    'M 190 104 C 191 87 211 88 221 106 C 235 127 233 156 236 175 C 251 215 299 226 337 241 C 361 244 372 259 356 274 C 339 292 295 292 272 304 C 252 321 248 345 238 375 C 235 397 220 411 206 391 C 190 363 186 335 172 317 C 144 302 112 296 87 291 C 62 286 15 272 21 251 C 25 235 62 237 84 227 C 124 211 159 179 176 145 C 187 127 193 117 190 104 Z M 326 302 A 18 19 0 1 0 327 341 A 18 19 0 1 0 326 302 Z M 210 419 A 18 18 0 1 0 211 455 A 18 18 0 1 0 210 419 Z',
    'M 71 450 C 31 420 27 378 38 347 C 28 329 21 311 38 289 C 16 267 25 239 44 224 C 26 201 41 172 64 165 C 60 136 82 125 103 120 C 112 94 138 91 157 102 C 175 80 204 82 216 98 C 242 97 260 119 249 145 C 262 158 257 183 239 195 C 259 226 302 238 312 269 C 330 303 317 347 296 365 C 327 361 353 372 359 401 C 371 434 353 467 326 475 C 299 487 278 474 257 461 C 231 471 216 475 199 463 C 169 475 149 482 134 468 C 111 480 93 468 71 450 Z',
    'M 37 346 C 36 322 52 302 69 292 L 73 262 L 103 233 C 86 215 97 188 121 176 L 133 146 L 164 140 L 175 90 L 204 66 L 233 27 L 267 24 L 284 55 L 287 96 L 311 112 L 325 144 L 312 181 C 343 190 368 232 367 260 C 364 292 331 322 301 337 L 297 366 C 320 377 326 394 311 402 L 269 405 C 248 401 250 383 252 370 L 218 358 L 177 371 L 157 388 C 145 411 119 411 91 402 C 68 391 96 371 108 360 L 75 365 Z',
    'M 138 403 C 85 392 35 348 40 294 C 36 263 59 234 55 209 C 38 169 61 127 85 100 C 118 52 172 21 223 28 C 266 29 294 48 280 80 C 265 109 221 119 197 137 C 225 136 254 155 266 182 C 285 217 267 244 260 266 C 287 250 305 211 326 201 C 348 185 378 207 376 230 C 377 260 350 271 337 282 C 344 321 326 358 291 382 C 252 409 188 416 138 403 Z',
    'M 83 395 C 58 380 23 351 22 322 C 18 294 38 276 40 253 C 7 230 26 196 57 197 C 74 178 92 168 119 162 C 100 139 116 116 138 116 C 163 128 187 115 201 95 C 215 74 230 20 252 21 C 284 22 280 51 266 69 C 280 90 274 118 257 139 C 272 164 288 197 286 223 C 280 256 262 286 246 309 C 275 297 291 283 309 279 C 330 271 351 287 348 307 C 346 327 321 335 316 351 C 314 375 289 397 267 403 C 203 419 128 410 83 395 Z',
    'M 95 399 C 77 391 82 372 87 361 C 65 343 41 320 39 289 C 33 255 48 225 68 205 C 53 191 40 175 46 157 C 54 141 74 148 77 166 L 96 178 C 110 157 132 144 148 137 C 131 117 115 86 100 73 C 80 76 68 57 79 43 C 94 29 111 43 107 56 C 120 87 137 109 164 115 C 169 82 172 61 168 47 C 150 35 153 14 170 14 C 191 10 197 35 185 47 C 180 78 184 105 196 117 C 215 108 227 89 232 67 C 217 51 228 35 245 39 C 267 44 262 66 248 73 L 238 123 C 261 127 281 145 293 165 C 309 164 321 155 331 141 C 332 123 350 119 355 135 C 361 151 347 163 334 160 L 309 181 C 327 207 340 241 331 276 C 320 313 296 344 268 358 C 290 373 277 394 260 396 C 240 400 230 387 228 376 C 182 389 140 382 121 372 C 117 390 110 402 95 399 Z'
  ]
  const EFFECT_DEFAULTS = Object.freeze({
    bathhouse: 100,
    'dream-garden': 400,
    'quiet-house': 250,
    source: 225,
    'open-studio': 100,
    hearth: 100,
    temple: 100
  })
  const BATHHOUSE_DEFAULTS = Object.freeze({ waterfalls: 315, waves: 150 })
  const preferences = loadWorldPreferences()
  const state = {
    count: preferences.count,
    scene: initialScene,
    mode: preferences.mode,
    court: 0,
    selectedId: null,
    scenery: true,
    creatures: true,
    effects: true,
    effectStrengths: { ...EFFECT_DEFAULTS },
    bathhouseStrengths: { ...BATHHOUSE_DEFAULTS },
    occlusion: true,
    guides: false,
    paused: matchMedia('(prefers-reduced-motion: reduce)').matches,
    page: 0,
    search: ''
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const canvas = $('world')
  const ctx = canvas.getContext('2d', { alpha: false })
  let population = options.live ? [] : createPopulation(state.count)
  let trackedTotal = 0
  let selection
  let actors = []
  let hitBoxes = []
  let textures = []
  let textureBounds = []
  let sheenTextures = []
  const contactShadow = makeContactShadow()
  const roomEffects = createRoomEffects({ width: W, height: H })
  let images
  let assetsFailed = false
  let physics
  let physicsActive = false
  let grabOffset = null
  let elapsed = 0
  let lastTime = 0
  let scheduled = 0
  const transform = { scale: 1, x: 0, y: 0 }
  let sceneSound
  const soundReview = createSoundReviewPreferences({
    onChange: (exclusions) => sceneSound?.setExclusions(exclusions)
  })
  soundReview.applySnapshot(SOUND_REVIEW_SNAPSHOT, SOUND_CATALOG.reviewRevision)
  soundReview.migrateFamilies(SOUND_CATALOG.retiredFamilies)
  sceneSound = createSceneSound({
    root,
    catalog: SOUND_CATALOG,
    initialExclusions: soundReview.getExclusions(),
    getScene: () => state.scene,
    getPaused: () => state.paused,
    getScenery: () => state.scenery,
    getActors: () => (state.creatures ? actors : [])
  })
  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = src
    })
  function makeTextures(atlas) {
    textureBounds = []
    return contours.map((contour, i) => {
      const texture = document.createElement('canvas')
      texture.width = 192
      texture.height = 256
      const context = texture.getContext('2d')
      context.scale(0.5, 0.5)
      context.clip(new Path2D(contour))
      context.drawImage(
        atlas,
        (i % 4) * 384,
        Math.floor(i / 4) * 512,
        384,
        512,
        0,
        0,
        384,
        512
      )
      // Measure the authored prototype mask once; atlas cells have different foot baselines.
      // This does not turn the approximate contour masks into production alpha assets.
      const pixels = context.getImageData(
        0,
        0,
        texture.width,
        texture.height
      ).data
      let left = texture.width
      let top = texture.height
      let right = -1
      let bottom = -1
      for (let y = 0; y < texture.height; y++) {
        for (let x = 0; x < texture.width; x++) {
          if (pixels[(y * texture.width + x) * 4 + 3] < 128) continue
          left = Math.min(left, x)
          top = Math.min(top, y)
          right = Math.max(right, x)
          bottom = Math.max(bottom, y)
        }
      }
      textureBounds.push(
        right >= left
          ? {
              left: left / texture.width,
              top: top / texture.height,
              right: (right + 1) / texture.width,
              bottom: (bottom + 1) / texture.height
            }
          : { left: 0, top: 0, right: 1, bottom: 1 }
      )
      return texture
    })
  }
  function makeContactShadow() {
    const shadow = document.createElement('canvas')
    shadow.width = 64
    shadow.height = 64
    const context = shadow.getContext('2d')
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, '#090b2480')
    gradient.addColorStop(0.35, '#090b245c')
    gradient.addColorStop(1, '#090b2400')
    context.fillStyle = gradient
    context.fillRect(0, 0, 64, 64)
    return shadow
  }
  function makeSheenTextures() {
    return textures.map((texture) => {
      const sheen = document.createElement('canvas')
      sheen.width = texture.width
      sheen.height = texture.height
      const context = sheen.getContext('2d')
      const gradient = context.createLinearGradient(
        0,
        0,
        sheen.width,
        sheen.height
      )
      gradient.addColorStop(0, '#ffe9fc00')
      gradient.addColorStop(0.32, '#ffe9fc00')
      gradient.addColorStop(0.49, '#fff4edee')
      gradient.addColorStop(0.57, '#ffc0e577')
      gradient.addColorStop(0.78, '#ffe9fc00')
      context.fillStyle = gradient
      context.fillRect(0, 0, sheen.width, sheen.height)
      context.globalCompositeOperation = 'destination-in'
      context.drawImage(texture, 0, 0)
      return sheen
    })
  }
  function currentDetail() {
    return roomDetails[state.scene] ?? null
  }
  function effectIntensity() {
    return currentDetail() ? state.effectStrengths[state.scene] / 100 : 1
  }
  function applyEffectStrengths() {
    roomEffects.setIntensity(effectIntensity())
    roomEffects.setBathhouseStrengths({
      waterfalls: state.bathhouseStrengths.waterfalls / 100,
      waves: state.bathhouseStrengths.waves / 100
    })
  }
  function baseZones() {
    return currentDetail()?.zones ?? campZones
  }
  function baseRims() {
    return currentDetail()?.rims ?? campRims
  }
  function sectionName() {
    return state.scene === 'bathhouse' ? 'Courtyard' : 'Section'
  }
  function switchScene(scene) {
    if (scene !== state.scene && (scene === 'camp' || roomDetails[scene]))
      navigate(scene)
  }
  function updateSelection() {
    if (grabOffset) finishDrag()
    sceneSound.resetInteraction()
    physics?.dispose()
    physicsActive = false
    const previous = new Map(actors.map((a) => [a.visitor.id, a]))
    selection = chooseVisible(population, {
      scene: state.scene,
      mode: state.mode,
      court: state.court,
      limit: innerWidth < 760 ? 24 : 60,
      selectedId: state.selectedId
    })
    state.court = Math.min(state.court, selection.courts - 1)
    actors = createMotion(selection.visible, baseZones()).map((actor) => {
      const old = previous.get(actor.visitor.id)
      const oldZone =
        old && baseZones().find((zone) => zone.key === old.zone.key)
      return oldZone && old.visitor.room === actor.visitor.room
        ? {
            ...actor,
            zone: oldZone,
            rowIndex: old.rowIndex,
            rowSpacing: old.rowSpacing,
            homeRangeX: old.homeRangeX,
            homeRangeY: old.homeRangeY,
            x: old.x,
            y: old.y,
            homeX: old.homeX,
            homeY: old.homeY,
            targetX: old.targetX,
            targetY: old.targetY,
            moving: old.moving,
            cycle: old.cycle
          }
        : actor
    })
    physics = createPhysics(actors, {
      width: W,
      height: H,
      radius: creatureSize() * 0.22,
      zones: baseZones(),
      allowZoneTransfer: true
    })
    renderControls()
    renderRoster()
    renderInspection()
    draw()
    requestFrame()
  }
  function renderControls() {
    const detail = currentDetail()
    const area = detail?.name ?? 'the camp'
    const section = sectionName()
    $('population-value').value = String(state.count)
    $('population').value = String(state.count)
    $('population').disabled = Boolean(options.live)
    $('population').hidden = Boolean(options.live)
    for (const element of $('population')
      .closest('.control-block')
      .querySelectorAll('.control-title, .range-labels, .presets'))
      element.hidden = Boolean(options.live)
    for (const button of root.querySelectorAll('[data-count]'))
      button.disabled = Boolean(options.live)
    $('camp').disabled = !detail
    $('room-select').value = state.scene
    for (const button of root.querySelectorAll('[data-room-study]'))
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.roomStudy === state.scene)
      )
    for (const name of ['summary', 'full'])
      $(name).setAttribute('aria-pressed', String(state.mode === name))
    for (const button of root.querySelectorAll('[data-count]'))
      button.setAttribute(
        'aria-pressed',
        String(Number(button.dataset.count) === state.count)
      )
    $('scene-title').textContent = detail?.name ?? 'Camp Overview'
    canvas.setAttribute(
      'aria-label',
      `${detail?.name ?? 'Moonclay camp overview'} with individually selectable ${options.live ? 'live visitors; motion is illustrative' : 'example visitors'}`
    )
    $('shown').textContent =
      state.creatures && images ? selection.visible.length : 0
    $('eligible').textContent = options.live
      ? trackedTotal
      : selection.eligible.length
    $('eligible-label').textContent = `at ${area}`
    const count = state.creatures && images ? selection.visible.length : 0
    $('canvas-count').textContent =
      `${count} shown / ${selection.eligible.length} in ${area.replace(/^the /i, '')} · ${state.mode === 'summary' ? 'summary' : 'full view'}`
    if (options.live)
      $('canvas-count').textContent =
        `${count} shown · ${trackedTotal} public visits tracked · ${state.mode === 'summary' ? 'summary' : 'full view'}`
    if (assetsFailed)
      $('canvas-count').textContent =
        'Scene assets could not load. The visitor list is still available.'
    const sections = detail && state.mode === 'full'
    $('court-nav').hidden = !sections
    $('court-nav').setAttribute(
      'aria-label',
      `${area} ${section.toLowerCase()} navigation`
    )
    $('court-label').textContent =
      `${section} ${state.court + 1} of ${selection.courts}`
    $('previous-court').setAttribute(
      'aria-label',
      `Previous ${section.toLowerCase()}`
    )
    $('next-court').setAttribute('aria-label', `Next ${section.toLowerCase()}`)
    $('previous-court').disabled = state.court === 0
    $('next-court').disabled = state.court >= selection.courts - 1
    $('scope-note').textContent =
      !detail && selection.eligible.length > selection.visible.length
        ? `Up to ${state.mode === 'full' ? 300 : innerWidth < 760 ? 24 : 60} creatures in view.`
        : ''
    if (options.live)
      root.querySelector('.roster-heading span').textContent =
        'Sampled visitors'
    $('pause').textContent = state.paused ? 'Resume motion' : 'Pause motion'
    $('pause').setAttribute('aria-pressed', String(state.paused))
    const allCounts = Array(7).fill(0)
    population.forEach((visitor) => allCounts[visitor.room]++)
    $('room-links').replaceChildren()
    if (!detail)
      ROOMS.forEach((room, index) => {
        const button = document.createElement('button')
        button.className = 'hotspot'
        button.style.left = `${roomAnchors[index][0] * 100}%`
        button.style.top = `${roomAnchors[index][1] * 100}%`
        button.append(document.createTextNode(room))
        const countLabel = document.createElement('b')
        countLabel.textContent = String(allCounts[index])
        button.append(countLabel)
        button.setAttribute(
          'aria-label',
          `Explore ${room}, ${allCounts[index]} example visitors`
        )
        button.onclick = () => switchScene(ROOM_SCENES[index], true)
        $('room-links').append(button)
      })
  }
  function renderRoster() {
    const focusedVisitor =
      document.activeElement?.getAttribute('data-visitor-id')
    const filtered = selection.eligible.filter((v) =>
      `${v.label} ${FAMILY[v.family]}`
        .toLowerCase()
        .includes(state.search.toLowerCase())
    )
    const pages = Math.max(1, Math.ceil(filtered.length / 12))
    state.page = Math.min(state.page, pages - 1)
    $('roster').replaceChildren()
    for (const visitor of filtered.slice(
      state.page * 12,
      (state.page + 1) * 12
    )) {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.visitorId = visitor.id
      button.setAttribute(
        'aria-pressed',
        String(visitor.id === state.selectedId)
      )
      button.setAttribute(
        'aria-label',
        `Inspect ${visitor.label}, ${FAMILY[visitor.family]}`
      )
      const dot = document.createElement('span')
      dot.className = 'dot'
      dot.style.background = COLORS[visitor.family]
      const label = document.createElement('span')
      label.textContent = visitor.label
      const small = document.createElement('small')
      small.textContent = FAMILY[visitor.family]
      label.append(small)
      button.append(dot, label)
      button.onclick = () => selectVisitor(visitor)
      $('roster').append(button)
    }
    if (!filtered.length) {
      const p = document.createElement('p')
      p.textContent =
        state.count === 0
          ? 'No visitors. The camp is still open.'
          : 'No matching visitors.'
      p.style.cssText = 'font-size:11px;color:var(--muted);padding:10px 4px'
      $('roster').append(p)
    }
    $('page-label').textContent =
      `${filtered.length} visitors · ${state.page + 1} / ${pages}`
    $('previous-page').disabled = state.page === 0
    $('next-page').disabled = state.page === pages - 1
    if (focusedVisitor)
      (
        $('roster').querySelector(
          `[data-visitor-id="${CSS.escape(focusedVisitor)}"]`
        ) ?? $('search')
      ).focus({ preventScroll: true })
  }
  function renderInspection() {
    const focused = $('inspection').contains(document.activeElement)
      ? document.activeElement
      : null
    const focusAttribute = [
      'data-nudge',
      'data-voice-event',
      'data-follow-visitor'
    ].find((attribute) => focused?.hasAttribute(attribute))
    const restoreFocus = () => {
      if (!focused) return
      const replacement = focusAttribute
        ? $('inspection').querySelector(
            `[${focusAttribute}="${CSS.escape(focused.getAttribute(focusAttribute))}"]`
          )
        : null
      const fallback = $('search').getClientRects().length
        ? $('search')
        : $('pause')
      ;(replacement ?? fallback).focus({ preventScroll: true })
    }
    const visitor = population.find((v) => v.id === state.selectedId)
    if (!visitor) {
      $('inspection').innerHTML =
        '<h3>Meet a little wanderer.</h3><p>Select a creature to meet it.</p>'
      restoreFocus()
      return
    }
    const inView =
      selection.visible.some((v) => v.id === visitor.id) && state.creatures
    $('inspection').innerHTML =
      `<h3>${visitor.label} · ${inView ? 'in view' : 'outside this view'}</h3><p><b>${FAMILY[visitor.family]}</b><br>${options.live ? 'Last observed room' : 'Demo observation'}: ${ROOMS[visitor.room]}<br>${ROOMS[visitor.room]} ${visitor.room === 0 ? 'courtyard' : 'section'} ${visitor.court + 1}.</p>${inView ? '<div class="nudge" aria-label="Move selected creature"><span>Nudge</span><button data-nudge="left" aria-label="Nudge selected creature left">←</button><button data-nudge="up" aria-label="Nudge selected creature up">↑</button><button data-nudge="down" aria-label="Nudge selected creature down">↓</button><button data-nudge="right" aria-label="Nudge selected creature right">→</button></div>' : ''}`
    if (options.live && options.onFollow) {
      const follow = document.createElement('button')
      follow.type = 'button'
      follow.textContent = 'Follow this visitor'
      follow.dataset.followVisitor = visitor.id
      follow.onclick = () => options.onFollow(visitor.id)
      $('inspection').append(follow)
    }
    for (const button of $('inspection').querySelectorAll('[data-nudge]'))
      button.onclick = () => {
        const moves = {
          left: [-12, 0],
          right: [12, 0],
          up: [0, -6],
          down: [0, 6]
        }
        nudgeVisitor(...moves[button.dataset.nudge])
      }
    restoreFocus()
  }
  function selectVisitor(visitor) {
    state.selectedId = visitor.id
    if (selection.visible.some((v) => v.id === visitor.id)) {
      renderRoster()
      renderInspection()
      draw()
      return
    }
    if (currentDetail() && state.mode === 'full') state.court = visitor.court
    updateSelection()
  }
  function nudgeVisitor(dx, dy) {
    const actor = actors.find((a) => a.visitor.id === state.selectedId)
    if (!actor || !physics || !state.creatures) return
    sceneSound.nudge(actor.visitor, actor.x)
    physics.grab(actor.visitor.id)
    physics.move(actor.x + dx / W, actor.y + dy / H)
    physicsActive = physics.step(0)
    const drop = physics.release()
    settleWhenPaused()
    describeDrop(actor.visitor, drop)
    draw()
    requestFrame()
  }
  function describeDrop(visitor, drop) {
    $('scene-caption').textContent = drop?.landing
      ? `${visitor.label} settles onto the nearest surface.`
      : `${visitor.label} moved${drop?.transferred ? ' to another area' : ''}.`
  }
  function creatureSize() {
    const count = selection?.visible.length ?? 0
    if (currentDetail())
      return state.mode === 'summary' || count <= 24
        ? 112
        : Math.max(62, 120 - Math.sqrt(count) * 5.8)
    return state.mode === 'full'
      ? Math.max(22, 48 - Math.sqrt(count) * 0.82)
      : 48
  }
  function polygon(points) {
    ctx.beginPath()
    points.forEach(([x, y], i) =>
      i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)
    )
    ctx.closePath()
  }
  function ellipse(x, y, rx, ry, fill, stroke) {
    ctx.beginPath()
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
    if (fill) {
      ctx.fillStyle = fill
      ctx.fill()
    }
    if (stroke) {
      ctx.strokeStyle = stroke
      ctx.stroke()
    }
  }
  function drawLights() {
    for (const [index, light] of (currentDetail()?.lights ?? []).entries()) {
      const x = light.x * W,
        y = light.y * H
      const radius = light.r * W
      if (!Number.isFinite(radius) || radius <= 0) continue
      ctx.save()
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, light.color)
      gradient.addColorStop(1, 'transparent')
      ctx.globalAlpha =
        Math.min(0.08, Math.max(0, light.opacity ?? 0.05)) *
        (0.85 + 0.15 * Math.sin(elapsed * 0.7 + index)) *
        effectIntensity()
      ctx.fillStyle = gradient
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
      ctx.restore()
    }
  }
  function drawWater() {
    if (currentDetail()?.vibe?.water) return
    for (const zone of baseZones().filter((z) => z.wet)) {
      ctx.save()
      ctx.beginPath()
      ctx.ellipse(
        zone.cx * W,
        zone.cy * H,
        zone.rx * W * 1.04,
        zone.ry * H * 1.2,
        0,
        0,
        Math.PI * 2
      )
      ctx.clip()
      ctx.lineWidth = 0.8
      for (let i = 0; i < 7; i++) {
        const phase = (elapsed * 0.08 + i * 0.16) % 1
        ellipse(
          zone.cx * W + Math.sin(i * 2.4) * zone.rx * W * 0.45,
          zone.cy * H + Math.cos(i * 3.1) * zone.ry * H * 0.55,
          12 + phase * 38,
          2 + phase * 6,
          null,
          `rgba(255,229,166,${Math.min(1, (1 - phase) * 0.19 * effectIntensity())})`
        )
      }
      ctx.restore()
    }
  }
  function drawActor(actor) {
    const x = actor.x * W,
      y = actor.y * H
    const size = creatureSize()
    const held = physics?.heldId === actor.visitor.id
    const airborne = held || actor.landing > 0
    const pose = getRoomPose(actor, elapsed, state.scene)
    const breathe = pose ? 1 : 1 + Math.sin(elapsed * 1.7 + actor.phase) * 0.012
    const wobble =
      pose?.rotation ??
      (actor.moving ? Math.sin(elapsed * 6 + actor.phase) * 0.025 : 0)
    const wet = actor.zone.wet
    const bodyBounds = textureBounds[actor.visitor.family]
    const bodyWidth = size * 0.75
    const bodyLeft = -bodyWidth / 2
    const bodyTop = -bodyBounds.bottom * size
    const scaleX = pose?.scaleX ?? 1 / breathe
    const scaleY = pose?.scaleY ?? breathe
    const lift = held
      ? Math.max(10, size * 0.14)
      : actor.landing > 0
        ? Math.max(10, size * 0.14) * actor.landing
        : pose
          ? pose.lift * size
          : actor.moving
            ? Math.abs(Math.sin(elapsed * 6 + actor.phase)) * 1.4
            : 0
    drawSelectionRing(actor, size)
    const shadowWidth = size * (airborne ? 0.66 : 0.49)
    const shadowHeight = size * (airborne ? 0.16 : 0.13)
    ctx.save()
    ctx.globalAlpha = airborne ? 0.6 : wet ? 0.55 : 0.9
    ctx.drawImage(
      contactShadow,
      x - shadowWidth / 2,
      y + 2 - shadowHeight / 2,
      shadowWidth,
      shadowHeight
    )
    ctx.restore()
    if (state.effects && effectIntensity() > 0)
      roomEffects.drawActorBack(ctx, actor, size, pose, elapsed)
    ctx.save()
    ctx.translate(x, y - lift)
    ctx.rotate(wobble)
    ctx.scale(scaleX, scaleY)
    if (wet && state.occlusion && !airborne) {
      ctx.beginPath()
      ctx.rect(-size, -size * 1.1, size * 2, size * 1.075)
      ctx.clip()
    }
    ctx.drawImage(
      textures[actor.visitor.family],
      bodyLeft,
      bodyTop,
      bodyWidth,
      size
    )
    if (
      state.effects &&
      effectIntensity() > 0 &&
      pose?.receive > 0 &&
      !airborne
    ) {
      ctx.globalAlpha = Math.min(1, pose.receive * 0.65 * effectIntensity())
      ctx.drawImage(
        sheenTextures[actor.visitor.family],
        bodyLeft,
        bodyTop,
        bodyWidth,
        size
      )
    }
    ctx.restore()
    if (
      wet &&
      state.scene !== 'bathhouse' &&
      state.effects &&
      effectIntensity() > 0 &&
      !airborne
    ) {
      ctx.lineWidth = 1.1
      ellipse(
        x,
        y - size * 0.021,
        size * 0.2,
        size * 0.049,
        null,
        `rgba(208,241,223,${Math.min(1, (117 / 255) * effectIntensity())})`
      )
    }
    const localLeft = bodyLeft + bodyBounds.left * bodyWidth
    const localRight = bodyLeft + bodyBounds.right * bodyWidth
    const localTop = bodyTop + bodyBounds.top * size
    const localBottom = wet && state.occlusion && !airborne ? -size * 0.025 : 0
    const cosine = Math.cos(wobble)
    const sine = Math.sin(wobble)
    const corners = [
      [localLeft, localTop],
      [localRight, localTop],
      [localRight, localBottom],
      [localLeft, localBottom]
    ].map(([localX, localY]) => ({
      x: x + localX * scaleX * cosine - localY * scaleY * sine,
      y: y - lift + localX * scaleX * sine + localY * scaleY * cosine
    }))
    const hitPadding = Math.max(3, size * 0.025)
    const hitLeft = Math.min(...corners.map((corner) => corner.x)) - hitPadding
    const hitTop = Math.min(...corners.map((corner) => corner.y)) - hitPadding
    const hitRight = Math.max(...corners.map((corner) => corner.x)) + hitPadding
    const hitBottom =
      Math.max(...corners.map((corner) => corner.y)) + hitPadding
    hitBoxes.push({
      visitor: actor.visitor,
      x: transform.x + hitLeft * transform.scale,
      y: transform.y + hitTop * transform.scale,
      w: (hitRight - hitLeft) * transform.scale,
      h: (hitBottom - hitTop) * transform.scale
    })
  }
  function drawSelectionRing(actor, size) {
    if (actor.visitor.id !== state.selectedId) return
    const x = actor.x * W
    const y = actor.y * H
    ctx.save()
    // Both strokes stay visible against pale ceramic and dark scenery.
    ctx.lineWidth = 8
    ellipse(
      x,
      y + 2,
      Math.max(16, size * 0.38),
      Math.max(6, size * 0.12),
      '#15163288',
      '#151632'
    )
    ctx.lineWidth = 3
    ellipse(
      x,
      y + 2,
      Math.max(16, size * 0.38),
      Math.max(6, size * 0.12),
      null,
      '#ffcc83'
    )
    ctx.restore()
  }
  function drawSelection() {
    if (!state.creatures) return
    const actor = actors.find((item) => item.visitor.id === state.selectedId)
    if (!actor) return
    const size = creatureSize()
    const x = actor.x * W
    const y = actor.y * H
    const airborne = physics?.heldId === actor.visitor.id || actor.landing > 0
    const lift = airborne ? Math.max(10, size * 0.14) : 0
    const bounds = textureBounds[actor.visitor.family]
    const top = y - lift - (bounds.bottom - bounds.top) * size
    ctx.save()
    const tip = top - 6
    ctx.beginPath()
    ctx.moveTo(x, tip)
    ctx.lineTo(x - 7, tip - 9)
    ctx.lineTo(x + 7, tip - 9)
    ctx.closePath()
    ctx.fillStyle = '#ffcc83'
    ctx.strokeStyle = '#151632'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.fill()
    ctx.font = '600 14px system-ui'
    const labelWidth = ctx.measureText(actor.visitor.label).width + 20
    ctx.fillStyle = '#151632'
    ctx.beginPath()
    ctx.roundRect(x - labelWidth / 2, tip - 35, labelWidth, 24, 12)
    ctx.fill()
    ctx.fillStyle = '#fff0cf'
    ctx.textAlign = 'center'
    ctx.fillText(actor.visitor.label, x, tip - 18)
    ctx.restore()
  }
  function draw() {
    if (!images || !ctx) return
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0)
    ctx.fillStyle = '#171a35'
    ctx.fillRect(0, 0, W, H)
    ctx.save()
    const background = images[state.scene]
    if (state.scenery) ctx.drawImage(background, 0, 0, W, H)
    if (state.effects && effectIntensity() > 0) {
      drawLights()
      drawWater()
      roomEffects.drawBack(ctx, elapsed, {
        actors: state.creatures ? actors : [],
        scenery: state.scenery
      })
    }
    hitBoxes = []
    if (state.creatures)
      for (const actor of [...actors].sort((a, b) => a.y - b.y))
        if (actor.visitor.id !== physics?.heldId && !actor.landing)
          drawActor(actor)
    if (state.scenery && state.occlusion) {
      for (const points of baseRims()) {
        ctx.save()
        polygon(points)
        ctx.clip()
        ctx.drawImage(background, 0, 0, W, H)
        ctx.restore()
      }
    }
    if (state.creatures) {
      for (const actor of actors)
        if (actor.landing && actor.visitor.id !== physics?.heldId)
          drawActor(actor)
      const heldActor = actors.find(
        (actor) => actor.visitor.id === physics?.heldId
      )
      if (heldActor) drawActor(heldActor)
    }
    if (state.guides) {
      ctx.font = '11px system-ui'
      for (const zone of baseZones()) {
        ctx.lineWidth = 1
        ctx.setLineDash([5, 5])
        ellipse(
          zone.cx * W,
          zone.cy * H,
          zone.rx * W,
          zone.ry * H,
          '#75f5d71a',
          '#a5ffe0ba'
        )
        ctx.setLineDash([])
        ctx.fillStyle = '#d3fff1'
        ctx.fillText(
          zone.key,
          zone.cx * W - zone.rx * W,
          zone.cy * H + zone.ry * H + 13
        )
      }
    }
    if (state.effects && effectIntensity() > 0)
      roomEffects.drawFront(ctx, elapsed, {
        actors: state.creatures ? actors : [],
        scenery: state.scenery
      })
    // Baseline rooms keep their lantern flecks; the three studies author their own atmosphere.
    if (state.effects && !currentDetail()?.vibe) {
      for (let i = 0; i < 9; i++) {
        const px = (i * 173 + 150) % W,
          py =
            H * 0.88 + Math.sin(i * 3) * 60 - Math.sin(elapsed * 0.23 + i) * 12
        ellipse(
          px,
          py,
          1.1,
          1.1,
          `rgba(255,205,133,${0.13 + 0.12 * Math.sin(elapsed + i)})`
        )
      }
    }
    drawSelection()
    ctx.restore()
  }
  function frame(now) {
    scheduled = 0
    if (disposed || document.hidden) return
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0
    lastTime = now
    if (!state.paused) {
      elapsed += dt
      stepMotion(actors, dt, elapsed)
      if (physicsActive) physicsActive = physics.step(dt)
    }
    sceneSound.tick()
    draw()
    if (!state.paused) requestFrame()
  }
  function requestFrame() {
    if (!disposed && !scheduled && !document.hidden)
      scheduled = requestAnimationFrame(frame)
  }
  function resize() {
    const rect = canvas.getBoundingClientRect()
    const ratio = Math.min(devicePixelRatio || 1, 2)
    canvas.width = Math.round(rect.width * ratio)
    canvas.height = Math.round(rect.height * ratio)
    draw()
  }
  $('camp').onclick = () => switchScene('camp', true)
  $('room-select').onchange = (event) => switchScene(event.target.value)
  for (const button of root.querySelectorAll('[data-room-study]'))
    button.onclick = () => switchScene(button.dataset.roomStudy, true)
  for (const mode of ['summary', 'full'])
    $(mode).onclick = () => {
      state.mode = mode
      saveWorldPreferences({ mode })
      if (mode === 'full' && currentDetail()) {
        const selected = population.find((v) => v.id === state.selectedId)
        if (selected?.room === currentDetail().room)
          state.court = selected.court
      }
      updateSelection()
    }
  function changePopulation(value) {
    if (options.live) return
    state.count = Number(value)
    saveWorldPreferences({ count: state.count })
    population = createPopulation(state.count)
    state.court = Math.min(
      state.court,
      Math.max(
        0,
        Math.ceil(
          population.filter((v) => v.room === currentDetail()?.room).length /
            100
        ) - 1
      )
    )
    state.page = 0
    if (!population.some((v) => v.id === state.selectedId))
      state.selectedId = null
    updateSelection()
  }
  $('population').oninput = (e) => changePopulation(e.target.value)
  for (const button of root.querySelectorAll('[data-count]'))
    button.onclick = () => changePopulation(button.dataset.count)
  $('pause').onclick = () => {
    state.paused = !state.paused
    sceneSound.pausedChanged()
    lastTime = 0
    renderControls()
    draw()
    requestFrame()
  }
  $('previous-court').onclick = () => {
    state.court--
    actors = []
    updateSelection()
  }
  $('next-court').onclick = () => {
    state.court++
    actors = []
    updateSelection()
  }
  $('previous-page').onclick = () => {
    state.page--
    renderRoster()
  }
  $('next-page').onclick = () => {
    state.page++
    renderRoster()
  }
  $('search').oninput = (e) => {
    state.search = e.target.value
    state.page = 0
    renderRoster()
  }
  function canvasPoint(event) {
    const box = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - box.left) / box.width) * W,
      y: ((event.clientY - box.top) / box.height) * H
    }
  }
  function hitAt(point) {
    return [...hitBoxes]
      .reverse()
      .find(
        (hit) =>
          point.x >= hit.x &&
          point.x <= hit.x + hit.w &&
          point.y >= hit.y &&
          point.y <= hit.y + hit.h
      )
  }
  function settleWhenPaused() {
    if (state.paused)
      for (let i = 0; i < 80 && physicsActive; i++)
        physicsActive = physics.step(1 / 60)
  }
  function finishDrag(event) {
    if (!grabOffset) return
    const held = population.find((v) => v.id === physics?.heldId)
    const pointerId = grabOffset.pointerId
    const drop = physics?.release()
    if (canvas.hasPointerCapture(pointerId))
      canvas.releasePointerCapture(pointerId)
    canvas.style.cursor = 'grab'
    grabOffset = null
    settleWhenPaused()
    if (held) {
      describeDrop(held, drop)
      const actor = actors.find((item) => item.visitor.id === held.id)
      sceneSound.release(
        held,
        { x: actor?.x ?? 0.5, y: actor?.y ?? 0.5 },
        event?.type !== 'pointerup'
      )
    }
    renderInspection()
    draw()
    requestFrame()
  }
  listen(canvas, 'pointerdown', (event) => {
    if (event.button !== 0 || grabOffset || !physics) return
    const point = canvasPoint(event),
      hit = hitAt(point)
    if (!hit) {
      sceneSound.touchScene(sceneSoundPoint(point))
      return
    }
    const actor = actors.find((a) => a.visitor.id === hit.visitor.id)
    if (!actor || !physics.grab(actor.visitor.id)) return
    state.selectedId = actor.visitor.id
    sceneSound.pickup(actor.visitor, sceneSoundPoint(point))
    grabOffset = {
      pointerId: event.pointerId,
      x: actor.x - (point.x - transform.x) / transform.scale / W,
      y: actor.y - (point.y - transform.y) / transform.scale / H
    }
    physicsActive = true
    canvas.setPointerCapture(event.pointerId)
    canvas.style.cursor = 'grabbing'
    event.preventDefault()
    renderRoster()
    renderInspection()
    draw()
    requestFrame()
  })
  listen(canvas, 'pointermove', (event) => {
    const point = canvasPoint(event)
    if (grabOffset && event.pointerId === grabOffset.pointerId) {
      const held = population.find((visitor) => visitor.id === physics.heldId)
      if (held) sceneSound.drag(held, sceneSoundPoint(point))
      physics.move(
        (point.x - transform.x) / transform.scale / W + grabOffset.x,
        (point.y - transform.y) / transform.scale / H + grabOffset.y
      )
      physicsActive = physics.step(0)
      event.preventDefault()
      draw()
      requestFrame()
      return
    }
    const hit = hitAt(point)
    const soundTarget = sceneSound.pointerHover(sceneSoundPoint(point), hit)
    canvas.style.cursor = hit ? 'grab' : soundTarget ? 'pointer' : 'default'
  })
  function sceneSoundPoint(point) {
    return {
      x: (point.x - transform.x) / transform.scale / W,
      y: (point.y - transform.y) / transform.scale / H
    }
  }
  listen(canvas, 'pointerleave', () => sceneSound.leave())
  listen(canvas, 'pointerup', finishDrag)
  listen(canvas, 'pointercancel', finishDrag)
  listen(canvas, 'lostpointercapture', () => {
    if (grabOffset) finishDrag()
  })
  listen(reduced, 'change', (event) => {
    if (event.matches) {
      state.paused = true
      sceneSound.pausedChanged()
      renderControls()
      draw()
    }
  })
  listen(document, 'visibilitychange', () => {
    if (document.hidden && grabOffset) finishDrag()
    sceneSound.visibilityChanged()
    lastTime = 0
    if (document.hidden) {
      cancelAnimationFrame(scheduled)
      scheduled = 0
    } else requestFrame()
  })
  listen(window, 'pagehide', (event) => {
    if (grabOffset) finishDrag()
    if (event.persisted) sceneSound.suspendPage()
    else {
      soundReview.destroy()
      sceneSound.dispose()
    }
  })
  listen(window, 'pageshow', (event) => {
    if (!event.persisted) return
    sceneSound.setExclusions(soundReview.getExclusions())
    sceneSound.visibilityChanged()
    lastTime = 0
    requestFrame()
  })
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  listen(window, 'resize', () => updateSelection())
  void (async () => {
    try {
      const [background, atlas] = await Promise.all([
        loadImage(`/world/${state.scene}.webp`),
        loadImage('/world/creatures.webp')
      ])
      if (disposed) return
      textures = makeTextures(atlas)
      sheenTextures = makeSheenTextures()
      images = { [state.scene]: background }
      applyEffectStrengths()
      roomEffects.setScene(state.scene, background, currentDetail())
      resize()
      updateSelection()
      root.dataset.ready = 'true'
    } catch {
      if (disposed) return
      assetsFailed = true
      updateSelection()
      $('canvas-count').textContent =
        'The scenery could not load. You can still explore using the room links and visitor list.'
      root.dataset.ready = 'error'
    }
  })()
  const dispose = () => {
    disposed = true
    listeners.abort()
    observer.disconnect()
    cancelAnimationFrame(scheduled)
    physics?.dispose()
    roomEffects.dispose()
    soundReview.destroy()
    sceneSound.dispose()
  }
  dispose.updatePopulation = (visitors, total, selectedId = null) => {
    if (disposed || !options.live) return
    population = visitors
    trackedTotal = total
    if (selectedId) state.selectedId = selectedId
    state.count = total
    if (!population.some((visitor) => visitor.id === state.selectedId))
      state.selectedId = null
    updateSelection()
  }
  return dispose
}
