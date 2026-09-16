import { z } from 'zod'
import { metricEvents, metricOutcomes, metricScopes } from './metrics'
import type { Env } from './env'
import { HttpError, json } from './http'
const count = z.coerce.number().finite().nonnegative()
const row = z.object({
  event: z.enum(metricEvents),
  outcome: z.enum(metricOutcomes),
  scope: z.enum(metricScopes),
  observations: count,
  meanMs: count,
  totalAmount: count,
  totalExtra: count
})
const result = z.object({ data: z.array(row).max(500) })

/** Admin-only fixed aggregate query: callers cannot supply SQL, filters or identifiers. */
export async function readMetrics(env: Env): Promise<Response> {
  if (
    !env.CLOUDFLARE_API_TOKEN ||
    !/^[a-f0-9]{32}$/.test(env.ANALYTICS_ACCOUNT_ID ?? '') ||
    !/^[a-z_]{1,63}$/.test(env.ANALYTICS_DATASET ?? '')
  )
    throw new HttpError(503, 'Metrics reader is not configured')
  const sql = `SELECT blob2 AS event, blob3 AS outcome, blob4 AS scope,
    SUM(_sample_interval) AS observations,
    SUM(_sample_interval * double1) / SUM(_sample_interval) AS meanMs,
    SUM(_sample_interval * double2) AS totalAmount,
    SUM(_sample_interval * double3) AS totalExtra
    FROM ${env.ANALYTICS_DATASET}
    WHERE timestamp > NOW() - INTERVAL '1' HOUR AND blob1 = 'v1'
    GROUP BY event, outcome, scope LIMIT 500 FORMAT JSON`
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.ANALYTICS_ACCOUNT_ID}/analytics_engine/sql`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`
        },
        body: sql,
        signal: AbortSignal.timeout(5000)
      }
    )
    if (!response.ok) throw new Error('Unavailable')
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No body')
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.byteLength
      if (size > 128 * 1024) {
        await reader.cancel()
        throw new Error('Too large')
      }
      chunks.push(part.value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.length
    }
    const rows = result.parse(JSON.parse(new TextDecoder().decode(bytes))).data
    return json({
      generatedAt: Date.now(),
      windowSeconds: 3600,
      sampled: true,
      truncated: rows.length === 500,
      rows
    })
  } catch {
    throw new HttpError(503, 'Metrics are temporarily unavailable')
  }
}
