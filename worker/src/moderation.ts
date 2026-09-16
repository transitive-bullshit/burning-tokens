import { z } from 'zod'
import type { MediaType, ModerationState } from './media-policy'

export type ModerationResult = {
  state: ModerationState
  model: string | null
  checkedAt: number
  reason:
    | 'passed'
    | 'flagged'
    | 'unsupported-format'
    | 'unconfigured'
    | 'service-error'
}
const resultSchema = z.object({
  model: z.string(),
  results: z.array(z.object({ flagged: z.boolean() })).min(1)
})
/** A decision applies only to these immutable bytes. No generated interpretation. */
export async function moderateMedia(
  bytes: Uint8Array,
  mime: MediaType,
  apiKey?: string,
  request: typeof fetch = fetch
): Promise<ModerationResult> {
  const checkedAt = Date.now()
  if (mime.startsWith('audio/'))
    return {
      state: 'unsupported',
      model: null,
      checkedAt,
      reason: 'unsupported-format'
    }
  if (!apiKey)
    return { state: 'error', model: null, checkedAt, reason: 'unconfigured' }
  try {
    const input =
      mime === 'text/plain'
        ? [
            {
              type: 'text',
              text: new TextDecoder('utf-8', {
                fatal: true,
                ignoreBOM: false
              }).decode(bytes)
            }
          ]
        : [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mime};base64,${base64(bytes)}`
              }
            }
          ]
    const response = await request('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model: 'omni-moderation-latest', input }),
      signal: AbortSignal.timeout(5000)
    })
    if (!response.ok) throw new Error('Moderation unavailable')
    const result = resultSchema.parse(await response.json())
    const flagged = result.results.some((entry) => entry.flagged)
    return {
      state: flagged ? 'rejected' : 'approved',
      model: result.model,
      checkedAt,
      reason: flagged ? 'flagged' : 'passed'
    }
  } catch {
    return { state: 'error', model: null, checkedAt, reason: 'service-error' }
  }
}

function base64(bytes: Uint8Array) {
  const chunks: string[] = []
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)))
  }
  return btoa(chunks.join(''))
}
