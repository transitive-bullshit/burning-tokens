import assert from 'node:assert/strict'

import { createSoundReviewPreferences } from './review-preferences.js'

const reviewKey = 'burning-tokens-creature-audio-review-v1'
const hiddenKey = 'burning-tokens-creature-audio-hidden-v1'
const familyKey = 'burning-tokens-sound-families-hidden-v1'
const snapshotKey = 'burning-tokens-sound-review-snapshots-v1'
const storedReview = JSON.stringify({
  'liked-cat': { favorite: true, note: 'Keep this soft purr. ★' },
  'liked-baby': { favorite: true, note: '  Delight, not alarm.  ' },
  'rejected-babble': { favorite: false, note: 'Too sharp for pickup.' }
})

function storageHarness(initial = {}) {
  const values = new Map([
    [reviewKey, storedReview],
    ...Object.entries(initial)
  ])
  const writes = []
  const state = {
    failReads: false,
    failWrites: false,
    failWriteKeys: new Set()
  }
  const storage = {
    getItem(key) {
      if (state.failReads) throw new Error('Storage read unavailable')
      return values.get(key) ?? null
    },
    setItem(key, value) {
      if (state.failWrites || state.failWriteKeys.has(key))
        throw new Error('Storage quota exceeded')
      writes.push(key)
      values.set(key, String(value))
    }
  }
  return {
    storage,
    values,
    state,
    writes,
    assertFeedbackPreserved() {
      assert.equal(
        values.get(reviewKey),
        storedReview,
        'all stars and notes remain byte-for-byte unchanged'
      )
      assert.ok(
        writes.every(
          (key) => key === hiddenKey || key === familyKey || key === snapshotKey
        ),
        'preferences write only the exclusion records'
      )
    }
  }
}

// Each event target represents browser dispatch; suspending delivery lets two
// listening tabs change shared storage before either receives the other event.
const originalGlobals = new Map(
  ['addEventListener', 'removeEventListener', 'dispatchEvent'].map((key) => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key)
  ])
)
const listeners = new Map()
let deliverEvents = true
const eventHost = {
  addEventListener(type, listener) {
    if (!listeners.has(type)) listeners.set(type, new Set())
    listeners.get(type).add(listener)
  },
  removeEventListener(type, listener) {
    listeners.get(type)?.delete(listener)
  },
  dispatchEvent(event) {
    if (deliverEvents)
      for (const listener of listeners.get(event.type) ?? []) listener(event)
    return true
  }
}
for (const [key, value] of Object.entries(eventHost))
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value
  })

function storageEvent(key, storage) {
  const event = new Event('storage')
  Object.assign(event, { key, storageArea: storage })
  eventHost.dispatchEvent(event)
}
const sortedExclusions = (preferences) => {
  const value = preferences.getExclusions()
  return {
    clipIds: value.clipIds.toSorted(),
    sourceKeys: value.sourceKeys.toSorted(),
    familyIds: value.familyIds.toSorted()
  }
}
const preferencesToDestroy = new Set()
function create(options) {
  const preferences = createSoundReviewPreferences(options)
  preferencesToDestroy.add(preferences)
  return preferences
}
function destroy(preferences) {
  preferences.destroy()
  preferencesToDestroy.delete(preferences)
}

