import { createSoundReviewPreferences } from '../review-preferences.js'

const reviewKey = 'burning-tokens-creature-audio-review-v1'
const $ = (id) => document.getElementById(id)
const voiceRoles = {
  hover: 'Curious',
  pickup: 'Picked up',
  surprise: 'Surprised',
  drop: 'Set-down reaction',
  nudge: 'Delighted',
  idle: 'Contented'
}
const effectRoles = {
  hover: 'Touch',
  pickup: 'Pick up',
  surprise: 'Movement',
  drop: 'Surface contact',
  nudge: 'Bump',
  idle: 'Occasional detail'
}
const roomNames = {
  camp: 'Camp',
  bathhouse: 'Bathhouse',
  'dream-garden': 'Dream Garden',
  'quiet-house': 'Quiet House',
  source: 'The Source',
  'open-studio': 'Open Studio',
  hearth: 'Hearth',
  temple: 'Temple'
}
const categories = {
  voices: {
    description:
      'One family per creature. A set-down reaction is its voice; the physical landing lives in Putting down.'
  },
  drops: {
    description:
      'Physical surface sounds, separate from every creature’s voice. Compare soft, wooden, ceramic and water landings.'
  },
  effects: {
    description:
      'Small room details grouped by material and mood. Music and continuous ambience come later.'
  }
}
let catalog = { clips: [], families: [] }
let manifest = new Map()
let snapshot = {}
let reviews = {}
let category = ['voices', 'drops', 'effects'].includes(
  new URLSearchParams(location.search).get('kind')
)
  ? new URLSearchParams(location.search).get('kind')
  : 'voices'
let exclusions = { clipIds: [], familyIds: [], sourceKeys: [] }
let activePlayers = []
let playingIds = new Set()
let playbackGeneration = 0
let undoAction
let initialized = false
const openGroups = new Set()
const preferences = createSoundReviewPreferences({
  onChange: (value) => {
    exclusions = value
    if (initialized) {
      stopPlayback()
      render()
      updatePairing()
    }
  },
  onError: () => {
    $('storage-error').hidden = false
  }
})

