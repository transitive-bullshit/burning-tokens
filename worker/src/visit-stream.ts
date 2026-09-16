import type { VisitSnapshot } from '../../lib/retreat/protocol'
import {
  MAX_VISIT_FRAME_BYTES,
  visitFrame
} from '../../lib/retreat/visit-stream'

type Attachment = {
  acknowledged: number | null
  sent: number
  waiting: boolean
  sentAt: number
  rateAt: number
  messages: number
}
const ACK_TIMEOUT_MS = 30_000
function close(socket: WebSocket, code: number, reason: string) {
  try {
    socket.close(code, reason)
  } catch {
    /* Already disconnected. */
  }
}

/** Only small cursor metadata lives on the hibernating socket; no per-viewer event queue. */
export class VisitStream {
  constructor(
    private readonly snapshot: () => VisitSnapshot,
    private readonly now: () => number = Date.now
  ) {}
  open(socket: WebSocket, cursor: number | null) {
    socket.serializeAttachment({
      acknowledged: cursor,
      sent: -1,
      waiting: false,
      sentAt: 0,
      rateAt: this.now(),
      messages: 0
    } satisfies Attachment)
    this.send(socket, true)
  }
  send(socket: WebSocket, initial = false) {
    try {
      const state = socket.deserializeAttachment() as Attachment | null
      if (!state) {
        close(socket, 1012, 'Reconnect to resume')
        return
      }
      if (state.waiting) {
        if (this.now() - state.sentAt >= ACK_TIMEOUT_MS)
          close(socket, 1013, 'Viewer is behind; reconnect to resume')
        return
      }
      const visit = this.snapshot()
      if (!initial && state.acknowledged === visit.revision) return
      const text = JSON.stringify(visitFrame(visit, state.acknowledged))
      if (new TextEncoder().encode(text).byteLength > MAX_VISIT_FRAME_BYTES) {
        close(socket, 1009, 'Refresh the visit to resume')
        return
      }
      socket.send(text)
      socket.serializeAttachment({
        ...state,
        sent: visit.revision,
        waiting: true,
        sentAt: this.now()
      })
    } catch {
      close(socket, 1011, 'Reconnect for the latest visit')
    }
  }
  message(socket: WebSocket, message: string | ArrayBuffer) {
    try {
      const state = socket.deserializeAttachment() as Attachment | null
      if (!state || typeof message !== 'string' || message.length > 128) {
        close(socket, 1008, 'Invalid stream acknowledgement')
        return
      }
      const now = this.now()
      const messages = now - state.rateAt < 60_000 ? state.messages + 1 : 1
      const rateAt = now - state.rateAt < 60_000 ? state.rateAt : now
      if (messages > 180) {
        close(socket, 1008, 'Too many stream messages')
        return
      }
      const ack = JSON.parse(message) as { type?: unknown; revision?: unknown }
      if (
        ack.type !== 'ack' ||
        !Number.isSafeInteger(ack.revision) ||
        ack.revision !== state.sent
      ) {
        close(socket, 1008, 'Acknowledge the received revision')
        return
      }
      socket.serializeAttachment({
        ...state,
        acknowledged: state.sent,
        waiting: false,
        rateAt,
        messages
      })
      // Reads current committed state after the ACK, including changes made while waiting.
      this.send(socket)
    } catch {
      close(socket, 1008, 'Invalid stream acknowledgement')
    }
  }
}
