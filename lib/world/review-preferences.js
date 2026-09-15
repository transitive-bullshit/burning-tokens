const hiddenSoundStorageKey = 'burning-tokens-creature-audio-hidden-v1'
const hiddenFamilyStorageKey = 'burning-tokens-sound-families-hidden-v1'
const snapshotStorageKey = 'burning-tokens-sound-review-snapshots-v1'
const localEvent = 'burning-tokens-sound-review-change'
const strings = (values) => [
  ...new Set(
    (Array.isArray(values) ? values : []).filter(
      (value) => typeof value === 'string' && value
    )
  )
]

export function createSoundReviewPreferences({
  storage,
  onChange = () => {},
  onError = () => {}
} = {}) {
  if (storage === undefined) {
    try {
      storage = globalThis.localStorage
    } catch {
      onError()
    }
  }
  const memory = new Map()
  const listeners = new Set([onChange])
  const unsaved = new Set()
  const retiredFamilies = new Map()
  const retiredClipRestores = new Set()
  let migrating = false
  let pendingRetirementCleanup = false
  function read(key) {
    if (unsaved.has(key)) return memory.get(key) || {}
    try {
      const raw = storage?.getItem(key)
      if (raw == null) return memory.get(key) || {}
      const value = JSON.parse(raw)
      const result =
        value && typeof value === 'object' && !Array.isArray(value) ? value : {}
      memory.set(key, result)
      return result
    } catch {
      onError()
      return memory.get(key) || {}
    }
  }
  function getExclusions() {
    const hidden = read(hiddenSoundStorageKey)
    const clipIds = new Set(
      strings(hidden.clips).filter((id) => !retiredClipRestores.has(id))
    )
    const familyIds = strings(read(hiddenFamilyStorageKey).families)
    // The old exclusion still means its original recordings, even if browser
    // storage cannot yet save the migration or an old tab writes it again.
    for (const familyId of familyIds)
      for (const clipId of retiredFamilies.get(familyId) ?? [])
        if (!retiredClipRestores.has(clipId)) clipIds.add(clipId)
    return {
      clipIds: [...clipIds],
      sourceKeys: strings(hidden.sources),
      familyIds: familyIds.filter((id) => !retiredFamilies.has(id))
    }
  }
  function emit() {
    const value = getExclusions()
    for (const listener of listeners) listener(value)
  }
  function persist(key, value) {
    memory.set(key, value)
    try {
      if (!storage) throw new Error('No browser storage')
      storage.setItem(key, JSON.stringify(value))
      unsaved.delete(key)
      return true
    } catch {
      unsaved.add(key)
      onError()
      return false
    }
  }
  function notify() {
    if (globalThis.dispatchEvent && typeof Event === 'function')
      globalThis.dispatchEvent(new Event(localEvent))
    else preferencesChanged()
  }
  function write(key, value) {
    persist(key, value)
    notify()
  }
  function migrateRetiredFamilies() {
    if (migrating || retiredFamilies.size === 0) return false
    migrating = true
    try {
      const familyRecord = read(hiddenFamilyStorageKey)
      const retiring = new Set(
        strings(familyRecord.families).filter((id) => retiredFamilies.has(id))
      )
      let changed = false
      if (retiring.size > 0 || retiredClipRestores.size > 0) {
        const hidden = read(hiddenSoundStorageKey)
        const oldClipIds = strings(hidden.clips)
        const clipIds = new Set(
          oldClipIds.filter((id) => !retiredClipRestores.has(id))
        )
        for (const id of retiring)
          for (const clipId of retiredFamilies.get(id))
            if (!retiredClipRestores.has(clipId)) clipIds.add(clipId)
        // Never erase the durable family exclusion before its replacement clips
        // and any explicit restores are durable. Failed writes retain both the
        // old stored fallback and the user's newer choices for this visit.
        if (
          unsaved.has(hiddenSoundStorageKey) ||
          clipIds.size !== oldClipIds.length ||
          oldClipIds.some((id) => !clipIds.has(id))
        ) {
          const saved = persist(hiddenSoundStorageKey, {
            ...hidden,
            clips: [...clipIds]
          })
          if (!saved) return true
          changed = true
        }
      }
      if (retiring.size > 0) {
        const latest = read(hiddenFamilyStorageKey)
        pendingRetirementCleanup = !persist(hiddenFamilyStorageKey, {
          ...latest,
          families: strings(latest.families).filter((id) => !retiring.has(id))
        })
        changed = true
      } else if (
        pendingRetirementCleanup &&
        unsaved.has(hiddenFamilyStorageKey)
      ) {
        pendingRetirementCleanup = !persist(
          hiddenFamilyStorageKey,
          familyRecord
        )
        changed = true
      } else pendingRetirementCleanup = false
      // Once both records save, no session override is needed. A subsequent
      // explicit hide from another tab can then take precedence normally.
      if (
        !unsaved.has(hiddenSoundStorageKey) &&
        !unsaved.has(hiddenFamilyStorageKey)
      )
        retiredClipRestores.clear()
      return changed
    } finally {
      migrating = false
    }
  }
  function applySnapshot(snapshot, revision) {
    if (typeof revision !== 'string' || !revision || !snapshot?.hidden)
      return getExclusions()
    const completed = read(snapshotStorageKey)
    const alreadyComplete = strings(completed.revisions).includes(revision)
    let changed = false
    if (alreadyComplete && !unsaved.has(snapshotStorageKey)) {
      // Applying an old baseline must not overwrite later restores. A retry
      // can still save newer choices retained in this visit after a failure.
      for (const key of [hiddenSoundStorageKey, hiddenFamilyStorageKey]) {
        if (!unsaved.has(key)) continue
        persist(key, read(key))
        changed = true
      }
      if (changed) notify()
      return getExclusions()
    }
    function applyPart(key, fields) {
      const latest = read(key)
      const revisions = strings(latest.appliedSnapshotRevisions)
      if (revisions.includes(revision)) {
        if (!unsaved.has(key)) return true
        changed = true
        return persist(key, latest)
      }
      const next = {
        ...latest,
        appliedSnapshotRevisions: [...revisions, revision]
      }
      for (const field of fields)
        next[field] = [
          ...new Set([
            ...strings(latest[field]),
            ...strings(snapshot.hidden[field])
          ])
        ]
      changed = true
      // Store each half's progress with its preferences, so a restore followed
      // by a reload cannot replay a half that saved before the other failed.
      return persist(key, next)
    }
    const clipsSaved = applyPart(hiddenSoundStorageKey, ['clips', 'sources'])
    const familiesSaved = applyPart(hiddenFamilyStorageKey, ['families'])
    if (clipsSaved && familiesSaved) {
      const latest = read(snapshotStorageKey)
      const revisions = strings(latest.revisions)
      if (!revisions.includes(revision) || unsaved.has(snapshotStorageKey)) {
        persist(snapshotStorageKey, {
          ...latest,
          revisions: [...new Set([...revisions, revision])]
        })
        changed = true
      }
    }
    if (changed) notify()
    return getExclusions()
  }
  function preferencesChanged() {
    migrateRetiredFamilies()
    emit()
  }
  function change(key, field, id, hidden) {
    if (typeof id !== 'string' || !id) return
    if (key === hiddenSoundStorageKey && field === 'clips') {
      if (hidden) retiredClipRestores.delete(id)
      else if ([...retiredFamilies.values()].some((clipIds) => clipIds.has(id)))
        retiredClipRestores.add(id)
    }
    const latest = read(key)
    const values = new Set(strings(latest[field]))
    if (hidden) values.add(id)
    else values.delete(id)
    write(key, { ...latest, [field]: [...values] })
  }
  const storageChanged = (event) => {
    if (
      event.key === null ||
      event.key === hiddenSoundStorageKey ||
      event.key === hiddenFamilyStorageKey
    ) {
      if (event.key === null) {
        memory.clear()
        unsaved.clear()
      } else {
        memory.delete(event.key)
        unsaved.delete(event.key)
      }
      preferencesChanged()
    }
  }
  globalThis.addEventListener?.('storage', storageChanged)
  globalThis.addEventListener?.(localEvent, preferencesChanged)
  return {
    getExclusions,
    applySnapshot,
    migrateFamilies(records) {
      for (const record of Array.isArray(records) ? records : []) {
        const id = record?.id
        const clipIds = strings(record?.clipIds)
        if (typeof id !== 'string' || !id || clipIds.length === 0) continue
        retiredFamilies.set(
          id,
          new Set([...(retiredFamilies.get(id) ?? []), ...clipIds])
        )
      }
      if (migrateRetiredFamilies()) notify()
      return getExclusions()
    },
    hideClip: (id) => change(hiddenSoundStorageKey, 'clips', id, true),
    restoreClip: (id) => change(hiddenSoundStorageKey, 'clips', id, false),
    hideSource: (id) => change(hiddenSoundStorageKey, 'sources', id, true),
    restoreSource: (id) => change(hiddenSoundStorageKey, 'sources', id, false),
    hideFamily: (id) => change(hiddenFamilyStorageKey, 'families', id, true),
    restoreFamily: (id) =>
      change(hiddenFamilyStorageKey, 'families', id, false),
    seedHidden(snapshot) {
      try {
        if (
          storage?.getItem(hiddenSoundStorageKey) != null ||
          memory.has(hiddenSoundStorageKey)
        )
          return
        write(hiddenSoundStorageKey, {
          clips: strings(snapshot?.hidden?.clips),
          sources: strings(snapshot?.hidden?.sources)
        })
      } catch {
        onError()
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    destroy() {
      listeners.clear()
      globalThis.removeEventListener?.('storage', storageChanged)
      globalThis.removeEventListener?.(localEvent, preferencesChanged)
    }
  }
}