function node(tag, className, text) {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (text !== undefined) element.textContent = text
  return element
}
function button(label, className, action, ariaLabel = label) {
  const element = node('button', className, label)
  element.type = 'button'
  element.setAttribute('aria-label', ariaLabel)
  element.addEventListener('click', action)
  return element
}
function readReviews() {
  reviews = { ...snapshot.reviews, ...reviews }
  try {
    const stored = JSON.parse(localStorage.getItem(reviewKey) || '{}')
    const valid =
      stored && typeof stored === 'object' && !Array.isArray(stored)
        ? stored
        : {}
    reviews = { ...snapshot.reviews, ...valid }
  } catch {
    $('storage-error').hidden = false
  }
  return reviews
}
function like(clip) {
  readReviews()
  reviews[clip.id] = { ...reviews[clip.id], favorite: true }
  try {
    localStorage.setItem(reviewKey, JSON.stringify(reviews))
  } catch {
    $('storage-error').hidden = false
  }
  render()
  $('playback-status').textContent = `Liked: ${clip.title}.`
}
function hiddenReasons(clip) {
  return {
    clip: exclusions.clipIds.includes(clip.id),
    family: clip.kind === 'voice' && exclusions.familyIds.includes(clip.family),
    source: exclusions.sourceKeys.includes(clip.sourceUrl)
  }
}
function isHidden(clip) {
  return Object.values(hiddenReasons(clip)).some(Boolean)
}
function isDrop(clip) {
  return clip.kind !== 'voice' && clip.roles.includes('drop')
}
function groupForEffect(clip, drop = false) {
  const has = (target) => clip.targets.includes(target)
  if (has('water') && !has('kettle'))
    return [
      'water',
      drop ? 'Water landings' : 'Mineral water',
      drop
        ? 'A splash where a little creature meets the pool.'
        : 'Bubbles, small waves and the nearby movement of water.'
    ]
  if (has('fire') || has('kettle'))
    return [
      'hearth',
      'Fire & kettle',
      'Warm crackles and the small sounds around a shared fire.'
    ]
  if (drop && (has('soft') || has('fabric')))
    return [
      'soft',
      'Soft landings',
      'Quiet little bumps for clay paths, cushions and gentle handling.'
    ]
  if (has('bell') || has('chime'))
    return [
      'chimes',
      'Bells & little wonders',
      'Resonant points of light for the Temple, garden and quiet discoveries.'
    ]
  if (has('electric') || has('switch'))
    return [
      'electric',
      drop ? 'Tactile releases' : 'Signals & electricity',
      drop
        ? 'Brief contact cues with a more electronic character.'
        : 'Small signals and curious electrical responses around The Source.'
    ]
  if (has('magic'))
    return [
      'magic',
      drop ? 'Strange little bumps' : 'Strange garden gestures',
      'Filtered pulses and peculiar little movements.'
    ]
  if (has('wood'))
    return [
      'wood',
      drop ? 'Wooden landings' : 'Wood & plucked notes',
      'Hollow, tactile notes from warm wooden surfaces.'
    ]
  if (has('ceramic') || has('metal'))
    return [
      'ceramic',
      drop ? 'Ceramic & metal contact' : 'Cups, bottles & tools',
      'Bright little clinks from glazed surfaces and small objects.'
    ]
  if (has('paper'))
    return [
      'paper',
      'Paper & making',
      'Pages, journals and the small sound of leaving a mark.'
    ]
  if (has('fabric') || has('soft'))
    return [
      'fabric',
      'Fabric & cushions',
      'Soft folds and close, gentle material movements.'
    ]
  return [
    'handling',
    drop ? 'Footfalls & contact' : 'Hands & small objects',
    'Tactile details for creatures moving through a handmade world.'
  ]
}
function allGroups() {
  if (category === 'voices')
    return catalog.families.map((family, index) => ({
      ...family,
      key: `voice-${family.id}`,
      ordinal: index + 1,
      clips: catalog.clips.filter(
        (clip) => clip.kind === 'voice' && clip.family === family.id
      ),
      voice: true
    }))
  const groups = new Map()
  for (const clip of catalog.clips.filter(
    (item) =>
      item.kind !== 'voice' &&
      (category === 'drops' ? isDrop(item) : !isDrop(item))
  )) {
    const [id, label, description] = groupForEffect(clip, category === 'drops')
    if (!groups.has(id))
      groups.set(id, {
        id,
        key: `${category}-${id}`,
        label,
        description,
        clips: [],
        voice: false
      })
    groups.get(id).clips.push(clip)
  }
  return [...groups.values()]
}
function queryMatches(clip, group) {
  const query = $('search').value.trim().toLowerCase()
  const text = [
    clip.title,
    ...clip.tags,
    ...clip.roles.map((role) => voiceRoles[role]),
    ...clip.rooms.map((room) => roomNames[room]),
    group.label,
    group.description
  ]
    .join(' ')
    .toLowerCase()
  return !query || query.split(/\s+/).every((word) => text.includes(word))
}
function performChange(message, apply, reverse) {
  stopPlayback()
  undoAction = reverse
  apply()
  $('undo-message').textContent = message
  $('undo-bar').hidden = false
}
function syncPlaying() {
  for (const row of document.querySelectorAll('[data-clip-id]')) {
    const playing = playingIds.has(row.dataset.clipId)
    row.dataset.playing = String(playing)
    row.querySelector('.play-button').textContent = playing ? '■' : '▶'
  }
  $('stop').disabled = activePlayers.length === 0
}
function stopPlayback() {
  playbackGeneration++
  for (const entry of activePlayers) {
    entry.audio.pause()
    entry.finish(false)
  }
  activePlayers = []
  playingIds.clear()
  syncPlaying()
  $('playback-status').textContent = 'Nothing playing.'
}
function playClip(clip, generation, gain = 1) {
  if (generation !== playbackGeneration) return Promise.resolve(false)
  return new Promise((resolve) => {
    const audio = new Audio(new URL(`../${clip.src}`, location.href).href)
    audio.preload = 'none'
    audio.volume = (Number($('volume').value) / 100) * gain
    let finished = false
    const entry = {
      audio,
      gain,
      finish: (success) => {
        if (finished) return
        finished = true
        activePlayers = activePlayers.filter((item) => item !== entry)
        playingIds.delete(clip.id)
        syncPlaying()
        resolve(success)
      }
    }
    activePlayers.push(entry)
    playingIds.add(clip.id)
    syncPlaying()
    audio.addEventListener('ended', () => entry.finish(true), { once: true })
    audio.addEventListener(
      'error',
      () => {
        entry.finish(false)
        $('playback-status').textContent =
          `Couldn’t play ${clip.title}. Try again.`
      },
      { once: true }
    )
    audio.play().catch(() => {
      entry.finish(false)
      $('playback-status').textContent =
        `Couldn’t play ${clip.title}. Try again.`
    })
  })
}
async function audition(clips, label) {
  stopPlayback()
  const generation = playbackGeneration
  for (const clip of clips) {
    if (generation !== playbackGeneration) return
    $('playback-status').textContent = `${label}: ${clip.title}`
    if (!(await playClip(clip, generation))) return
  }
  if (generation === playbackGeneration)
    $('playback-status').textContent = `Finished: ${label}.`
}
function clipRow(clip) {
  const row = node('div', 'clip-row')
  row.dataset.clipId = clip.id
  row.dataset.feedbackHidden = String(isHidden(clip))
  const main = node('div', 'clip-main')
  main.append(
    button(
      '▶',
      'play-button',
      () =>
        playingIds.has(clip.id)
          ? stopPlayback()
          : audition(
              [clip],
              clip.kind === 'voice' ? 'Voice' : 'Surface / room sound'
            ),
      `Play ${clip.title}`
    )
  )
  const info = node('div', 'clip-info')
  info.append(node('p', 'clip-title', clip.title))
  const roleNames = clip.kind === 'voice' ? voiceRoles : effectRoles
  main.querySelector('.play-button').title =
    `${clip.duration.toFixed(2)}s · ${clip.roles
      .map((role) => roleNames[role])
      .filter(Boolean)
      .join(' · ')}`
  main.append(info)
  const liked = reviews[clip.id]?.favorite === true
  const likeButton = button(
    liked ? '★' : '☆',
    'like-button',
    () => like(clip),
    `${liked ? 'Liked' : 'Like'} ${clip.title}`
  )
  likeButton.setAttribute('aria-pressed', String(liked))
  likeButton.title = liked
    ? 'Previously liked. Your star is saved.'
    : 'Like this sound'
  main.append(likeButton)
  const reason = hiddenReasons(clip)
  if (reason.clip)
    main.append(
      button('Restore', 'clip-action', () =>
        performChange(
          `Restored ${clip.title}.${reason.family ? ' Its family is still hidden.' : reason.source ? ' Its source is still hidden.' : ''}`,
          () => preferences.restoreClip(clip.id),
          () => preferences.hideClip(clip.id)
        )
      )
    )
  else if (!reason.family && !reason.source)
    main.append(
      button(
        'Dislike',
        'clip-action',
        () =>
          performChange(
            `Removed ${clip.title}. Its star and note are kept.`,
            () => preferences.hideClip(clip.id),
            () => preferences.restoreClip(clip.id)
          ),
        `Dislike ${clip.title}`
      )
    )
  else
    main.append(
      node(
        'span',
        'inherited-hidden',
        reason.family ? 'Family hidden' : 'Source hidden'
      )
    )
  row.append(main)
  return row
}
function groupCard(group, shownClips, index) {
  const card = node('details', 'sound-group')
  card.dataset.groupId = group.key
  card.dataset.familyHidden = String(
    group.voice && exclusions.familyIds.includes(group.id)
  )
  card.open =
    openGroups.has(group.key) ||
    !!$('search').value.trim() ||
    $('show-hidden').checked ||
    (!initialized && index < 2)
  const summary = node('summary', 'group-summary')
  const heading = node('div')
  heading.append(
    node(
      'span',
      'family-number',
      group.voice
        ? `Voice family ${String(group.ordinal).padStart(2, '0')}`
        : category === 'drops'
          ? 'Physical putting-down sounds'
          : 'Room effects'
    )
  )
  heading.append(node('h3', '', group.label))
  const active = group.clips.filter((clip) => !isHidden(clip)).length
  heading.append(
    node(
      'p',
      'group-meta',
      `${active} of ${group.clips.length} ${group.clips.length === 1 ? 'take' : 'takes'} active${group.voice && group.clips.length === 1 ? ' · one-take personality' : ''}`
    )
  )
  summary.append(heading, node('span', 'expand-symbol', '+'))
  card.append(summary)
  const content = node('div', 'group-content')
  content.append(node('p', 'group-description', group.description))
  const controls = node('div', 'group-actions')
  controls.append(
    button(group.voice ? '▶ Hear this family' : '▶ Hear this group', '', () =>
      audition(shownClips, group.label)
    )
  )
  if (group.voice) {
    const familyHidden = exclusions.familyIds.includes(group.id)
    controls.append(
      button(
        familyHidden ? 'Restore family' : 'Dislike family',
        familyHidden ? '' : 'reject',
        () =>
          performChange(
            familyHidden
              ? `Restored ${group.label}. Individual dislikes stay hidden.`
              : `Removed ${group.label} from the prototype. Individual stars and notes are kept.`,
            () =>
              preferences[familyHidden ? 'restoreFamily' : 'hideFamily'](
                group.id
              ),
            () =>
              preferences[familyHidden ? 'hideFamily' : 'restoreFamily'](
                group.id
              )
          )
      )
    )
  }
  content.append(controls)
  for (const clip of shownClips) content.append(clipRow(clip))
  const sources = new Map()
  for (const clip of group.clips) {
    const original = manifest.get(clip.id)
    if (clip.sourceUrl && !sources.has(clip.sourceUrl))
      sources.set(clip.sourceUrl, original?.source?.title || 'Recording source')
  }
  if (sources.size) {
    const provenance = node('details', 'group-sources')
    provenance.append(node('summary', '', 'Recording sources'))
    for (const [url, title] of sources) {
      try {
        if (!['http:', 'https:'].includes(new URL(url).protocol)) continue
      } catch {
        continue
      }
      const link = node('a', '', title)
      link.href = url
      link.target = '_blank'
      link.rel = 'noreferrer'
      provenance.append(link)
    }
    content.append(provenance)
  }
  card.append(content)
  card.addEventListener('toggle', () => {
    if (!card.isConnected) return
    if (card.open) openGroups.add(group.key)
    else openGroups.delete(group.key)
  })
  return card
}
function render() {
  const hidden = $('show-hidden').checked
  const active = catalog.clips.filter((clip) => !isHidden(clip))
  $('catalog-count').textContent =
    `${active.length} active sounds · ${catalog.clips.length} previously selected`
  $('voices-count').textContent = catalog.families.filter((family) =>
    active.some((clip) => clip.family === family.id)
  ).length
  $('drops-count').textContent = active.filter(isDrop).length
  $('effects-count').textContent = active.filter(
    (clip) => clip.kind !== 'voice' && !isDrop(clip)
  ).length
  $('hidden-count').textContent = catalog.clips.length - active.length
  for (const key of Object.keys(categories))
    $(`tab-${key}`).setAttribute('aria-pressed', String(category === key))
  $('section-description').textContent = hidden
    ? 'Hidden sounds can still be auditioned here. Restore a family, source or individual take whenever you like.'
    : categories[category].description
  const fragment = document.createDocumentFragment()
  let count = 0
  for (const group of allGroups()) {
    const shown = group.clips.filter(
      (clip) => isHidden(clip) === hidden && queryMatches(clip, group)
    )
    if (!shown.length) continue
    fragment.append(groupCard(group, shown, count++))
  }
  $('group-list').replaceChildren(fragment)
  $('group-list').setAttribute('aria-busy', 'false')
  $('empty').hidden = count > 0
  $('empty-description').textContent = hidden
    ? 'No hidden sounds match this view. Try another category or search.'
    : 'Try another category, clear your search, or restore a hidden sound.'
  $('reset-search').hidden = !$('search').value
  const sourceButtons = []
  if (hidden)
    for (const key of exclusions.sourceKeys) {
      const clip = catalog.clips.find((item) => item.sourceUrl === key)
      if (!clip) continue
      sourceButtons.push(
        button(
          `Restore source: ${manifest.get(clip.id)?.source?.title || 'Recording source'}`,
          '',
          () =>
            performChange(
              'Source restored. Individual and family dislikes stay hidden.',
              () => preferences.restoreSource(key),
              () => preferences.hideSource(key)
            )
        )
      )
    }
  $('source-restores').replaceChildren(...sourceButtons)
  $('source-restores').hidden = !sourceButtons.length
  syncPlaying()
}
function options(element, entries, selected) {
  element.replaceChildren(
    ...entries.map((entry) => new Option(entry.label, entry.id))
  )
  if (entries.some((entry) => entry.id === selected)) element.value = selected
  element.disabled = !entries.length
}
function updatePairing() {
  const available = catalog.clips.filter((clip) => !isHidden(clip))
  options(
    $('pair-family'),
    catalog.families.filter((family) =>
      available.some((clip) => clip.family === family.id)
    ),
    $('pair-family').value
  )
  const voices = available.filter(
    (clip) => clip.kind === 'voice' && clip.family === $('pair-family').value
  )
  const drops = voices.filter((clip) => clip.roles.includes('drop'))
  const reactions = drops.length ? drops : voices
  options(
    $('pair-voice'),
    reactions.map((clip) => ({ id: clip.id, label: clip.title })),
    $('pair-voice').value
  )
  const physical = available.filter(isDrop)
  const initialFoley = physical.find(
    (clip) => clip.id === 'room-kenney-drop-001'
  )?.id
  options(
    $('pair-foley'),
    physical.map((clip) => ({ id: clip.id, label: clip.title })),
    $('pair-foley').value || initialFoley
  )
  $('play-pair').disabled = !reactions.length || !physical.length
  $('pair-note').textContent =
    !reactions.length || !physical.length
      ? 'Restore a voice and a putting-down sound to hear a pair.'
      : drops.length
        ? 'Voice reaction + surface contact. Two layers of the same landing.'
        : 'This family has no dedicated set-down take; it uses a same-family voice fallback.'
}
async function playPair() {
  const voice = catalog.clips.find((clip) => clip.id === $('pair-voice').value)
  const foley = catalog.clips.find((clip) => clip.id === $('pair-foley').value)
  if (!voice || !foley || isHidden(voice) || isHidden(foley)) return
  stopPlayback()
  const generation = playbackGeneration
  $('playback-status').textContent = `${voice.title} + ${foley.title}`
  const results = await Promise.all([
    playClip(voice, generation, 0.8),
    playClip(foley, generation, 0.6)
  ])
  if (generation === playbackGeneration && results.every(Boolean))
    $('playback-status').textContent = 'Finished: voice + putting-down sound.'
}
async function load() {
  $('load-error').hidden = true
  try {
    const paths = [
      '../../living-world/dynamics/sound-catalog.json',
      '../clips.json',
      '../reviewed-2026-09-15-family-pass.json'
    ]
    const results = await Promise.all(
      paths.map(async (path) => {
        const response = await fetch(path)
        if (!response.ok) throw new Error(`Couldn’t load ${path}`)
        return response.json()
      })
    )
    if (!Array.isArray(results[0].clips) || !Array.isArray(results[0].families))
      throw new Error('Invalid catalog')
    catalog = results[0]
    manifest = new Map(results[1].clips.map((clip) => [clip.id, clip]))
    snapshot = results[2]
    readReviews()
    preferences.applySnapshot(snapshot, catalog.reviewRevision)
    preferences.migrateFamilies(catalog.retiredFamilies)
    exclusions = preferences.getExclusions()
    for (const family of catalog.families.slice(0, 2))
      openGroups.add(`voice-${family.id}`)
    render()
    updatePairing()
    initialized = true
    $('download').disabled = false
  } catch {
    $('load-error').hidden = false
    $('group-list').setAttribute('aria-busy', 'false')
    $('catalog-count').textContent = 'Sounds unavailable'
  }
}
for (const key of Object.keys(categories))
  $(`tab-${key}`).addEventListener('click', () => {
    stopPlayback()
    category = key
    const params = new URLSearchParams(location.search)
    params.set('kind', key)
    history.replaceState(null, '', `${location.pathname}?${params}`)
    render()
  })
