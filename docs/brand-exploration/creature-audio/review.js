import { createSoundReviewPreferences } from './review-preferences.js'

const storageKey = 'burning-tokens-creature-audio-review-v1'
const hiddenStorageKey = 'burning-tokens-creature-audio-hidden-v1'
const newBatch = 'wide-audition-2026-09-15'
const pageSize = 40
let visibleLimit = pageSize
const roomNames = {
  bathhouse: 'Bathhouse',
  'dream-garden': 'Dream Garden',
  'quiet-house': 'Quiet House',
  source: 'The Source',
  'open-studio': 'Open Studio',
  hearth: 'Hearth',
  temple: 'Temple',
  camp: 'Camp & creature handling'
}
const elements = {
  list: document.querySelector('#clip-list'),
  hideSource: document.querySelector('#hide-selected-source'),
  hiddenItems: document.querySelector('#hidden-items'),
  hiddenCount: document.querySelector('#hidden-count'),
  hiddenList: document.querySelector('#hidden-list'),
  showHidden: document.querySelector('#show-hidden'),
  dismissalFeedback: document.querySelector('#dismissal-feedback'),
  dismissalStatus: document.querySelector('#dismissal-status'),
  undo: document.querySelector('#undo-dismissal'),
  dismissNotice: document.querySelector('#dismiss-notice'),
  count: document.querySelector('#clip-count'),
  all: document.querySelector('#filter-all'),
  favorites: document.querySelector('#filter-favorites'),
  new: document.querySelector('#filter-new'),
  newCount: document.querySelector('#new-count'),
  mischief: document.querySelector('#filter-mischief'),
  collectionDescription: document.querySelector('#collection-description'),
  favoriteCount: document.querySelector('#favorite-count'),
  source: document.querySelector('#source-filter'),
  kind: document.querySelector('#kind-filter'),
  family: document.querySelector('#family-filter'),
  room: document.querySelector('#room-filter'),
  search: document.querySelector('#sound-search'),
  more: document.querySelector('#show-more'),
  showAll: document.querySelector('#show-all-matches'),
  progress: document.querySelector('#catalog-progress'),
  progressText: document.querySelector('#catalog-progress-text'),
  download: document.querySelector('#download-review'),
  volume: document.querySelector('#volume'),
  volumeValue: document.querySelector('#volume-value'),
  stop: document.querySelector('#stop-all'),
  playback: document.querySelector('#playback-status'),
  empty: document.querySelector('#empty-state'),
  emptyTitle: document.querySelector('#empty-title'),
  emptyDescription: document.querySelector('#empty-description'),
  reset: document.querySelector('#reset-filters'),
  error: document.querySelector('#load-error'),
  errorDescription: document.querySelector('#load-error-description'),
  retry: document.querySelector('#retry-load'),
  copy: document.querySelector('#copy-review'),
  fallback: document.querySelector('#copy-fallback'),
  reviewText: document.querySelector('#review-text'),
  reviewStatus: document.querySelector('#review-status'),
  storageStatus: document.querySelector('#storage-status')
}

const icons = {
  dislike:
    'M3 3h3v10H3V3Zm5 0h10a2 2 0 0 1 2 2l-1 6a2 2 0 0 1-2 2h-4l1 4v2a2 2 0 0 1-2 2l-4-8V3Z',
  play: 'M6 3.5v17l14-8.5L6 3.5Z',
  pause: 'M6 4h4v16H6V4Zm8 0h4v16h-4V4Z',
  replay: 'M5 8V3H3v9h9v-2H6a7 7 0 1 1-1 7l-1.8.8A9 9 0 1 0 5 8Z',
  star: 'm12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3-4.6-4.5 6.4-.9L12 3Z'
}

let clips = []
let players = []
let soundAssignments = new Map()
let voiceFamilies = new Map()
const requestedCollection = new URLSearchParams(location.search).get(
  'collection'
)
let activeFilter = ['mischief', 'new', 'favorites'].includes(
  requestedCollection
)
  ? requestedCollection
  : 'all'
let reviewedClipIds = new Set()
let volume = 0.6
let studyTitle = 'Little voices. Strange company.'
let loadController
let reviews = readReviews()
let hiddenChoices = readHiddenChoices()
let undoChoices
const familyPreferences = createSoundReviewPreferences({
  onChange: ({ familyIds, clipIds, sourceKeys }) => {
    hiddenFamilies = new Set(familyIds)
    hiddenChoices = { clips: new Set(clipIds), sources: new Set(sourceKeys) }
    if (players.length) {
      updateSourceOptions()
      applyFilters()
    }
  }
})
let hiddenFamilies = new Set(familyPreferences.getExclusions().familyIds)

function node(tag, className, text) {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (text !== undefined) element.textContent = text
  return element
}

function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', icons[name])
  svg.append(path)
  return svg
}

function cleanText(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function externalLink(url) {
  try {
    const parsed = new URL(url)
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : null
  } catch {
    return null
  }
}

function sourceKey(clip) {
  return cleanText(
    clip.source?.url,
    cleanText(
      clip.source?.id,
      cleanText(clip.source?.title, 'Unspecified source')
    )
  )
}

function timestamp(seconds, precise = false) {
  const value = Math.max(0, Number(seconds) || 0)
  const showTenths = precise || value < 10
  const rounded = showTenths ? Math.round(value * 10) / 10 : Math.floor(value)
  const minutes = Math.floor(rounded / 60)
  const remainder = rounded % 60
  const label = showTenths
    ? remainder.toFixed(1).padStart(4, '0')
    : String(Math.floor(remainder)).padStart(2, '0')
  return `${minutes}:${label}`
}

function readReviews(fallback = new Map()) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}')
    if (!saved || typeof saved !== 'object' || Array.isArray(saved))
      return new Map()
    return new Map(
      Object.entries(saved)
        .filter(([, value]) => value && typeof value === 'object')
        .map(([id, value]) => [
          id,
          {
            favorite: value.favorite === true,
            note:
              typeof value.note === 'string' ? value.note.slice(0, 4000) : ''
          }
        ])
    )
  } catch {
    elements.storageStatus.textContent =
      'Browser storage is unavailable. Keep this page open and copy your notes before leaving.'
    return fallback
  }
}

