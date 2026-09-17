import { createSoundEngine } from './sound-engine.js'
import { hitSoundHotspot } from './sound-hotspots.js'
// Connect decorative user interactions to the reviewed sound library. No agent
// observation or simulated physical state is changed by this controller.
export function createSceneSound({
  root = document,
  engineFactory = createSoundEngine,
  catalog,
  initialExclusions = {},
  getScene,
  getPaused,
  getScenery = () => true,
  getActors
}) {
  const element = (id) => root.querySelector(`#${id}`)
  const settingsKey = 'burning-tokens:scene-sound:v1'
  let preferences = { enabled: true, volume: 0.4, background: true }
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) || '{}')
    if (typeof saved.enabled === 'boolean') preferences.enabled = saved.enabled
    if (typeof saved.background === 'boolean')
      preferences.background = saved.background
    if (Number.isFinite(saved.volume))
      preferences.volume = Math.max(0, Math.min(1, saved.volume))
  } catch {
    /* Keep usable controls when storage is unavailable. */
  }
  let status = { enabled: false, ready: false, available: true, active: 0 }
  let generation = 0
  let hover = null
  let hoverTimer = 0
  let heldId = null
  let lastDrag = null
  let nextSurprise = 0
  let disposed = false
  let excludedClips = new Set(initialExclusions.clipIds ?? [])
  let excludedFamilies = new Set(initialExclusions.familyIds ?? [])
  let excludedSources = new Set(initialExclusions.sourceKeys ?? [])
  const accepted = (clip) =>
    !excludedClips.has(clip.id) &&
    !excludedFamilies.has(clip.family) &&
    !excludedSources.has(clip.sourceKey) &&
    !excludedSources.has(clip.sourceUrl)
  const voiceRequests = new Map()
  const families = new Map(
    catalog.families.map((family) => [family.id, family])
  )
  const engine = engineFactory({
    catalog,
    initialExclusions,
    baseUrl: new URL('/audio/', location.href).href,
    onStatus(next) {
      status = next
      renderSoundStatus()
    }
  })
  engine.setVolume(preferences.volume)
  engine.setRoom(getScene())
  engine.setPaused(getPaused())
  engine.setVisible(!document.hidden)
  engine.setBackgroundEnabled(preferences.background)

  function save() {
    try {
      localStorage.setItem(settingsKey, JSON.stringify(preferences))
    } catch {
      /* Session settings still work. */
    }
  }
  function renderSoundStatus() {
    const button = element('sound-toggle')
    button.textContent = preferences.enabled ? 'Sound on' : 'Sound off'
    button.setAttribute('aria-pressed', String(preferences.enabled))
    element('sound-volume').value = String(Math.round(preferences.volume * 100))
    element('sound-volume-value').textContent =
      `${Math.round(preferences.volume * 100)}%`
    element('sound-background').checked = preferences.background
    const output = element('sound-status')
    output.dataset.active = String(status.active || 0)
    output.dataset.backgroundActive = String(status.activeBackground || 0)
    output.dataset.ready = String(Boolean(status.ready))
    output.dataset.enabled = String(preferences.enabled)
    if (status.lastPlayed) {
      output.dataset.lastClip = status.lastPlayed.id
      output.dataset.lastEvent = status.lastPlayed.event
      output.dataset.lastOwner = status.lastPlayed.ownerId || ''
    }
    output.textContent = !status.available
      ? 'Sound is unavailable in this browser. The scene still works.'
      : status.error
        ? status.error
        : !preferences.enabled
          ? 'Quiet mode. Movement and interaction stay on.'
          : preferences.volume === 0
            ? 'Volume is at zero. Raise it whenever you like.'
            : !status.ready
              ? 'Sound starts when you touch the scene.'
              : status.active
                ? `${status.active === 1 ? 'A little sound' : 'A few little sounds'}${status.lastPlayed?.title ? ` · ${status.lastPlayed.title}` : ''}`
                : 'Listening nearby. Hover, lift, or gently carry a creature.'
  }
  async function unlock() {
    if (!preferences.enabled || disposed || document.hidden) return false
    const current = generation
    const ready = await engine.enable()
    return (
      current === generation &&
      preferences.enabled &&
      !document.hidden &&
      !disposed &&
      ready !== false
    )
  }
  async function voice(event, visitor, x, gesture = false) {
    if (!visitor || !preferences.enabled || disposed) return false
    const current = generation
    const request = (voiceRequests.get(visitor.id) || 0) + 1
    voiceRequests.set(visitor.id, request)
    if (gesture ? !(await unlock()) : !status.ready) return false
    if (current !== generation || voiceRequests.get(visitor.id) !== request)
      return false
    return engine.voice(event, { id: visitor.id, x })
  }
  function targetFor(hotspot) {
    return hotspot.roles.find((role) =>
      catalog.clips.some(
        (clip) =>
          accepted(clip) &&
          clip.kind === 'room-effect' &&
          clip.rooms?.includes(getScene()) &&
          clip.targets?.includes(role)
      )
    )
  }
  async function roomEffect(hotspot, gesture = false) {
    const current = generation
    const target = targetFor(hotspot)
    if (!target || !preferences.enabled || disposed) return false
    if (gesture ? !(await unlock()) : !status.ready) return false
    if (current !== generation) return false
    return engine.effect('hover', { room: getScene(), target, x: hotspot.x })
  }
  function clearHover() {
    clearTimeout(hoverTimer)
    hoverTimer = 0
    if (hover?.kind === 'voice') {
      voiceRequests.set(hover.id, (voiceRequests.get(hover.id) || 0) + 1)
      engine.cancelVoice(hover.id)
    } else if (hover?.target) engine.cancelEffect(hover.target)
    hover = null
    element('sound-focus').textContent = ''
  }
  function setHover(next) {
    if (heldId || hover?.key === next?.key) return
    clearHover()
    if (!next) return
    hover = next
    element('sound-focus').textContent = next.label
    const current = generation
    hoverTimer = setTimeout(() => {
      if (current !== generation || hover !== next || heldId) return
      if (next.kind === 'voice') void voice('hover', next.visitor, next.x)
      else void roomEffect(next.hotspot)
    }, 220)
  }
  function pointerHover(point, hit) {
    if (hit) {
      setHover({
        kind: 'voice',
        key: hit.visitor.id,
        id: hit.visitor.id,
        visitor: hit.visitor,
        x: point.x,
        label: `${hit.visitor.label} · ${familyLabel(hit.visitor.id)}`
      })
      return true
    }
    const hotspot =
      getScenery() && hitSoundHotspot(getScene(), point.x, point.y)
    if (hotspot && targetFor(hotspot)) {
      setHover({
        kind: 'effect',
        key: hotspot.id,
        target: targetFor(hotspot),
        hotspot,
        x: point.x,
        label: hotspot.label
      })
      return true
    }
    setHover(null)
    return false
  }
  function pickup(visitor, point) {
    clearHover()
    engine.cancelDrop(visitor.id)
    heldId = visitor.id
    lastDrag = { ...point, at: performance.now() }
    nextSurprise = performance.now() + 500
    void voice('pickup', visitor, point.x, true)
  }
  function drag(visitor, point) {
    const now = performance.now()
    if (lastDrag) {
      const dt = Math.max(16, now - lastDrag.at) / 1000
      const speed =
        Math.hypot(point.x - lastDrag.x, ((point.y - lastDrag.y) * 2) / 3) / dt
      if (speed > 1.15 && now >= nextSurprise) {
        nextSurprise = now + 1500
        void voice('surprise', visitor, point.x)
      }
    }
    lastDrag = { ...point, at: now }
  }
  function release(visitor, point, canceled = false) {
    if (heldId) {
      voiceRequests.set(heldId, (voiceRequests.get(heldId) || 0) + 1)
      engine.cancelVoice(heldId)
    }
    heldId = null
    lastDrag = null
    if (canceled || !visitor) return
    const current = generation
    const actor = getActors().find((item) => item.visitor.id === visitor.id)
    const target = actor?.zone?.wet ? 'water' : 'soft'
    const dropRequest = (voiceRequests.get(visitor.id) || 0) + 1
    voiceRequests.set(visitor.id, dropRequest)
    void unlock().then((ready) => {
      if (
        !ready ||
        current !== generation ||
        voiceRequests.get(visitor.id) !== dropRequest ||
        heldId ||
        !preferences.enabled
      )
        return
      void engine.drop({ id: visitor.id, room: getScene(), target, x: point.x })
    })
  }

  function familyLabel(id) {
    return families.get(engine.familyFor(id))?.label || 'Little voice'
  }
  function invalidate() {
    generation++
    clearHover()
    if (heldId) engine.cancelVoice(heldId)
    heldId = null
    lastDrag = null
    voiceRequests.clear()
  }
  element('sound-toggle').onclick = () => {
    void (async () => {
      preferences.enabled = !preferences.enabled
      invalidate()
      if (preferences.enabled) await unlock()
      else void engine.setEnabled(false)
      save()
      renderSoundStatus()
    })()
  }
  element('sound-volume').oninput = (event) => {
    preferences.volume = event.target.valueAsNumber / 100
    engine.setVolume(preferences.volume)
    save()
    renderSoundStatus()
  }
  element('sound-background').onchange = (event) => {
    preferences.background = event.target.checked
    engine.setBackgroundEnabled(preferences.background)
    save()
  }
  renderSoundStatus()
  return {
    familyLabel,
    pointerHover,
    pickup,
    drag,
    release,
    leave: clearHover,
    // A deliberate click on scenery unlocks audio without an unrelated chime.
    touchScene(point) {
      const hotspot =
        getScenery() && hitSoundHotspot(getScene(), point.x, point.y)
      clearHover()
      if (hotspot && targetFor(hotspot)) void roomEffect(hotspot, true)
      else void unlock()
    },
    nudge(visitor, x) {
      clearHover()
      void voice('nudge', visitor, x, true)
    },
    audition(visitor, event = 'hover') {
      clearHover()
      const actor = getActors().find((item) => item.visitor.id === visitor.id)
      void voice(event, visitor, actor?.x ?? 0.5, true)
    },
    roomChanged() {
      invalidate()
      engine.setRoom(getScene())
    },
    setExclusions({ clipIds = [], familyIds = [], sourceKeys = [] } = {}) {
      invalidate()
      excludedClips = new Set(clipIds)
      excludedFamilies = new Set(familyIds)
      excludedSources = new Set(sourceKeys)
      engine.reset()
      engine.setExclusions({ clipIds, familyIds, sourceKeys })
    },
    resetInteraction() {
      invalidate()
      engine.reset()
    },
    pausedChanged() {
      engine.setPaused(getPaused())
    },
    suspendPage() {
      invalidate()
      engine.setVisible(false)
    },
    visibilityChanged() {
      invalidate()
      engine.setVisible(!document.hidden)
    },
    tick() {
      if (preferences.enabled && preferences.background && getScenery())
        engine.tick({
          room: getScene(),
          hovered: hover,
          dragging: Boolean(heldId),
          count: getActors().length
        })
    },
    dispose() {
      invalidate()
      disposed = true
      engine.dispose()
    }
  }
}
