/** A small, gesture-unlocked mixer. Reactions are disposable events, never a queue. */
export function createSoundEngine({
  catalog,
  initialExclusions = {},
  baseUrl = '',
  onStatus = () => {},
  AudioContextImpl = globalThis.AudioContext ?? globalThis.webkitAudioContext,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  now = () => performance.now() / 1000,
  random = Math.random
} = {}) {
  const clips = (catalog?.clips ?? []).filter((clip) => clip.id && clip.src)
  const voices = clips.filter((clip) => clip.kind === 'voice')
  const effects = clips.filter((clip) => clip.kind !== 'voice')
  const clipsById = new Map(clips.map((clip) => [clip.id, clip]))
  let excludedClips = new Set(initialExclusions?.clipIds ?? [])
  let excludedFamilies = new Set(initialExclusions?.familyIds ?? [])
  let excludedSources = new Set(initialExclusions?.sourceKeys ?? [])
  const accepted = (clip) =>
    clip &&
    !excludedClips.has(clip.id) &&
    !excludedFamilies.has(clip.family) &&
    !excludedSources.has(clip.sourceKey) &&
    !excludedSources.has(clip.sourceUrl)
  const families = [
    ...new Set(voices.map((clip) => clip.family).filter(Boolean))
  ].sort((a, b) => a.localeCompare(b))
  const byFamily = new Map(
    families.map((family) => [
      family,
      voices.filter((clip) => clip.family === family)
    ])
  )
  // A fresh scene gives creatures voices that are currently usable. Keep this
  // initial lottery fixed so later review changes never switch a known voice.
  const weightedFamilies = families.flatMap((family) => {
    const count = byFamily.get(family).filter(accepted).length
    return Array.from(
      { length: count ? Math.min(8, count * 2 - 1) : 0 },
      () => family
    )
  })
  const active = new Set()
  const tails = new Set()
  const cache = new Map()
  const cooldowns = new Map()
  const lastClips = new Map()
  const failedUntil = new Map()
  const overrides = new Map()
  const voiceFallbacks = {
    pickup: ['pickup', 'hover', 'curious', 'delight', 'happy'],
    hover: ['hover', 'curious', 'interest', 'wonder', 'pickup'],
    surprise: ['surprise', 'drag', 'wonder', 'ooh', 'ah', 'pickup'],
    drop: ['drop', 'delight', 'happy', 'laugh', 'pickup'],
    nudge: ['nudge', 'surprise', 'hover', 'curious'],
    idle: ['idle', 'content', 'soft', 'happy', 'hover']
  }
  const voiceCooldowns = {
    hover: 7,
    pickup: 0.7,
    surprise: 2.8,
    drop: 0.6,
    nudge: 3,
    idle: 24
  }
  const targetGroups = [
    ['fire', 'fireplace', 'flame', 'crackle', 'embers'],
    [
      'water',
      'pool',
      'splash',
      'ripples',
      'ripple',
      'bubble',
      'bubbles',
      'drip',
      'waterfall'
    ],
    ['cup', 'cups', 'ceramic', 'pottery', 'mug', 'clink', 'tea'],
    ['paper', 'page', 'pages', 'journal', 'book'],
    ['fabric', 'cloth', 'linen', 'cushion', 'blanket'],
    ['bell', 'bells', 'chime', 'chimes', 'gong', 'bowl'],
    ['electric', 'electrical', 'energy', 'conduit', 'spark', 'pulse', 'reward'],
    ['paint', 'pencil', 'brush', 'drawing', 'tool'],
    ['plant', 'plants', 'pollen', 'bloom', 'mushroom', 'garden']
  ]
  let context = null
  let master = null
  let enabled = false
  let paused = false
  let backgroundEnabled = true
  let lastPlayed = null
  let visible = true
  let disposed = false
  let room = 'camp'
  let volume = 0.45
  let epoch = 0
  let lastForeground = -Infinity
  let lastAny = -Infinity
  let lastRequest = null
  let lastVoiceStarted = null
  let nextBackground = Infinity
  let error = null

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value))
  const stamp = () => now()
  const rolesOf = (clip) => clip.roles ?? []
  const priorityOf = (event) =>
    ({ pickup: 3, drop: 3, surprise: 3, hover: 2, nudge: 1, idle: 0 })[event] ??
    2
  const canPlay = () =>
    enabled &&
    visible &&
    !disposed &&
    context?.state === 'running' &&
    volume > 0
  const scheduleBackground = () => {
    nextBackground = stamp() + 12 + random() * 13
  }

  function status() {
    onStatus({
      enabled,
      available: Boolean(AudioContextImpl && fetchImpl),
      ready: canPlay(),
      volume,
      active: [...active].filter((item) => item.source).length,
      activeBackground: [...active].filter(
        (item) => item.background && item.source
      ).length,
      lastPlayed,
      pending: [...active].filter((item) => !item.source).length,
      error
    })
  }

  function rememberVoiceStart(record) {
    if (
      record.voiceId === undefined ||
      record.voiceHeard ||
      !record.sourceStarted ||
      context.currentTime < record.startAt ||
      (record.stopAt !== undefined && record.stopAt <= record.startAt)
    )
      return
    record.voiceHeard = true
    const key = `voice:${record.voiceId}`
    lastClips.delete(key)
    lastClips.set(key, record.clipId)
    if (lastClips.size > 2048) lastClips.delete(lastClips.keys().next().value)
  }

  function rememberVoiceStarts() {
    for (const record of active) rememberVoiceStart(record)
    for (const record of tails) rememberVoiceStart(record)
  }

  function release(record) {
    rememberVoiceStart(record)
    active.delete(record)
    tails.delete(record)
    record.source?.disconnect()
    record.gain?.disconnect()
    record.pan?.disconnect()
  }

  function stop(record) {
    rememberVoiceStart(record)
    record.cancelled = true
    record.controller.abort()
    active.delete(record)
    if (record.source) {
      try {
        const time = context.currentTime
        if (
          !disposed &&
          volume > 0 &&
          context.state === 'running' &&
          time >= record.startAt
        ) {
          // A replacement starts after this brief tail, so canceling an utterance
          // neither clicks nor temporarily exceeds the three-sound audible cap.
          const parameter = record.gain.gain
          if (parameter.cancelAndHoldAtTime) parameter.cancelAndHoldAtTime(time)
          else {
            const value = parameter.value
            parameter.cancelScheduledValues(time)
            parameter.setValueAtTime(value, time)
          }
          record.stopAt = time + 0.02
          parameter.linearRampToValueAtTime(0, record.stopAt)
          tails.add(record)
          record.source.stop(record.stopAt)
          return
        }
        record.source.stop()
      } catch {
        /* A finished one-shot is already silent. */
      }
    }
    release(record)
  }

  function prune() {
    for (const record of active) {
      if (
        !record.source &&
        stamp() - record.requestedAt > (record.event === 'hover' ? 0.5 : 1.1)
      )
        stop(record)
      else if (record.endsAt && record.endsAt < stamp() - 0.1) stop(record)
    }
    for (const record of tails)
      if (record.stopAt <= context.currentTime) release(record)
  }

  function invalidate() {
    epoch++
    lastRequest = null
    lastVoiceStarted = null
    for (const record of active) stop(record)
    scheduleBackground()
  }

  function cancelVoice(id) {
    for (const record of active) {
      if (record.voiceId === String(id)) stop(record)
    }
    status()
  }

  function cancelDrop(id) {
    for (const record of active) {
      if (record.dropOwnerId === String(id)) stop(record)
    }
    status()
  }

  function setExclusions({
    clipIds = [],
    familyIds = [],
    sourceKeys = []
  } = {}) {
    excludedClips = new Set(clipIds)
    excludedFamilies = new Set(familyIds)
    excludedSources = new Set(sourceKeys)
    // Keep the original family lottery and explicit assignments intact. Removing
    // a palette makes its creatures quiet instead of changing their identities.
    for (const record of [...active, ...tails])
      if (!accepted(clipsById.get(record.clipId))) stop(record)
    lastRequest = null
    lastVoiceStarted = null
    scheduleBackground()
    status()
  }

  function cancelEffect(target) {
    for (const record of active) {
      if (record.voiceId === undefined && record.target === target) stop(record)
    }
    status()
  }

  function hash(value) {
    let result = 2166136261
    for (const char of String(value))
      result = Math.imul(result ^ char.charCodeAt(0), 16777619)
    return result >>> 0
  }

  function familyFor(id) {
    return (
      overrides.get(String(id)) ??
      weightedFamilies[hash(id) % weightedFamilies.length] ??
      null
    )
  }

  function choose(candidates, key) {
    const usable = candidates.filter(
      (clip) =>
        accepted(clip) && (failedUntil.get(clip.id) ?? -Infinity) <= stamp()
    )
    if (!usable.length) return null
    const alternatives = usable.filter((clip) => clip.id !== lastClips.get(key))
    const pool = alternatives.length ? alternatives : usable
    return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
  }

  function voiceClip(event, family, id) {
    rememberVoiceStarts()
    const usable = (byFamily.get(family) ?? []).filter(
      (clip) =>
        accepted(clip) && (failedUntil.get(clip.id) ?? -Infinity) <= stamp()
    )
    const alternatives = usable.filter(
      (clip) => clip.id !== lastClips.get(`voice:${id}`)
    )
    const pool = alternatives.length ? alternatives : usable
    if (!pool.length) return null
    const roles = voiceFallbacks[event] ?? [event]
    // Variety comes first across hover, pickup and release. Relevant expressions
    // get more weight, while other accepted takes in this voice remain possible.
    const weighted = pool
      .map((clip) => {
        const rank = roles.findIndex((role) => rolesOf(clip).includes(role))
        return { clip, weight: rank < 0 ? 1 : 2 + roles.length - rank }
      })
      .sort((a, b) => b.weight - a.weight)
    let choice =
      clamp(random(), 0, 1) *
      weighted.reduce((sum, item) => sum + item.weight, 0)
    for (const item of weighted) {
      choice -= item.weight
      if (choice < 0) return item.clip
    }
    return weighted.at(-1).clip
  }

  function targetMatch(clip, target) {
    if (!target) return true
    const wanted = String(target).toLowerCase()
    const tokens = [
      ...(clip.targets ?? []),
      ...(clip.tags ?? []),
      ...rolesOf(clip),
      clip.family ?? ''
    ].flatMap((value) =>
      String(value)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
    )
    const aliases = targetGroups.find((group) => group.includes(wanted)) ?? [
      wanted
    ]
    return aliases.some((word) => tokens.includes(word))
  }

  function effectClip(event, requestedRoom, target) {
    if (event === 'drop') {
      // Landing foley is a separate physical layer. Only approved drop recordings
      // qualify, with a surface match first and a soft camp landing as fallback.
      const drops = effects.filter((clip) => rolesOf(clip).includes('drop'))
      const matches = drops.filter((clip) => targetMatch(clip, target))
      const groups = [
        matches.filter((clip) => (clip.rooms ?? []).includes(requestedRoom)),
        matches,
        drops.filter(
          (clip) =>
            targetMatch(clip, 'soft') && (clip.rooms ?? []).includes('camp')
        ),
        drops.filter((clip) => targetMatch(clip, 'soft'))
      ]
      for (const group of groups) {
        const chosen = choose(
          group,
          `effect:${requestedRoom}:${target ?? event}`
        )
        if (chosen) return chosen
      }
      return null
    }
    const candidates = effects.filter((clip) =>
      (clip.rooms ?? []).includes(requestedRoom)
    )
    const exact = target
      ? candidates.filter((clip) => (clip.targets ?? []).includes(target))
      : []
    const pool = exact.length
      ? exact
      : candidates.filter((clip) => targetMatch(clip, target))
    let suitable = pool.filter((clip) => rolesOf(clip).includes(event))
    if (!suitable.length && target) suitable = pool
    if (!suitable.length && event === 'idle') {
      suitable = pool.filter(
        (clip) =>
          clip.effectType === 'texture' ||
          rolesOf(clip).some((role) =>
            ['idle', 'background', 'ambient', 'texture'].includes(role)
          )
      )
    }
    return choose(suitable, `effect:${requestedRoom}:${target ?? event}`)
  }

  function cacheBuffer(id, buffer) {
    cache.delete(id)
    cache.set(id, buffer)
    // At most 32 decoded recordings, with an additional 24 MiB PCM ceiling.
    const byteSize = (item) => item.length * (item.numberOfChannels ?? 1) * 4
    let bytes = [...cache.values()].reduce(
      (sum, item) => sum + byteSize(item),
      0
    )
    while (cache.size > 32 || bytes > 24 * 1024 * 1024) {
      const oldest = cache.keys().next().value
      bytes -= byteSize(cache.get(oldest))
      cache.delete(oldest)
    }
  }

  async function decode(clip, record) {
    if (cache.has(clip.id)) {
      const buffer = cache.get(clip.id)
      cache.delete(clip.id)
      cache.set(clip.id, buffer)
      return buffer
    }
    const url = baseUrl ? new URL(clip.src, baseUrl).href : clip.src
    const response = await fetchImpl(url, { signal: record.controller.signal })
    if (!response.ok) throw new Error(`Sound unavailable (${response.status})`)
    const bytes = await response.arrayBuffer()
    if (record.cancelled || record.epoch !== epoch) return null
    const buffer = await context.decodeAudioData(bytes)
    if (!record.cancelled && record.epoch === epoch)
      cacheBuffer(clip.id, buffer)
    return buffer
  }

  function reserve({
    event,
    voiceId,
    target,
    priority,
    background,
    cooldown,
    paired,
    completedDrop = false,
    landing = false,
    dropOwnerId
  }) {
    const time = stamp()
    prune()
    const pairedDrop =
      paired &&
      event === 'drop' &&
      priority === 1 &&
      voiceId === undefined &&
      lastVoiceStarted?.event === 'drop' &&
      !lastVoiceStarted.paired &&
      time - lastVoiceStarted.time <= 0.4
    if (paired && !pairedDrop) return null
    const releaseTransition =
      voiceId !== undefined &&
      event === 'drop' &&
      lastRequest?.voiceId === voiceId &&
      lastRequest.event !== 'drop' &&
      time - lastRequest.time <= 0.4
    if (
      !canPlay() ||
      (!completedDrop &&
        !pairedDrop &&
        !releaseTransition &&
        time - lastAny < (background ? 5 : 0.12))
    )
      return null
    if (
      background &&
      (!backgroundEnabled ||
        paused ||
        time - lastForeground < 8 ||
        [...active].some((item) => item.background))
    )
      return null
    const key =
      voiceId !== undefined
        ? `voice:${voiceId}:${event}`
        : `effect:${room}:${target ?? event}`
    if (!landing && time < (cooldowns.get(key) ?? -Infinity)) return null
    // Each completed release gets one short physical accent. Replace the last
    // landing instead of stacking a run of impacts after quick repeated drops.
    if (landing) for (const item of active) if (item.landing) stop(item)
    if (voiceId !== undefined) {
      const recent = [...active].filter((item) => item.voiceId === voiceId)
      if (recent.some((item) => item.priority > priority)) return null
      for (const item of recent) stop(item)
    }
    if (!background) {
      // Interacting draws attention locally and clears pending incidental sounds too.
      for (const item of active) if (item.background) stop(item)
    }
    if (active.size >= 3) {
      const lowest = [...active].sort(
        (a, b) => a.priority - b.priority || a.requestedAt - b.requestedAt
      )[0]
      if (
        lowest.priority > priority ||
        (lowest.priority === priority && !landing)
      )
        return null
      stop(lowest)
    }
    const record = {
      event,
      voiceId,
      target,
      priority,
      background,
      landing,
      dropOwnerId,
      requestedAt: time,
      epoch,
      controller: new AbortController(),
      cancelled: false,
      source: null,
      gain: null,
      pan: null
    }
    active.add(record)
    cooldowns.set(key, time + cooldown)
    // Avoid retaining a festival's entire history when visitors turn over.
    if (cooldowns.size > 2048) {
      for (const [entry, until] of cooldowns)
        if (until <= time) cooldowns.delete(entry)
    }
    if (pairedDrop) lastVoiceStarted.paired = true
    lastRequest = { voiceId, event, time }
    lastAny = time
    if (!background) {
      lastForeground = time
      scheduleBackground()
    }
    status()
    return record
  }

  async function play(clip, request) {
    if (!accepted(clip)) return false
    const record = reserve(request)
    if (!record) return false
    // reserve() can finish an older utterance for this visitor. Recheck after
    // that cancellation commits any voice that actually began in the meantime.
    if (
      request.voiceId !== undefined &&
      clip.id === lastClips.get(`voice:${request.voiceId}`)
    )
      clip =
        voiceClip(request.event, familyFor(request.voiceId), request.voiceId) ??
        clip
    record.clipId = clip.id
    try {
      const buffer = await decode(clip, record)
      if (
        !buffer ||
        record.cancelled ||
        record.epoch !== epoch ||
        !canPlay() ||
        !accepted(clip) ||
        stamp() - record.requestedAt > (request.event === 'hover' ? 0.5 : 1.1)
      ) {
        stop(record)
        status()
        return false
      }
      const duration = Math.min(
        buffer.duration,
        request.background ? 4 : request.voiceId !== undefined ? 3.5 : 6
      )
      if (!(duration > 0)) throw new Error('Empty sound')
      const start = Math.max(
        context.currentTime,
        ...[...tails].map((item) => item.stopAt)
      )
      const gain = context.createGain()
      const peak =
        (request.voiceId !== undefined ? 0.58 : 0.42) *
        (request.background ? 0.45 : 1) *
        clamp(Number.isFinite(clip.gain) ? clip.gain : 1, 0.1, 1)
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(
        peak,
        start + Math.min(0.012, duration / 4)
      )
      gain.gain.setValueAtTime(
        peak,
        start + Math.max(duration / 2, duration - 0.05)
      )
      gain.gain.linearRampToValueAtTime(0, start + duration)
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(gain)
      const pan = context.createStereoPanner?.()
      if (pan) {
        pan.pan.setValueAtTime(
          (clamp(Number.isFinite(request.x) ? request.x : 0.5, 0, 1) - 0.5) *
            0.65,
          start
        )
        gain.connect(pan)
        pan.connect(master)
      } else gain.connect(master)
      Object.assign(record, {
        source,
        gain,
        pan,
        startAt: start,
        endsAt: stamp() + duration + (start - context.currentTime)
      })
      source.onended = () => {
        release(record)
        status()
      }
      source.start(start, 0, duration)
      record.sourceStarted = true
      rememberVoiceStart(record)
      if (request.voiceId !== undefined)
        lastVoiceStarted = {
          event: request.event,
          id: request.voiceId,
          time: stamp() + (start - context.currentTime),
          paired: false
        }
      lastPlayed = {
        id: clip.id,
        title: clip.title ?? clip.id,
        kind: clip.kind,
        event: request.event,
        ownerId: request.voiceId
      }
      if (request.voiceId === undefined) {
        lastClips.set(
          `effect:${room}:${request.target ?? request.event}`,
          clip.id
        )
        if (lastClips.size > 2048)
          lastClips.delete(lastClips.keys().next().value)
      }
      error = null
      status()
      return true
    } catch {
      if (!record.cancelled && record.epoch === epoch) {
        failedUntil.set(clip.id, stamp() + 60)
        error = 'One sound could not load. Other sounds are still available.'
      }
      stop(record)
      status()
      return false
    }
  }

  function voice(event, { id, family, x, background = event === 'idle' } = {}) {
    if (id === undefined || id === null) return Promise.resolve(false)
    const voiceId = String(id)
    if (event === 'cancel') {
      cancelVoice(voiceId)
      return Promise.resolve(false)
    }
    if (family && byFamily.has(family) && !overrides.has(voiceId))
      overrides.set(voiceId, family)
    return play(voiceClip(event, familyFor(voiceId), voiceId), {
      event,
      voiceId,
      x,
      background,
      priority: background ? 0 : priorityOf(event),
      cooldown: voiceCooldowns[event] ?? 2
    })
  }

  function effect(
    event,
    {
      room: requestedRoom = room,
      target,
      x,
      priority,
      paired = false,
      background = event === 'idle'
    } = {}
  ) {
    if (requestedRoom !== room) return Promise.resolve(false)
    return play(effectClip(event, requestedRoom, target), {
      event,
      target,
      x,
      paired,
      background,
      priority: background ? 0 : clamp(priority ?? priorityOf(event), 0, 3),
      cooldown: background ? 14 : event === 'hover' ? 6 : 2
    })
  }

  function drop({ id, room: requestedRoom = room, target = 'soft', x } = {}) {
    if (requestedRoom !== room)
      return Promise.resolve({ effect: false, voice: false })
    const voiceId = id === undefined || id === null ? undefined : String(id)
    const request = {
      event: 'drop',
      target,
      x,
      background: false,
      priority: 3,
      completedDrop: true,
      dropOwnerId: voiceId
    }
    // Reserve the physical sound before the optional voice. Both load independently:
    // a rejected palette, missing emotion or delayed voice cannot swallow the landing.
    const physical = play(effectClip('drop', requestedRoom, target), {
      ...request,
      landing: true,
      cooldown: 0
    })
    const vocal =
      voiceId === undefined
        ? Promise.resolve(false)
        : play(voiceClip('drop', familyFor(voiceId), voiceId), {
            ...request,
            voiceId,
            cooldown: voiceCooldowns.drop
          })
    return Promise.all([physical, vocal]).then(([effect, voice]) => ({
      effect,
      voice
    }))
  }

  async function enable() {
    if (disposed || !AudioContextImpl || !fetchImpl) {
      error = 'Sound is unavailable in this browser.'
      status()
      return false
    }
    enabled = true
    try {
      if (!context) {
        context = new AudioContextImpl()
        master = context.createGain()
        master.gain.value = volume
        master.connect(context.destination)
      }
      const currentEpoch = epoch
      // Called synchronously from the enable button's trusted gesture.
      await context.resume()
      if (currentEpoch !== epoch || !enabled || disposed || !visible) {
        if (!disposed && context.state === 'running') await context.suspend()
        return false
      }
      error = null
      scheduleBackground()
      status()
      return true
    } catch {
      enabled = false
      error = 'Sound could not start. Try enabling it again.'
      status()
      return false
    }
  }

  function setEnabled(value) {
    if (value) return enable()
    enabled = false
    invalidate()
    context?.suspend().catch(() => {})
    status()
    return Promise.resolve(false)
  }

  function setVolume(value) {
    if (!Number.isFinite(value)) return
    const wasSilent = volume === 0
    volume = clamp(value, 0, 1)
    if (master) master.gain.setValueAtTime(volume, context.currentTime)
    if (volume === 0) invalidate()
    else if (wasSilent) scheduleBackground()
    status()
  }

  function synchronizeLifecycle() {
    invalidate()
    if (context && !disposed) {
      if (!visible || !enabled) context.suspend().catch(() => {})
      else
        context.resume().catch(() => {
          error = 'Tap sound to resume playback.'
          status()
        })
    }
    status()
  }

  function setPaused(value) {
    if (paused === Boolean(value)) return
    paused = Boolean(value)
    for (const record of active) if (record.background) stop(record)
    scheduleBackground()
    status()
  }

  function setBackgroundEnabled(value) {
    backgroundEnabled = Boolean(value)
    for (const record of active) if (record.background) stop(record)
    scheduleBackground()
    status()
  }

  function setVisible(value) {
    if (visible === Boolean(value)) return
    visible = Boolean(value)
    synchronizeLifecycle()
  }

  function reset() {
    invalidate()
    status()
  }

  function setRoom(value) {
    if (!value || room === value) return
    room = value
    invalidate()
    status()
  }

  function tick({ room: requestedRoom, hovered, dragging } = {}) {
    if (requestedRoom && requestedRoom !== room) setRoom(requestedRoom)
    if (!canPlay() || paused || !backgroundEnabled) return
    // Reap events if a host fails to deliver a fetch rejection or ended callback.
    prune()
    if (hovered || dragging) {
      nextBackground = Math.max(nextBackground, stamp() + 12)
      return
    }
    if (stamp() < nextBackground || stamp() - lastForeground < 8) return
    scheduleBackground()
    void effect('idle', { background: true, x: 0.35 + random() * 0.3 })
  }

  function dispose() {
    if (disposed) return
    disposed = true
    enabled = false
    invalidate()
    for (const record of tails) {
      try {
        record.source.stop()
      } catch {
        /* Context may already be closed. */
      }
      release(record)
    }
    cache.clear()
    cooldowns.clear()
    overrides.clear()
    lastClips.clear()
    failedUntil.clear()
    master?.disconnect()
    context?.close().catch(() => {})
    status()
  }

  status()
  return {
    enable,
    setEnabled,
    setVolume,
    setPaused,
    setBackgroundEnabled,
    setVisible,
    setRoom,
    setExclusions,
    reset,
    voice,
    effect,
    drop,
    tick,
    familyFor,
    cancelVoice,
    cancelDrop,
    cancelEffect,
    dispose
  }
}