function reviewFor(id) {
  if (!reviews.has(id)) reviews.set(id, { favorite: false, note: '' })
  return reviews.get(id)
}

function saveReviews() {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify(Object.fromEntries(reviews))
    )
    elements.storageStatus.textContent = ''
  } catch {
    elements.storageStatus.textContent =
      'These notes could not be saved in this browser. Copy them before leaving.'
  }
  elements.copy.disabled = clips.length === 0
}

function updateReview(id, change) {
  // Re-read before changing one field so another tab's note or star survives.
  const latest = readReviews(reviews)
  for (const [key, value] of reviews)
    if (!latest.has(key)) latest.set(key, { ...value })
  reviews = latest
  change(reviewFor(id))
  saveReviews()
  syncReviewControls()
}

function syncReviewControls() {
  for (const player of players) {
    const review = reviewFor(player.clip.id)
    player.favorite.setAttribute('aria-pressed', String(review.favorite))
    if (player.note.value !== review.note) player.note.value = review.note
    player.summary.textContent = review.note
      ? 'Source & your note'
      : 'Source & listening note'
  }
}

async function loadOptionalJson(path, signal) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(abort, 3000)
  try {
    if (signal.aborted) abort()
    const response = await fetch(path, {
      signal: controller.signal
    })
    return response.ok ? await response.json() : null
  } catch {
    // The listening room remains usable without optional review or family data.
    return null
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', abort)
  }
}

function seedReviewedChoices(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.reviewedClipIds)) return
  const ids = new Set(clips.map((clip) => clip.id))
  reviewedClipIds = new Set(
    snapshot.reviewedClipIds.filter((id) => ids.has(id))
  )
  reviews = readReviews(reviews)
  let addedReview = false
  for (const id of reviewedClipIds) {
    const saved = snapshot.reviews?.[id]
    if (reviews.has(id) || !saved || typeof saved !== 'object') continue
    reviews.set(id, {
      favorite: saved.favorite === true,
      note: typeof saved.note === 'string' ? saved.note.slice(0, 4000) : ''
    })
    addedReview = true
  }
  if (addedReview) saveReviews()
  try {
    // An existing empty list means the user restored their hidden sounds.
    // Seed only once, never reconstruct those decisions from the snapshot.
    if (localStorage.getItem(hiddenStorageKey) !== null) return
    hiddenChoices = {
      clips: new Set(
        (Array.isArray(snapshot.hidden?.clips)
          ? snapshot.hidden.clips
          : []
        ).filter((id) => ids.has(id))
      ),
      sources: new Set(
        (Array.isArray(snapshot.hidden?.sources)
          ? snapshot.hidden.sources
          : []
        ).filter((value) => typeof value === 'string' && value)
      )
    }
    saveHiddenChoices()
  } catch {
    // Existing in-memory choices remain authoritative without browser storage.
  }
}

function isLatestBatch(clip) {
  return clip.addedIn === newBatch
}

function isNewClip(clip) {
  return isLatestBatch(clip) && !reviewedClipIds.has(clip.id)
}

function readHiddenChoices() {
  try {
    const saved = JSON.parse(localStorage.getItem(hiddenStorageKey) || '{}')
    const stringSet = (values) =>
      new Set(
        (Array.isArray(values) ? values : []).filter(
          (value) => typeof value === 'string' && value
        )
      )
    return {
      clips: stringSet(saved?.clips),
      sources: stringSet(saved?.sources)
    }
  } catch {
    elements.storageStatus.textContent =
      'Hidden choices could not be read. Keep this page open and copy your review before leaving.'
    return { clips: new Set(), sources: new Set() }
  }
}

function saveHiddenChoices() {
  try {
    const stored = JSON.parse(localStorage.getItem(hiddenStorageKey) || '{}')
    const metadata =
      stored && typeof stored === 'object' && !Array.isArray(stored)
        ? stored
        : {}
    localStorage.setItem(
      hiddenStorageKey,
      JSON.stringify({
        ...metadata,
        clips: [...hiddenChoices.clips],
        sources: [...hiddenChoices.sources]
      })
    )
    elements.storageStatus.textContent = ''
  } catch {
    elements.storageStatus.textContent =
      'Hidden choices could not be saved in this browser. Copy your review before leaving.'
  }
}

function isHidden(clip) {
  return (
    hiddenChoices.clips.has(clip.id) ||
    hiddenChoices.sources.has(sourceKey(clip)) ||
    hiddenFamilies.has(soundAssignments.get(clip.id)?.familyId)
  )
}

function sourcesInStudy() {
  const sources = new Map()
  for (const clip of clips) {
    const key = sourceKey(clip)
    if (!sources.has(key))
      sources.set(key, {
        key,
        title: cleanText(clip.source?.title, 'Unspecified source'),
        clips: []
      })
    sources.get(key).clips.push(clip)
  }
  return [...sources.values()]
}

function clipKind(clip) {
  return clip.kind === 'room-effect' ? 'room-effect' : 'voice'
}

const reactionNames = {
  hover: 'Curious hover',
  pickup: 'Pick up',
  surprise: 'Quick movement',
  drop: 'Set down',
  nudge: 'Gentle nudge',
  idle: 'Occasional background'
}