try {
  // Hiding a voice family is separate from disliking an individual recording or
  // its source. Restoring one choice must not silently restore another choice.
  {
    const h = storageHarness({
      [hiddenKey]: JSON.stringify({
        clips: ['rejected-babble'],
        sources: ['old-source'],
        futureField: 'preserve me'
      })
    })
    const preferences = create({ storage: h.storage })
    preferences.hideClip('liked-cat')
    preferences.hideSource('cat-recordings')
    preferences.hideFamily('purrs')
    preferences.hideFamily('purrs')
    assert.deepEqual(sortedExclusions(preferences), {
      clipIds: ['liked-cat', 'rejected-babble'],
      sourceKeys: ['cat-recordings', 'old-source'],
      familyIds: ['purrs']
    })
    preferences.restoreFamily('purrs')
    assert.deepEqual(sortedExclusions(preferences), {
      clipIds: ['liked-cat', 'rejected-babble'],
      sourceKeys: ['cat-recordings', 'old-source'],
      familyIds: []
    })
    preferences.restoreSource('cat-recordings')
    assert.ok(
      preferences.getExclusions().clipIds.includes('liked-cat'),
      'restoring a source leaves an explicit recording dislike intact'
    )
    preferences.hideFamily('purrs')
    preferences.restoreClip('liked-cat')
    assert.ok(
      preferences.getExclusions().familyIds.includes('purrs'),
      'restoring a recording leaves its excluded family intact'
    )
    assert.equal(JSON.parse(h.values.get(hiddenKey)).futureField, 'preserve me')
    h.assertFeedbackPreserved()
    destroy(preferences)
  }

  // Two tabs with delayed events preserve each other's latest additions and
  // restorations. Restoring a family never brings back separately hidden clips.
  {
    const h = storageHarness()
    const first = create({ storage: h.storage })
    const second = create({ storage: h.storage })
    first.getExclusions()
    second.getExclusions()
    deliverEvents = false
    first.hideClip('liked-cat')
    second.hideSource('cat-recordings')
    first.hideFamily('purrs')
    second.hideFamily('babies')
    first.restoreFamily('purrs')
    second.hideClip('rejected-babble')
    const expected = {
      clipIds: ['liked-cat', 'rejected-babble'],
      sourceKeys: ['cat-recordings'],
      familyIds: ['babies']
    }
    assert.deepEqual(sortedExclusions(first), expected)
    assert.deepEqual(sortedExclusions(second), expected)
    first.restoreClip('liked-cat')
    second.hideSource('another-source')
    assert.deepEqual(sortedExclusions(second), {
      clipIds: ['rejected-babble'],
      sourceKeys: ['another-source', 'cat-recordings'],
      familyIds: ['babies']
    })
    deliverEvents = true
    h.assertFeedbackPreserved()
    destroy(first)
    destroy(second)
  }

  // Saved feedback bootstraps a new browser only. An explicitly empty hidden
  // record represents the user's later restores and takes precedence over it.
  {
    const snapshot = {
      hidden: { clips: ['rejected-babble'], sources: ['old-source'] },
      reviews: {
        'liked-cat': {
          favorite: false,
          note: 'This must not replace the browser note.'
        }
      }
    }
    for (const existing of [undefined, '{}', '{"clips":[],"sources":[]}']) {
      const initial = {
        [familyKey]: JSON.stringify({ families: ['purrs'] })
      }
      if (existing !== undefined) initial[hiddenKey] = existing
      const h = storageHarness(initial)
      const preferences = create({ storage: h.storage })
      preferences.getExclusions()
      preferences.seedHidden(snapshot)
      assert.deepEqual(sortedExclusions(preferences), {
        clipIds: existing === undefined ? ['rejected-babble'] : [],
        sourceKeys: existing === undefined ? ['old-source'] : [],
        familyIds: ['purrs']
      })
      if (existing === undefined) {
        preferences.restoreClip('rejected-babble')
        preferences.restoreSource('old-source')
        preferences.seedHidden(snapshot)
        assert.deepEqual(preferences.getExclusions().clipIds, [])
        assert.deepEqual(preferences.getExclusions().sourceKeys, [])
      } else
        assert.equal(
          h.writes.length,
          0,
          'existing browser preferences are not seeded over'
        )
      h.assertFeedbackPreserved()
      destroy(preferences)
    }
  }

  // Quota failure must leave the current session useful: successive exclusions,
  // later restores and a recovered write all retain the unsaved choices.
  {
    const h = storageHarness({
      [hiddenKey]: JSON.stringify({ clips: ['older-hide'], sources: [] })
    })
    const errors = []
    const updates = []
    const preferences = create({
      storage: h.storage,
      onError: (error) => errors.push(error),
      onChange: (value) => updates.push(value)
    })
    h.state.failWrites = true
    preferences.hideClip('liked-cat')
    preferences.hideSource('cat-recordings')
    preferences.hideFamily('purrs')
    assert.deepEqual(sortedExclusions(preferences), {
      clipIds: ['liked-cat', 'older-hide'],
      sourceKeys: ['cat-recordings'],
      familyIds: ['purrs']
    })
    preferences.restoreClip('older-hide')
    preferences.restoreFamily('purrs')
    assert.deepEqual(sortedExclusions(preferences), {
      clipIds: ['liked-cat'],
      sourceKeys: ['cat-recordings'],
      familyIds: []
    })
    assert.ok(errors.length > 0, 'storage failures are reported')
    assert.ok(
      updates.length > 0,
      'unsaved preferences still update the current page'
    )
    h.state.failWrites = false
    preferences.hideSource('another-source')
    assert.deepEqual(JSON.parse(h.values.get(hiddenKey)), {
      clips: ['liked-cat'],
      sources: ['cat-recordings', 'another-source']
    })
    h.assertFeedbackPreserved()
    destroy(preferences)
  }

  // An unavailable storage API still permits local review choices without
  // throwing; a later read failure cannot erase choices already in memory.
  {
    const errors = []
    const preferences = create({
      storage: null,
      onError: (error) => errors.push(error)
    })
    preferences.hideClip('liked-cat')
    preferences.hideFamily('purrs')
    preferences.restoreFamily('purrs')
    assert.deepEqual(sortedExclusions(preferences), {
      clipIds: ['liked-cat'],
      sourceKeys: [],
      familyIds: []
    })
    assert.ok(errors.length > 0)
    destroy(preferences)

    const h = storageHarness()
    const saved = create({ storage: h.storage, onError: () => {} })
    saved.hideClip('liked-cat')
    h.state.failReads = true
    assert.ok(saved.getExclusions().clipIds.includes('liked-cat'))
    saved.hideSource('cat-recordings')
    assert.deepEqual(sortedExclusions(saved), {
      clipIds: ['liked-cat'],
      sourceKeys: ['cat-recordings'],
      familyIds: []
    })
    h.assertFeedbackPreserved()
    destroy(saved)
  }

  // Merging a rejected singleton into a new voice family must not resurrect
  // its recording or reject siblings the user never disliked.
  {
    const retired = [
      { id: 'tiny-giggle', label: 'Tiny giggle', clipIds: ['tiny-one'] },
      { id: 'puff', label: 'Puff', clipIds: ['puff-one', 'puff-two'] }
    ]
    for (const oldFamilies of [['tiny-giggle'], ['tiny-giggle', 'puff']]) {
      const h = storageHarness({
        [hiddenKey]: JSON.stringify({
          clips: ['liked-cat'],
          sources: ['old-source'],
          futureField: 'keep this'
        }),
        [familyKey]: JSON.stringify({
          families: [...oldFamilies, 'purrs'],
          futureField: 'keep this too'
        })
      })
      const preferences = create({ storage: h.storage })
      preferences.migrateFamilies(retired)
      const expectedClipIds = oldFamilies.includes('puff')
        ? ['liked-cat', 'puff-one', 'puff-two', 'tiny-one']
        : ['liked-cat', 'tiny-one']
      assert.deepEqual(sortedExclusions(preferences), {
        clipIds: expectedClipIds,
        sourceKeys: ['old-source'],
        familyIds: ['purrs']
      })
      assert.ok(
        !preferences.getExclusions().familyIds.includes('soft-giggles'),
        'the merged family remains selectable'
      )
      assert.deepEqual(JSON.parse(h.values.get(familyKey)), {
        families: ['purrs'],
        futureField: 'keep this too'
      })
      assert.equal(JSON.parse(h.values.get(hiddenKey)).futureField, 'keep this')
      const writesAfterMigration = h.writes.length
      preferences.migrateFamilies(retired)
      preferences.getExclusions()
      assert.equal(
        h.writes.length,
        writesAfterMigration,
        'repeated migration has no extra persistence effects'
      )
      preferences.restoreClip('tiny-one')
      preferences.migrateFamilies(retired)
      assert.ok(
        !preferences.getExclusions().clipIds.includes('tiny-one'),
        'a later explicit clip restore takes precedence over migration history'
      )
      h.assertFeedbackPreserved()
      destroy(preferences)
    }
  }

  // Missing records do not create preferences or invent disapprovals. An
  // incomplete retired-family description cannot safely discard its old hide.
  {
    const h = storageHarness()
    const preferences = create({ storage: h.storage })
    preferences.migrateFamilies([{ id: 'tiny-giggle', clipIds: ['tiny-one'] }])
    preferences.migrateFamilies(null)
    assert.equal(h.writes.length, 0)
    assert.deepEqual(preferences.getExclusions(), {
      clipIds: [],
      sourceKeys: [],
      familyIds: []
    })
    preferences.hideFamily('unknown-old-family')
    preferences.migrateFamilies([
      { id: 'unknown-old-family', clipIds: [] },
      null
    ])
    assert.ok(
      preferences.getExclusions().familyIds.includes('unknown-old-family')
    )
    preferences.hideFamily('tiny-giggle')
    assert.deepEqual(sortedExclusions(preferences), {
      clipIds: ['tiny-one'],
      sourceKeys: [],
      familyIds: ['unknown-old-family']
    })
    h.assertFeedbackPreserved()
    destroy(preferences)
  }

  // Older tabs can still write obsolete IDs. A registered migration handles
  // both browser storage events and same-page preference changes automatically.
  {
    const h = storageHarness()
    const updates = []
    const current = create({
      storage: h.storage,
      onChange: (value) => updates.push(value)
    })
    current.migrateFamilies([
      { id: 'tiny-giggle', clipIds: ['tiny-one'] },
      { id: 'puff', clipIds: ['puff-one'] }
    ])
    h.values.set(
      familyKey,
      JSON.stringify({ families: ['tiny-giggle', 'purrs'] })
    )
    storageEvent(familyKey, h.storage)
    assert.deepEqual(updates.at(-1), {
      clipIds: ['tiny-one'],
      sourceKeys: [],
      familyIds: ['purrs']
    })
    const oldTab = create({ storage: h.storage })
    oldTab.hideFamily('puff')
    assert.deepEqual(sortedExclusions(current), {
      clipIds: ['puff-one', 'tiny-one'],
      sourceKeys: [],
      familyIds: ['purrs']
    })
    assert.deepEqual(JSON.parse(h.values.get(familyKey)).families, ['purrs'])
    h.assertFeedbackPreserved()
    destroy(oldTab)
    destroy(current)
  }

  // The original durable family exclusion remains until replacement clips
  // save. Read-only/quota failures preserve existing in-memory choices as well.
  {
    const h = storageHarness({
      [hiddenKey]: JSON.stringify({
        clips: ['liked-cat'],
        sources: ['old-source']
      }),
      [familyKey]: JSON.stringify({ families: ['tiny-giggle', 'purrs'] })
    })
    const preferences = create({ storage: h.storage, onError: () => {} })
    const retired = [{ id: 'tiny-giggle', clipIds: ['tiny-one'] }]
    h.state.failWrites = true
    preferences.hideClip('unsaved-choice')
    const originalFamilyRecord = h.values.get(familyKey)
    preferences.migrateFamilies(retired)
    assert.deepEqual(sortedExclusions(preferences), {
      clipIds: ['liked-cat', 'tiny-one', 'unsaved-choice'],
      sourceKeys: ['old-source'],
      familyIds: ['purrs']
    })
    assert.equal(
      h.values.get(familyKey),
      originalFamilyRecord,
      'failed clip persistence cannot erase the original durable hide'
    )
    assert.ok(
      JSON.parse(h.values.get(familyKey)).families.includes('tiny-giggle')
    )
    h.state.failWrites = false
    preferences.migrateFamilies(retired)
    assert.deepEqual(JSON.parse(h.values.get(hiddenKey)), {
      clips: ['liked-cat', 'unsaved-choice', 'tiny-one'],
      sources: ['old-source']
    })
    assert.deepEqual(JSON.parse(h.values.get(familyKey)).families, ['purrs'])
    h.assertFeedbackPreserved()
    destroy(preferences)
  }

  // A failure after clip persistence is harmless duplication. It is retryable,
  // including from a new page, and the already migrated clips stay excluded.
  {
    const h = storageHarness({
      [familyKey]: JSON.stringify({ families: ['puff'] })
    })
    const retired = [{ id: 'puff', clipIds: ['puff-one'] }]
    const first = create({ storage: h.storage, onError: () => {} })
    h.state.failWriteKeys.add(familyKey)
    first.migrateFamilies(retired)
    assert.ok(JSON.parse(h.values.get(hiddenKey)).clips.includes('puff-one'))
    assert.deepEqual(JSON.parse(h.values.get(familyKey)).families, ['puff'])
    assert.deepEqual(first.getExclusions(), {
      clipIds: ['puff-one'],
      sourceKeys: [],
      familyIds: []
    })
    h.state.failWriteKeys.clear()
    first.migrateFamilies(retired)
    assert.deepEqual(JSON.parse(h.values.get(familyKey)).families, [])
    destroy(first)
    const reloaded = create({ storage: h.storage })
    reloaded.migrateFamilies(retired)
    assert.deepEqual(reloaded.getExclusions(), {
      clipIds: ['puff-one'],
      sourceKeys: [],
      familyIds: []
    })
    h.assertFeedbackPreserved()
    destroy(reloaded)
  }

  // Restore remains usable during a failed migration. Its session override
  // becomes durable when storage recovers, without restoring sibling clips.
  for (const failAfterClipsSaved of [false, true]) {
    const h = storageHarness({
      [hiddenKey]: JSON.stringify({
        clips: ['liked-cat'],
        sources: ['old-source']
      }),
      [familyKey]: JSON.stringify({ families: ['puff', 'purrs'] })
    })
    const retired = [{ id: 'puff', clipIds: ['puff-one', 'puff-two'] }]
    const preferences = create({ storage: h.storage, onError: () => {} })
    if (failAfterClipsSaved) h.state.failWriteKeys.add(familyKey)
    else h.state.failWrites = true
    preferences.migrateFamilies(retired)
    h.state.failWrites = true
    preferences.restoreClip('puff-one')
    assert.deepEqual(
      sortedExclusions(preferences),
      {
        clipIds: ['liked-cat', 'puff-two'],
        sourceKeys: ['old-source'],
        familyIds: ['purrs']
      },
      'an explicit restore overrides a retired-family fallback for this visit'
    )
    assert.ok(
      JSON.parse(h.values.get(familyKey)).families.includes('puff'),
      'the durable fallback remains until storage can save the new choice'
    )
    preferences.migrateFamilies(retired)
    assert.ok(!preferences.getExclusions().clipIds.includes('puff-one'))
    h.state.failWrites = false
    h.state.failWriteKeys.clear()
    preferences.migrateFamilies(retired)
    assert.deepEqual(JSON.parse(h.values.get(hiddenKey)).clips.toSorted(), [
      'liked-cat',
      'puff-two'
    ])
    assert.deepEqual(JSON.parse(h.values.get(familyKey)).families, ['purrs'])
    h.values.set(familyKey, JSON.stringify({ families: ['puff', 'purrs'] }))
    storageEvent(familyKey, h.storage)
    assert.ok(
      preferences.getExclusions().clipIds.includes('puff-one'),
      'a later old-tab hide takes precedence after the restore was saved'
    )
    preferences.restoreClip('puff-one')
    destroy(preferences)
    const reloaded = create({ storage: h.storage })
    reloaded.migrateFamilies(retired)
    assert.ok(
      !reloaded.getExclusions().clipIds.includes('puff-one'),
      'the restored recording remains visible on the next visit'
    )
    assert.ok(reloaded.getExclusions().clipIds.includes('puff-two'))
    h.assertFeedbackPreserved()
    destroy(reloaded)
  }

  // A newly accepted feedback pass applies to existing browsers once, while
  // later local restores and dislikes win on every visit using that revision.
  {
    const h = storageHarness({
      [hiddenKey]: JSON.stringify({
        clips: ['older-hide'],
        sources: ['older-source']
      }),
      [familyKey]: JSON.stringify({ families: ['older-family'] })
    })
    const snapshot = {
      hidden: {
        clips: ['latest-hide'],
        sources: ['latest-source'],
        families: ['latest-family']
      },
      reviews: {
        'liked-cat': { favorite: false, note: 'Do not replace this review.' }
      }
    }
    const first = create({ storage: h.storage })
    const second = create({ storage: h.storage })
    second.getExclusions()
    first.applySnapshot(snapshot, 'family-pass-1')
    assert.deepEqual(sortedExclusions(first), {
      clipIds: ['latest-hide', 'older-hide'],
      sourceKeys: ['latest-source', 'older-source'],
      familyIds: ['latest-family', 'older-family']
    })
    assert.ok(
      h.values.has(snapshotKey),
      'completion is recorded after both preference records save'
    )
    const writesAfterApply = h.writes.length
    first.applySnapshot(snapshot, 'family-pass-1')
    assert.equal(
      h.writes.length,
      writesAfterApply,
      'the same revision does not rewrite preferences'
    )
    first.restoreClip('latest-hide')
    first.restoreSource('latest-source')
    first.restoreFamily('latest-family')
    first.hideClip('later-dislike')
    second.applySnapshot(snapshot, 'family-pass-1')
    assert.deepEqual(sortedExclusions(second), {
      clipIds: ['later-dislike', 'older-hide'],
      sourceKeys: ['older-source'],
      familyIds: ['older-family']
    })
    destroy(first)
    destroy(second)
    const reloaded = create({ storage: h.storage })
    reloaded.applySnapshot(snapshot, 'family-pass-1')
    assert.ok(!reloaded.getExclusions().clipIds.includes('latest-hide'))
    reloaded.applySnapshot(
      { hidden: { clips: ['next-pass-hide'] } },
      'family-pass-2'
    )
    assert.deepEqual(sortedExclusions(reloaded), {
      clipIds: ['later-dislike', 'next-pass-hide', 'older-hide'],
      sourceKeys: ['older-source'],
      familyIds: ['older-family']
    })
    h.assertFeedbackPreserved()
    destroy(reloaded)
  }

  // Unlike legacy absent-only seeding, a new revision also applies when the
  // browser already has an intentionally empty preference record.
  {
    const h = storageHarness({
      [hiddenKey]: '{"clips":[],"sources":[]}',
      [familyKey]: '{"families":[]}'
    })
    const preferences = create({ storage: h.storage })
    preferences.applySnapshot(
      {
        hidden: {
          clips: ['newly-rejected'],
          families: ['newly-rejected-family']
        }
      },
      'new-feedback'
    )
    assert.deepEqual(preferences.getExclusions(), {
      clipIds: ['newly-rejected'],
      sourceKeys: [],
      familyIds: ['newly-rejected-family']
    })
    h.assertFeedbackPreserved()
    destroy(preferences)
  }

  // A partial save never claims completion. The saved half carries enough
  // progress that restoring it before a reload cannot be undone by a retry.
  for (const failedKey of [hiddenKey, familyKey]) {
    const h = storageHarness()
    const snapshot = {
      hidden: {
        clips: ['latest-hide'],
        sources: ['latest-source'],
        families: ['latest-family']
      }
    }
    const preferences = create({ storage: h.storage, onError: () => {} })
    h.state.failWriteKeys.add(failedKey)
    preferences.applySnapshot(snapshot, 'partial-pass')
    assert.ok(
      !h.values.has(snapshotKey),
      'partial preference persistence cannot set a completion marker'
    )
    if (failedKey === familyKey) {
      preferences.restoreClip('latest-hide')
      preferences.restoreSource('latest-source')
    } else preferences.restoreFamily('latest-family')
    destroy(preferences)
    h.state.failWriteKeys.clear()
    const reloaded = create({ storage: h.storage })
    reloaded.applySnapshot(snapshot, 'partial-pass')
    assert.deepEqual(sortedExclusions(reloaded), {
      clipIds: failedKey === familyKey ? [] : ['latest-hide'],
      sourceKeys: failedKey === familyKey ? [] : ['latest-source'],
      familyIds: failedKey === hiddenKey ? [] : ['latest-family']
    })
    assert.ok(h.values.has(snapshotKey))
    h.assertFeedbackPreserved()
    destroy(reloaded)
  }

  // During a wholly unavailable store, repeated application respects choices
  // made after the initial snapshot and saves those choices on recovery.
  {
    const h = storageHarness()
    const errors = []
    const snapshot = {
      hidden: {
        clips: ['latest-hide'],
        sources: ['latest-source'],
        families: ['latest-family']
      }
    }
    const preferences = create({
      storage: h.storage,
      onError: (error) => errors.push(error)
    })
    h.state.failWrites = true
    preferences.applySnapshot(snapshot, 'offline-pass')
    preferences.restoreClip('latest-hide')
    preferences.restoreSource('latest-source')
    preferences.restoreFamily('latest-family')
    preferences.hideClip('local-new-dislike')
    preferences.applySnapshot(snapshot, 'offline-pass')
    assert.deepEqual(preferences.getExclusions(), {
      clipIds: ['local-new-dislike'],
      sourceKeys: [],
      familyIds: []
    })
    assert.ok(!h.values.has(snapshotKey))
    h.state.failWrites = false
    preferences.applySnapshot(snapshot, 'offline-pass')
    assert.ok(errors.length > 0)
    assert.ok(h.values.has(snapshotKey))
    destroy(preferences)
    const reloaded = create({ storage: h.storage })
    reloaded.applySnapshot(snapshot, 'offline-pass')
    assert.deepEqual(reloaded.getExclusions(), {
      clipIds: ['local-new-dislike'],
      sourceKeys: [],
      familyIds: []
    })
    h.assertFeedbackPreserved()
    destroy(reloaded)
  }

  // Failure of the final marker does not replay either saved half. Restores
  // remain effective even if a new page must finish the marker later.
  {
    const h = storageHarness()
    const snapshot = {
      hidden: { clips: ['latest-hide'], families: ['latest-family'] }
    }
    const preferences = create({ storage: h.storage, onError: () => {} })
    h.state.failWriteKeys.add(snapshotKey)
    preferences.applySnapshot(snapshot, 'marker-pass')
    assert.ok(!h.values.has(snapshotKey))
    preferences.restoreClip('latest-hide')
    preferences.restoreFamily('latest-family')
    destroy(preferences)
    h.state.failWriteKeys.clear()
    const reloaded = create({ storage: h.storage })
    reloaded.applySnapshot(snapshot, 'marker-pass')
    assert.deepEqual(reloaded.getExclusions(), {
      clipIds: [],
      sourceKeys: [],
      familyIds: []
    })
    assert.ok(h.values.has(snapshotKey))
    h.assertFeedbackPreserved()
    destroy(reloaded)
  }

  // Snapshot defaults and retired-family migration compose in either order;
  // a later restore must not be undone by either mechanism on the next visit.
  for (const registerFirst of [true, false]) {
    const h = storageHarness()
    const snapshot = { hidden: { families: ['old-puff'] } }
    const retired = [{ id: 'old-puff', clipIds: ['puff-one', 'puff-two'] }]
    const preferences = create({ storage: h.storage })
    if (registerFirst) preferences.migrateFamilies(retired)
    preferences.applySnapshot(snapshot, 'retired-pass')
    if (!registerFirst) preferences.migrateFamilies(retired)
    assert.deepEqual(sortedExclusions(preferences), {
      clipIds: ['puff-one', 'puff-two'],
      sourceKeys: [],
      familyIds: []
    })
    preferences.restoreClip('puff-one')
    destroy(preferences)
    const reloaded = create({ storage: h.storage })
    reloaded.migrateFamilies(retired)
    reloaded.applySnapshot(snapshot, 'retired-pass')
    assert.deepEqual(reloaded.getExclusions(), {
      clipIds: ['puff-two'],
      sourceKeys: [],
      familyIds: []
    })
    h.assertFeedbackPreserved()
    destroy(reloaded)
  }

  // Live pages react to preference events, ignore unrelated star/note events,
  // and stop receiving updates when their subscriptions or page are removed.
  {
    const h = storageHarness()
    const updates = []
    const subscribed = []
    const preferences = create({
      storage: h.storage,
      onChange: (value) => updates.push(value)
    })
    const unsubscribe = preferences.subscribe((value) => subscribed.push(value))
    const initialListeners = [...listeners.values()].reduce(
      (sum, set) => sum + set.size,
      0
    )
    h.values.set(familyKey, JSON.stringify({ families: ['purrs'] }))
    storageEvent(familyKey, h.storage)
    assert.ok(updates.at(-1).familyIds.includes('purrs'))
    assert.ok(subscribed.at(-1).familyIds.includes('purrs'))
    const count = updates.length
    storageEvent(reviewKey, h.storage)
    assert.equal(updates.length, count)
    unsubscribe()
    const subscribedCount = subscribed.length
    h.values.set(
      hiddenKey,
      JSON.stringify({ clips: ['liked-cat'], sources: [] })
    )
    storageEvent(hiddenKey, h.storage)
    assert.ok(updates.at(-1).clipIds.includes('liked-cat'))
    assert.equal(subscribed.length, subscribedCount)
    h.values.delete(hiddenKey)
    h.values.delete(familyKey)
    storageEvent(null, h.storage)
    assert.deepEqual(updates.at(-1), {
      clipIds: [],
      sourceKeys: [],
      familyIds: []
    })
    destroy(preferences)
    const destroyedCount = updates.length
    h.values.set(familyKey, JSON.stringify({ families: ['babies'] }))
    storageEvent(familyKey, h.storage)
    assert.equal(updates.length, destroyedCount)
    assert.ok(
      [...listeners.values()].reduce((sum, set) => sum + set.size, 0) <
        initialListeners,
      'destroy removes browser event listeners'
    )
    h.assertFeedbackPreserved()
  }

  assert.ok(
    [...listeners.values()].every((set) => set.size === 0),
    'no preference listeners outlive their pages'
  )
  console.log(
    'Review preference checks passed: stars and notes preserved, independent hides/restores, delayed cross-tab changes, absent-only seeding, safe family-merge migration, revisioned feedback baselines, storage failure recovery, and listener cleanup.'
  )
} finally {
  for (const preferences of preferencesToDestroy) preferences.destroy()
  for (const [key, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
}
