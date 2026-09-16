import type { VisitEvent, VisitSnapshot } from './protocol'

export const VISIT_JOURNAL_LIMIT = 200
export const MAX_VISIT_FRAME_BYTES = 256 * 1024
export type VisitFrame =
  | { type: 'snapshot'; visit: VisitSnapshot }
  | {
      type: 'delta'
      from: number
      visit: Omit<VisitSnapshot, 'events'>
      events: VisitEvent[]
    }

export function visitFrame(
  visit: VisitSnapshot,
  cursor: number | null
): VisitFrame {
  const oldest = visit.events[0]?.sequence ?? visit.revision + 1
  if (cursor === null || cursor > visit.revision || cursor < oldest - 1)
    return { type: 'snapshot', visit }
  const { events, ...state } = visit
  return {
    type: 'delta',
    from: cursor,
    visit: state,
    events: events.filter((event) => event.sequence > cursor)
  }
}

/** A missing sequence requires a fresh snapshot, never a silently incomplete journal. */
export function applyVisitFrame(
  previous: VisitSnapshot | undefined,
  frame: VisitFrame
): VisitSnapshot {
  if (
    !frame ||
    !['snapshot', 'delta'].includes(frame.type) ||
    !frame.visit ||
    !Number.isSafeInteger(frame.visit.revision) ||
    frame.visit.revision < 0
  )
    throw new Error('Invalid visit frame')
  if (previous && previous.id !== frame.visit.id) throw new Error('Wrong visit')
  if (previous && frame.visit.revision <= previous.revision) return previous
  if (frame.type === 'snapshot') return frame.visit
  if (
    !previous ||
    frame.from > previous.revision ||
    frame.from < 0 ||
    !Number.isSafeInteger(frame.from)
  )
    throw new Error('Visit stream has a gap')
  let sequence = frame.from
  for (const event of frame.events) {
    if (event.sequence !== ++sequence)
      throw new Error('Visit journal has a gap')
  }
  if (sequence !== frame.visit.revision)
    throw new Error('Visit journal is incomplete')
  return {
    ...frame.visit,
    events: [
      ...previous.events,
      ...frame.events.filter((event) => event.sequence > previous.revision)
    ].slice(-VISIT_JOURNAL_LIMIT)
  }
}