function loadSoundClassifications(catalog) {
  soundAssignments = new Map()
  voiceFamilies = new Map()
  elements.family.replaceChildren(new Option('Every voice family', ''))
  if (!Array.isArray(catalog?.families) || !Array.isArray(catalog?.clips))
    return
  const knownIds = new Set(clips.map((clip) => clip.id))
  for (const family of catalog.families) {
    const id = cleanText(family?.id)
    const label = cleanText(family?.label)
    if (id && label) voiceFamilies.set(id, label)
  }
  for (const sound of catalog.clips) {
    if (!sound || !knownIds.has(sound.id)) continue
    const familyId =
      sound.kind === 'voice' && voiceFamilies.has(sound.family)
        ? sound.family
        : ''
    soundAssignments.set(sound.id, {
      familyId,
      roles: (Array.isArray(sound.roles) ? sound.roles : []).filter((role) =>
        Object.hasOwn(reactionNames, role)
      ),
      targets: (Array.isArray(sound.targets) ? sound.targets : [])
        .map((target) => cleanText(target))
        .filter(Boolean)
    })
  }
  const assignedFamilies = new Set(
    [...soundAssignments.values()].map((sound) => sound.familyId)
  )
  for (const [id, label] of voiceFamilies) {
    if (!assignedFamilies.has(id)) voiceFamilies.delete(id)
    else elements.family.append(new Option(label, id))
  }
}

function assignmentText(clip) {
  const assignment = soundAssignments.get(clip.id)
  if (!assignment) return []
  return [
    voiceFamilies.get(assignment.familyId),
    ...assignment.roles.map((role) => reactionNames[role]),
    ...assignment.targets
  ].filter(Boolean)
}

function createAssignmentDetails(clip) {
  const assignment = soundAssignments.get(clip.id)
  if (!assignment) return null
  const details = node('div', 'clip-assignment')
  const family = voiceFamilies.get(assignment.familyId)
  if (family) {
    const label = node('p', 'clip-family')
    label.append(node('span', '', 'Voice family'), node('strong', '', family))
    details.append(label)
  } else if (assignment.targets.length) {
    details.append(
      node('p', 'clip-targets', `For ${assignment.targets.join(' · ')}`)
    )
  }
  if (assignment.roles.length) {
    const roles = node('ul', 'clip-roles')
    roles.setAttribute('aria-label', 'Prototype reactions')
    for (const role of assignment.roles)
      roles.append(node('li', '', reactionNames[role]))
    details.append(roles)
  }
  return details
}