$('search').addEventListener('input', render)
$('show-hidden').addEventListener('change', () => {
  stopPlayback()
  render()
})
$('reset-search').addEventListener('click', () => {
  $('search').value = ''
  render()
  $('search').focus()
})
$('pair-family').addEventListener('change', () => {
  stopPlayback()
  updatePairing()
})
$('pair-voice').addEventListener('change', stopPlayback)
$('pair-foley').addEventListener('change', stopPlayback)
$('play-pair').addEventListener('click', playPair)
$('stop').addEventListener('click', stopPlayback)
$('volume').addEventListener('input', () => {
  $('volume-value').textContent = `${$('volume').value}%`
  for (const entry of activePlayers)
    entry.audio.volume = (Number($('volume').value) / 100) * entry.gain
})
$('undo').addEventListener('click', () => {
  if (!undoAction) return
  const reverse = undoAction
  undoAction = null
  reverse()
  $('undo-bar').hidden = true
  $('playback-status').textContent = 'Last change undone.'
})
$('retry').addEventListener('click', load)
$('download').addEventListener('click', () => {
  readReviews()
  const hidden = preferences.getExclusions()
  const data = {
    ...snapshot,
    reviewedOn: new Date().toISOString().slice(0, 10),
    reviews,
    hidden: {
      clips: hidden.clipIds,
      sources: hidden.sourceKeys,
      families: hidden.familyIds
    },
    familyReview: {
      catalogVersion: catalog.version,
      families: catalog.families,
      selectedClipIds: catalog.clips.map((clip) => clip.id)
    }
  }
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  )
  const link = node('a')
  link.href = url
  link.download = `burning-tokens-sound-families-${data.reviewedOn}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  $('playback-status').textContent =
    'Feedback download prepared, including all earlier stars and notes.'
})
window.addEventListener('storage', (event) => {
  if (event.key === reviewKey || event.key === null) {
    readReviews()
    if (initialized) render()
  }
})
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopPlayback()
})
window.addEventListener('pagehide', (event) => {
  stopPlayback()
  if (!event.persisted) preferences.destroy()
})
void load()