function matchesContext(clip) {
  const query = elements.search.value.trim().toLocaleLowerCase()
  const searchable = [
    clip.title,
    clip.description,
    clip.character,
    clip.useCase,
    clip.source?.title,
    clip.source?.creator,
    ...assignmentText(clip),
    ...(clip.tags || []),
    ...(clip.rooms || []).map((room) => roomNames[room])
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase()
  return (
    !isHidden(clip) &&
    (activeFilter !== 'favorites' || reviewFor(clip.id).favorite) &&
    (activeFilter !== 'mischief' || clip.collection === 'mischief') &&
    (activeFilter !== 'new' || isLatestBatch(clip)) &&
    (!elements.kind.value || clipKind(clip) === elements.kind.value) &&
    (!elements.family.value ||
      soundAssignments.get(clip.id)?.familyId === elements.family.value) &&
    (!elements.room.value || clip.rooms?.includes(elements.room.value)) &&
    (!query || query.split(/\s+/).every((word) => searchable.includes(word)))
  )
}

function updateSourceOptions(selected = elements.source.value) {
  const sources = sourcesInStudy().filter(
    (source) =>
      !hiddenChoices.sources.has(source.key) &&
      (source.key === selected || source.clips.some(matchesContext))
  )
  elements.source.replaceChildren(new Option('Every source', ''))
  for (const source of sources)
    elements.source.append(
      new Option(
        `${source.title} · ${source.clips.filter(matchesContext).length}`,
        source.key
      )
    )
  elements.source.value = sources.some((source) => source.key === selected)
    ? selected
    : ''
  elements.source.disabled = sources.length === 0
}

function changeHiddenChoices(message, change) {
  undoChoices = {
    clips: new Set(hiddenChoices.clips),
    sources: new Set(hiddenChoices.sources)
  }
  change()
  saveHiddenChoices()
  updateSourceOptions()
  applyFilters()
  elements.dismissalStatus.textContent = message
  elements.dismissalFeedback.hidden = false
  elements.undo.hidden = false
  elements.undo.focus({ preventScroll: true })
}

function hideSource(key) {
  const source = sourcesInStudy().find((source) => source.key === key)
  if (!source) return
  changeHiddenChoices(
    `Source hidden: ${source.title}. ${source.clips.length} ${source.clips.length === 1 ? 'sound' : 'sounds'} hidden.`,
    () => hiddenChoices.sources.add(key)
  )
}

function renderHiddenItems() {
  const sources = sourcesInStudy().filter((source) =>
    hiddenChoices.sources.has(source.key)
  )
  const sounds = clips.filter((clip) => hiddenChoices.clips.has(clip.id))
  elements.hiddenCount.textContent =
    [
      hiddenFamilies.size
        ? `${hiddenFamilies.size} ${hiddenFamilies.size === 1 ? 'family' : 'families'}`
        : '',
      sources.length
        ? `${sources.length} ${sources.length === 1 ? 'source' : 'sources'}`
        : '',
      sounds.length
        ? `${sounds.length} ${sounds.length === 1 ? 'sound' : 'sounds'}`
        : ''
    ]
      .filter(Boolean)
      .join(' · ') || '0'
  elements.hiddenList.replaceChildren()
  const addGroup = (title, items, render) => {
    if (!items.length) return
    const list = node('ul', 'hidden-list')
    for (const item of items) list.append(render(item))
    elements.hiddenList.append(node('h3', '', title), list)
  }
  const row = (title, meta, label, restore) => {
    const item = node('li', 'hidden-item')
    const copy = node('div', 'hidden-item-copy')
    copy.append(
      node('p', 'hidden-item-title', title),
      node('p', 'hidden-item-meta', meta)
    )
    const button = node('button', 'quiet-button', 'Restore')
    button.type = 'button'
    button.setAttribute('aria-label', label)
    button.addEventListener('click', restore)
    item.append(copy, button)
    return item
  }
  addGroup('Voice families', [...hiddenFamilies], (id) =>
    row(
      voiceFamilies.get(id) || id,
      'Hidden in the family review. Individually hidden sounds stay hidden.',
      `Restore voice family ${voiceFamilies.get(id) || id}`,
      () => familyPreferences.restoreFamily(id)
    )
  )
  addGroup('Sources', sources, (source) =>
    row(
      source.title,
      `${source.clips.length} ${source.clips.length === 1 ? 'sound' : 'sounds'} from this source. Individually hidden sounds stay hidden.`,
      `Restore source ${source.title}`,
      () =>
        changeHiddenChoices(`Source restored: ${source.title}.`, () =>
          hiddenChoices.sources.delete(source.key)
        )
    )
  )
  addGroup('Sounds', sounds, (clip) =>
    row(
      clip.title,
      hiddenChoices.sources.has(sourceKey(clip))
        ? 'Its source is also hidden. Restore the source to hear it again.'
        : cleanText(clip.source?.title, 'Creature voice'),
      `Restore sound ${clip.title}`,
      () =>
        changeHiddenChoices(
          `Sound restored: ${clip.title}.${hiddenChoices.sources.has(sourceKey(clip)) ? ' Its source is still hidden.' : ''}`,
          () => hiddenChoices.clips.delete(clip.id)
        )
    )
  )
  if (!sources.length && !sounds.length && !hiddenFamilies.size)
    elements.hiddenList.append(
      node('p', 'hidden-item-meta', 'Nothing hidden yet.')
    )
}

function setPlaybackStatus() {
  const playing = players.find(({ audio }) => !audio.paused && !audio.ended)
  elements.playback.textContent = playing
    ? `Playing: ${playing.clip.title}`
    : 'Nothing playing. Take your time.'
  elements.stop.disabled = !players.some(
    ({ audio }) => !audio.paused || audio.currentTime > 0
  )
}

function updatePlayer(player) {
  const { audio, button, seek, current, duration, card } = player
  const length = Number.isFinite(audio.duration)
    ? audio.duration
    : player.clip.duration
  const position = Number.isFinite(audio.currentTime) ? audio.currentTime : 0
  const playing = !audio.paused && !audio.ended
  const ended = audio.ended || (length > 0 && position >= length - 0.01)
  const label = playing ? 'Pause' : ended ? 'Replay' : 'Play'
  button.replaceChildren(
    icon(playing ? 'pause' : ended ? 'replay' : 'play'),
    node('span', '', label)
  )
  button.setAttribute('aria-label', `${label} ${player.clip.title}`)
  card.classList.toggle('is-playing', playing)
  current.textContent = timestamp(position)
  duration.textContent = timestamp(length)
  seek.max = String(length || 1)
  seek.value = String(Math.min(position, length || 0))
  seek.disabled = !Number.isFinite(audio.duration) || audio.duration <= 0
  seek.style.setProperty(
    '--progress',
    `${length > 0 ? Math.min(100, (position / length) * 100) : 0}%`
  )
  seek.setAttribute(
    'aria-valuetext',
    `${timestamp(position)} of ${timestamp(length)}`
  )
}

function stopAll() {
  for (const player of players) {
    player.audio.pause()
    player.audio.currentTime = 0
    updatePlayer(player)
  }
  setPlaybackStatus()
}

function setClipError(player, message) {
  player.error.textContent = message
  player.error.hidden = !message
}

function addSourceFact(list, label, value, url) {
  if (!value) return
  const row = node('div')
  const term = node('dt', '', label)
  const description = node('dd')
  const safeUrl = externalLink(url)
  if (safeUrl) {
    const link = node('a', '', value)
    link.href = safeUrl
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    description.append(link)
  } else description.textContent = value
  row.append(term, description)
  list.append(row)
}

function createPlayer(clip, index) {
  const review = reviewFor(clip.id)
  const titleId = `clip-title-${index}`
  const card = node('article', 'clip-card')
  card.setAttribute('aria-labelledby', titleId)
  card.dataset.clipId = clip.id
  const top = node('div', 'clip-top')
  const eyebrow = node('p', 'clip-eyebrow')
  eyebrow.append(
    node('span', 'clip-number', String(index + 1).padStart(2, '0')),
    node('span', '', cleanText(clip.character, 'Creature voice'))
  )
  const favorite = node('button', 'favorite-button')
  favorite.type = 'button'
  favorite.append(icon('star'))
  favorite.setAttribute('aria-pressed', String(review.favorite))
  favorite.setAttribute('aria-label', `Favorite ${clip.title}`)
  favorite.title = 'Keep this sound in your favorites'
  const hide = node('button', 'hide-sound-button')
  hide.type = 'button'
  hide.append(icon('dislike'), node('span', '', 'Hide'))
  hide.setAttribute('aria-label', `Hide sound ${clip.title}`)
  hide.title = 'Dislike and hide this sound'
  hide.addEventListener('click', () =>
    changeHiddenChoices(`Sound hidden: ${clip.title}.`, () =>
      hiddenChoices.clips.add(clip.id)
    )
  )
  const actions = node('div', 'clip-actions')
  actions.append(favorite, hide)
  top.append(eyebrow, actions)
  const heading = node('h3', '', clip.title)
  heading.id = titleId
  const description = node(
    'p',
    'clip-description',
    cleanText(clip.description, 'A short creature voice reference.')
  )
  const tags = node('ul', 'clip-tags')
  tags.setAttribute('aria-label', 'Sound qualities')
  for (const tag of (Array.isArray(clip.tags) ? clip.tags : [])
    .filter((value) => typeof value === 'string')
    .slice(0, 6))
    tags.append(node('li', '', tag))

  const playerRow = node('div', 'player')
  const button = node('button', 'play-button')
  button.type = 'button'
  const seekControl = node('div', 'seek-control')
  const seek = node('input')
  seek.type = 'range'
  seek.min = '0'
  seek.step = '0.01'
  seek.value = '0'
  seek.setAttribute('aria-label', `Playback position for ${clip.title}`)
  const labels = node('div', 'time-labels')
  labels.setAttribute('aria-hidden', 'true')
  const current = node('span', '', '0:00')
  const duration = node('span', '', timestamp(clip.duration))
  labels.append(current, duration)
  seekControl.append(seek, labels)
  playerRow.append(button, seekControl)
  const error = node('p', 'clip-error')
  error.hidden = true
  error.setAttribute('role', 'status')

  const details = node('details', 'clip-details')
  const summary = node(
    'summary',
    '',
    review.note ? 'Source & your note' : 'Source & listening note'
  )
  const detailsBody = node('div', 'details-body')
  const source = clip.source || {}
  const sourceUrl = externalLink(source.url)
  const sourceTitle = node(
    sourceUrl ? 'a' : 'p',
    'source-title',
    cleanText(source.title, 'Source details unavailable')
  )
  if (sourceUrl) {
    const timedUrl = new URL(sourceUrl)
    if (
      /(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(timedUrl.hostname) &&
      Number.isFinite(source.start)
    ) {
      timedUrl.searchParams.set(
        't',
        `${Math.max(0, Math.floor(source.start))}s`
      )
    }
    sourceTitle.href = timedUrl.href
    sourceTitle.target = '_blank'
    sourceTitle.rel = 'noopener noreferrer'
  }
  const sourceRange =
    Number.isFinite(source.start) && Number.isFinite(source.end)
      ? `${timestamp(source.start, true)}–${timestamp(source.end, true)} in source`
      : ''
  const sourceMeta = node(
    'p',
    'source-meta',
    [cleanText(source.creator), sourceRange].filter(Boolean).join(' · ')
  )
  const sourceClips = clips.filter(
    (candidate) => sourceKey(candidate) === sourceKey(clip)
  ).length
  const hideSourceButton = node(
    'button',
    'quiet-button hide-source-button',
    `Hide this source · ${sourceClips} ${sourceClips === 1 ? 'clip' : 'clips'}`
  )
  hideSourceButton.type = 'button'
  hideSourceButton.setAttribute(
    'aria-label',
    `Hide source ${cleanText(source.title, 'Unspecified source')}`
  )
  hideSourceButton.addEventListener('click', () => hideSource(sourceKey(clip)))
  const sourceFacts = node('dl', 'source-facts')
  const licenseLabel =
    source.licenseStatus === 'verified'
      ? 'Verified license'
      : source.licenseStatus === 'unknown'
        ? 'Usage note'
        : 'Source license statement'
  addSourceFact(
    sourceFacts,
    licenseLabel,
    cleanText(source.license, 'License not supplied in this study.'),
    source.licenseUrl
  )
  addSourceFact(
    sourceFacts,
    'Clip treatment',
    cleanText(clip.processing, 'No processing details supplied.')
  )
  const audio = node('audio', 'native-player')
  audio.controls = true
  audio.preload = 'none'
  const audioUrl = new URL(clip.src, location.href)
  if (typeof clip.audio?.sha256 === 'string')
    audioUrl.searchParams.set('v', clip.audio.sha256.slice(0, 12))
  audio.src = audioUrl.href
  audio.volume = volume
  audio.setAttribute('aria-label', `${clip.title}, native audio controls`)
  const noteLabel = node('label', 'note-label', 'Your listening note')
  noteLabel.htmlFor = `clip-note-${index}`
  noteLabel.append(node('span', '', 'Saved in this browser'))
  const note = node('textarea', 'clip-note')
  note.id = `clip-note-${index}`
  note.rows = 3
  note.maxLength = 4000
  note.placeholder = 'What feels right? What would you change?'
  note.value = review.note
  detailsBody.append(
    sourceTitle,
    sourceMeta,
    hideSourceButton,
    sourceFacts,
    audio,
    noteLabel,
    note
  )
  details.append(summary, detailsBody)
  card.append(top)
  if (reviewedClipIds.has(clip.id) || isNewClip(clip)) {
    const status = node(
      'p',
      'review-history',
      reviewedClipIds.has(clip.id)
        ? 'Previously reviewed'
        : `New candidate${clip.origin ? ` · ${cleanText(clip.origin)}` : ''}`
    )
    status.classList.toggle('is-new', isNewClip(clip))
    card.append(status)
  }
  card.append(heading, description)
  if (clipKind(clip) === 'room-effect') {
    const rooms = (clip.rooms || [])
      .map((room) => roomNames[room])
      .filter(Boolean)
      .join(' · ')
    const useCase = cleanText(clip.useCase)
    const context =
      useCase === cleanText(clip.description)
        ? rooms
        : [rooms, useCase].filter(Boolean).join(' — ')
    card.append(node('p', 'clip-use', context))
  }
  const assignment = createAssignmentDetails(clip)
  if (assignment) card.append(assignment)
  card.append(tags, playerRow, error, details)

  const player = {
    clip,
    card,
    audio,
    button,
    seek,
    current,
    duration,
    error,
    favorite,
    note,
    summary
  }
  button.addEventListener('click', async () => {
    if (!audio.paused && !audio.ended) {
      audio.pause()
      return
    }
    setClipError(player, '')
    for (const other of players) if (other !== player) other.audio.pause()
    if (audio.error) audio.load()
    if (audio.ended) audio.currentTime = 0
    try {
      await audio.play()
    } catch (err) {
      if (err.name !== 'AbortError')
        setClipError(
          player,
          'This clip couldn’t play. Try Play again, or open its source below.'
        )
      updatePlayer(player)
      setPlaybackStatus()
    }
  })
  audio.addEventListener('play', () => {
    if (isHidden(clip)) audio.pause()
    if (audio.paused) return
    for (const other of players) if (other !== player) other.audio.pause()
    setClipError(player, '')
    updatePlayer(player)
    setPlaybackStatus()
  })
  for (const event of [
    'pause',
    'ended',
    'loadedmetadata',
    'durationchange',
    'timeupdate'
  ]) {
    audio.addEventListener(event, () => {
      updatePlayer(player)
      if (event !== 'timeupdate') setPlaybackStatus()
    })
  }
  audio.addEventListener('error', () => {
    setClipError(
      player,
      'This clip couldn’t load. Try Play again, or open its source below.'
    )
    updatePlayer(player)
    setPlaybackStatus()
  })
  seek.addEventListener('input', () => {
    if (Number.isFinite(audio.duration)) {
      audio.currentTime = Math.min(audio.duration, Number(seek.value))
      updatePlayer(player)
      setPlaybackStatus()
    }
  })
  favorite.addEventListener('click', () => {
    updateReview(clip.id, (saved) => {
      saved.favorite = !saved.favorite
    })
    updateSourceOptions()
    applyFilters()
    if (card.hidden) elements.favorites.focus()
  })
  note.addEventListener('input', () => {
    updateReview(clip.id, (saved) => {
      saved.note = note.value
    })
  })
  updatePlayer(player)
  return player
}

function applyFilters() {
  const selectedSource = elements.source.value
  let matching = 0
  let shown = 0
  for (const player of players) {
    const matches =
      matchesContext(player.clip) &&
      (!selectedSource || sourceKey(player.clip) === selectedSource)
    if (matches) matching++
    const visible = matches && matching <= visibleLimit
    player.card.hidden = !visible
    player.card.dataset.feedbackHidden = String(isHidden(player.clip))
    if (visible) shown++
    else player.audio.pause()
  }
  const favorites = clips.filter(
    (clip) => !isHidden(clip) && reviewFor(clip.id).favorite
  )
  const latest = clips.filter((clip) => !isHidden(clip) && isLatestBatch(clip))
  elements.favoriteCount.textContent = String(favorites.length)
  elements.newCount.textContent = String(latest.length)
  for (const filter of ['all', 'new', 'favorites', 'mischief'])
    elements[filter].setAttribute(
      'aria-pressed',
      String(activeFilter === filter)
    )
  const room = roomNames[elements.room.value]
  const family = voiceFamilies.get(elements.family.value)
  elements.collectionDescription.textContent = family
    ? `${family}. Related reactions keep a creature’s voice recognizable.`
    : room
      ? `Audition sounds for ${room}. Favorites shape the room’s little interactions.`
      : activeFilter === 'new'
        ? `${latest.filter((clip) => clipKind(clip) === 'voice').length} voices · ${latest.filter((clip) => clipKind(clip) === 'room-effect').length} room effects from the latest batch. Your review stays with each sound.`
        : activeFilter === 'mischief'
          ? 'Playful babble, delighted squeaks, and a little mischief.'
          : 'Press play. Keep what makes you curious.'
  const hiddenCount = clips.filter(isHidden).length
  const available = clips.length - hiddenCount
  elements.count.textContent = `${shown < matching ? `${shown} shown / ` : ''}${matching} ${matching === 1 ? 'sound' : 'sounds'}${hiddenCount ? ` · ${hiddenCount} hidden` : ''}`
  elements.progress.hidden = matching === 0
  elements.progressText.textContent =
    shown < matching
      ? `Showing ${shown} of ${matching} matching sounds`
      : `All ${matching} matching sounds are shown`
  elements.more.hidden = shown >= matching
  elements.more.textContent = `Show ${Math.min(pageSize, matching - shown)} more`
  elements.showAll.hidden = shown >= matching
  elements.showAll.textContent = `Show all ${matching}`
  elements.hideSource.disabled = !selectedSource
  elements.room.disabled = elements.kind.value === 'voice'
  elements.family.disabled =
    voiceFamilies.size === 0 || elements.kind.value === 'room-effect'
  elements.empty.hidden = matching > 0
  elements.emptyTitle.textContent =
    available === 0 ? 'Everything is hidden.' : 'No sounds in this selection.'
  elements.emptyDescription.textContent =
    available === 0
      ? 'Restore a sound or source from Hidden to keep listening.'
      : 'Try another family, room, sound type, source or search. Your other sounds and favorites are still here.'
  elements.reset.hidden = available === 0
  elements.showHidden.hidden = hiddenCount === 0
  renderHiddenItems()
  setPlaybackStatus()
}

function resetPageAndFilter() {
  visibleLimit = pageSize
  updateSourceOptions()
  applyFilters()
  const url = new URL(location.href)
  for (const [key, value] of Object.entries({
    collection: activeFilter === 'all' ? '' : activeFilter,
    kind: elements.kind.value,
    family: elements.family.value,
    room: elements.room.value,
    q: elements.search.value.trim(),
    source:
      clips.find((clip) => sourceKey(clip) === elements.source.value)?.source
        ?.id ||
      clips.find((clip) => sourceKey(clip) === elements.source.value)?.source
        ?.videoId ||
      elements.source.value
  })) {
    if (value) url.searchParams.set(key, value)
    else url.searchParams.delete(key)
  }
  history.replaceState(null, '', url)
}

function revealMore(all = false) {
  const previouslyShown = new Set(
    players.filter((player) => !player.card.hidden)
  )
  visibleLimit = all ? clips.length : visibleLimit + pageSize
  applyFilters()
  const firstNew = players.find(
    (player) => !player.card.hidden && !previouslyShown.has(player)
  )
  if (firstNew) {
    const heading = firstNew.card.querySelector('h3')
    heading.tabIndex = -1
    heading.focus({ preventScroll: true })
    firstNew.card.scrollIntoView({ block: 'start' })
  }
}

function buildReview() {
  const favorites = clips.filter(
    (clip) => !isHidden(clip) && reviewFor(clip.id).favorite
  )
  const noted = clips.filter(
    (clip) =>
      !isHidden(clip) &&
      reviewFor(clip.id).note.trim() &&
      !reviewFor(clip.id).favorite
  )
  const selected = [...favorites, ...noted]
  const lines = [
    studyTitle,
    'Burning Tokens · Voice and room sound audition',
    '',
    `${favorites.length} favorite${favorites.length === 1 ? '' : 's'} from ${clips.length} clips.`,
    ''
  ]
  if (!selected.length)
    lines.push('No visible favorites or listening notes recorded yet.')
  for (const clip of selected) {
    const review = reviewFor(clip.id)
    lines.push(
      `${review.favorite ? '★ Favorite' : 'Listening note'} — ${clip.title} [${clip.id}]`
    )
    if (review.note.trim()) lines.push(review.note.trim())
    if (clip.rooms?.length)
      lines.push(
        `Rooms: ${clip.rooms.map((room) => roomNames[room] || room).join(', ')}`
      )
    if (clip.useCase) lines.push(`Use: ${clip.useCase}`)
    const assignment = soundAssignments.get(clip.id)
    const family = voiceFamilies.get(assignment?.familyId)
    if (family) lines.push(`Voice family: ${family}`)
    if (assignment?.roles.length)
      lines.push(
        `Reactions: ${assignment.roles.map((role) => reactionNames[role]).join(', ')}`
      )
    if (clip.source?.url) lines.push(`Source: ${clip.source.url}`)
    if (
      Number.isFinite(clip.source?.start) &&
      Number.isFinite(clip.source?.end)
    )
      lines.push(
        `Excerpt: ${timestamp(clip.source.start, true)}–${timestamp(clip.source.end, true)}`
      )
    lines.push('')
  }
  const hiddenSources = sourcesInStudy().filter((source) =>
    hiddenChoices.sources.has(source.key)
  )
  const hiddenSounds = clips.filter(
    (clip) =>
      hiddenChoices.clips.has(clip.id) ||
      (hiddenChoices.sources.has(sourceKey(clip)) &&
        (reviewFor(clip.id).note.trim() || reviewFor(clip.id).favorite))
  )
  if (hiddenSources.length || hiddenSounds.length) {
    lines.push('', 'Disliked / hidden', '')
    for (const source of hiddenSources) {
      lines.push(
        `Hidden source — ${source.title}`,
        `Source: ${source.key}`,
        `${source.clips.length} clips hidden from this source.`,
        ''
      )
    }
    for (const clip of hiddenSounds) {
      lines.push(
        `${hiddenChoices.clips.has(clip.id) ? 'Hidden sound' : 'Hidden by source'}${reviewFor(clip.id).favorite ? ' · ★ Favorite' : ''} — ${clip.title} [${clip.id}]`
      )
      if (reviewFor(clip.id).note.trim())
        lines.push(reviewFor(clip.id).note.trim())
      if (clip.rooms?.length)
        lines.push(
          `Rooms: ${clip.rooms.map((room) => roomNames[room] || room).join(', ')}`
        )
      if (clip.useCase) lines.push(`Use: ${clip.useCase}`)
      if (clip.source?.url) lines.push(`Source: ${clip.source.url}`)
      lines.push('')
    }
  }
  if (hiddenFamilies.size) {
    lines.push('Hidden voice families')
    for (const id of hiddenFamilies)
      lines.push(`${voiceFamilies.get(id) || id} [${id}]`)
  }
  return lines.join('\n').trim()
}

function downloadReview() {
  const snapshot = {
    reviewedOn: new Date().toISOString().slice(0, 10),
    reviewedClipIds: clips
      .filter(
        (clip) =>
          reviewedClipIds.has(clip.id) ||
          reviewFor(clip.id).favorite ||
          reviewFor(clip.id).note.trim() ||
          isHidden(clip)
      )
      .map((clip) => clip.id),
    reviews: Object.fromEntries(
      clips.map((clip) => [clip.id, reviewFor(clip.id)])
    ),
    hidden: {
      clips: [...hiddenChoices.clips],
      sources: [...hiddenChoices.sources],
      families: [...hiddenFamilies]
    }
  }
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
  )
  const link = node('a')
  link.href = url
  link.download = `burning-tokens-audio-review-${snapshot.reviewedOn}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  elements.reviewStatus.textContent =
    'Feedback download prepared. It includes all stars, notes and hides.'
}

async function copyReview() {
  const text = buildReview()
  elements.fallback.hidden = true
  try {
    if (!navigator.clipboard?.writeText)
      throw new Error('Clipboard unavailable')
    await navigator.clipboard.writeText(text)
    elements.reviewStatus.textContent =
      'Listening notes copied. Ready to take with you.'
  } catch {
    elements.fallback.hidden = false
    elements.reviewText.value = text
    elements.reviewText.focus()
    elements.reviewText.select()
    elements.reviewStatus.textContent =
      'Select and copy the notes above. Automatic copying is unavailable in this browser.'
  }
}

async function loadClips() {
  loadController?.abort()
  loadController = new AbortController()
  const controller = loadController
  const timeout = setTimeout(() => controller.abort(), 15000)
  stopAll()
  for (const player of players) {
    player.audio.removeAttribute('src')
    player.audio.load()
  }
  players = []
  clips = []
  elements.list.replaceChildren()
  elements.list.setAttribute('aria-busy', 'true')
  elements.error.hidden = true
  elements.empty.hidden = true
  elements.count.textContent = 'Loading sounds…'
  elements.copy.disabled = true
  try {
    const [response, snapshot, soundCatalog] = await Promise.all([
      fetch('./clips.json', { signal: controller.signal }),
      loadOptionalJson(
        './reviewed-2026-09-15-family-pass.json',
        controller.signal
      ),
      loadOptionalJson(
        '../living-world/dynamics/sound-catalog.json',
        controller.signal
      )
    ])
    if (controller !== loadController) return
    if (!response.ok) throw new Error(`Manifest response ${response.status}`)
    const data = await response.json()
    if (!data || !Array.isArray(data.clips))
      throw new Error('Invalid clip manifest')
    const ids = new Set()
    clips = data.clips
      .filter((clip) => {
        if (
          !clip ||
          typeof clip.id !== 'string' ||
          !clip.id.trim() ||
          typeof clip.title !== 'string' ||
          typeof clip.src !== 'string' ||
          !clip.src.trim() ||
          ids.has(clip.id)
        )
          return false
        ids.add(clip.id)
        return true
      })
      .map((clip) => ({
        ...clip,
        duration:
          Number.isFinite(clip.duration) && clip.duration > 0
            ? clip.duration
            : 0
      }))
    if (data.clips.length > 0 && clips.length === 0)
      throw new Error('No valid clips in manifest')
    seedReviewedChoices(snapshot)
    loadSoundClassifications(soundCatalog)
    familyPreferences.applySnapshot(snapshot, '2026-09-15-family-pass')
    familyPreferences.migrateFamilies(soundCatalog?.retiredFamilies)
    studyTitle = cleanText(data.title, studyTitle)
    if (cleanText(data.description))
      document.querySelector('#study-description').textContent =
        data.description
    const params = new URLSearchParams(location.search)
    elements.kind.value = ['voice', 'room-effect'].includes(params.get('kind'))
      ? params.get('kind')
      : ''
    elements.room.value = Object.hasOwn(roomNames, params.get('room'))
      ? params.get('room')
      : ''
    if (elements.room.value) elements.kind.value = 'room-effect'
    const requestedFamily = params.get('family')
    const resolvedFamily =
      soundCatalog?.retiredFamilies?.find(
        (family) => family.id === requestedFamily
      )?.replacementId || requestedFamily
    elements.family.value = voiceFamilies.has(resolvedFamily)
      ? resolvedFamily
      : ''
    if (elements.family.value) {
      elements.kind.value = 'voice'
      elements.room.value = ''
    }
    elements.search.value = params.get('q') || ''
    updateSourceOptions()
    const requestedSource = new URLSearchParams(location.search).get('source')
    const matchingSource = clips.find(
      (clip) =>
        requestedSource &&
        [clip.source?.id, clip.source?.videoId, sourceKey(clip)].includes(
          requestedSource
        )
    )
    if (matchingSource && !hiddenChoices.sources.has(sourceKey(matchingSource)))
      updateSourceOptions(sourceKey(matchingSource))
    players = clips.map(createPlayer)
    elements.list.append(...players.map(({ card }) => card))
    elements.copy.disabled = clips.length === 0
    applyFilters()
  } catch (err) {
    if (controller !== loadController) return
    elements.error.hidden = false
    elements.count.textContent = 'Sounds unavailable'
    elements.errorDescription.textContent =
      location.protocol === 'file:'
        ? 'Open this study through the local preview server so it can read its clip manifest. The setup is in Sources & study notes below.'
        : err.name === 'AbortError'
          ? 'Loading took too long. Check the connection and try again.'
          : 'The clip manifest couldn’t be read. Try again, or check Sources & study notes below.'
  } finally {
    clearTimeout(timeout)
    if (controller === loadController)
      elements.list.setAttribute('aria-busy', 'false')
  }
}

for (const filter of ['all', 'new', 'favorites', 'mischief']) {
  elements[filter].addEventListener('click', () => {
    activeFilter = filter
    resetPageAndFilter()
  })
}
elements.source.addEventListener('change', resetPageAndFilter)
elements.kind.addEventListener('change', () => {
  if (elements.kind.value === 'voice') elements.room.value = ''
  if (elements.kind.value === 'room-effect') elements.family.value = ''
  resetPageAndFilter()
})
elements.family.addEventListener('change', () => {
  if (elements.family.value) {
    elements.kind.value = 'voice'
    elements.room.value = ''
  }
  resetPageAndFilter()
})
elements.room.addEventListener('change', () => {
  if (elements.room.value) {
    elements.kind.value = 'room-effect'
    elements.family.value = ''
  }
  resetPageAndFilter()
})
elements.search.addEventListener('input', resetPageAndFilter)
elements.more.addEventListener('click', () => revealMore())
elements.showAll.addEventListener('click', () => revealMore(true))
elements.download.addEventListener('click', downloadReview)
elements.reset.addEventListener('click', () => {
  activeFilter = 'all'
  elements.source.value = ''
  elements.kind.value = ''
  elements.family.value = ''
  elements.room.value = ''
  elements.search.value = ''
  resetPageAndFilter()
  elements.all.focus()
})
elements.volume.addEventListener('input', () => {
  volume = Number(elements.volume.value) / 100
  elements.volumeValue.textContent = `${elements.volume.value}%`
  for (const { audio } of players) audio.volume = volume
})
elements.stop.addEventListener('click', stopAll)
elements.copy.addEventListener('click', copyReview)
elements.retry.addEventListener('click', loadClips)
elements.hideSource.addEventListener('click', () =>
  hideSource(elements.source.value)
)
elements.showHidden.addEventListener('click', () => {
  elements.hiddenItems.open = true
  elements.hiddenItems.querySelector('summary').focus()
  elements.hiddenItems.scrollIntoView({ block: 'nearest' })
})
elements.undo.addEventListener('click', () => {
  if (!undoChoices) return
  hiddenChoices = undoChoices
  undoChoices = undefined
  saveHiddenChoices()
  updateSourceOptions()
  applyFilters()
  elements.dismissalStatus.textContent =
    'Undone. Your previous choices are restored.'
  elements.dismissalFeedback.hidden = true
  elements.undo.hidden = true
  elements[activeFilter].focus({ preventScroll: true })
})
elements.dismissNotice.addEventListener('click', () => {
  elements.dismissalFeedback.hidden = true
  elements[activeFilter].focus({ preventScroll: true })
})
window.addEventListener('storage', (event) => {
  if (![storageKey, hiddenStorageKey, null].includes(event.key)) return
  if (event.key === storageKey || event.key === null) {
    reviews = readReviews(reviews)
    syncReviewControls()
    updateSourceOptions()
  }
  if (event.key === hiddenStorageKey || event.key === null) {
    hiddenChoices = readHiddenChoices()
    undoChoices = undefined
    elements.undo.hidden = true
    elements.dismissalFeedback.hidden = true
    updateSourceOptions()
  }
  applyFilters()
})
window.addEventListener('pagehide', stopAll)
void loadClips()
