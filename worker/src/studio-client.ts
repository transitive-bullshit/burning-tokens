import type { Env } from './env'
import type { ArtifactViewer } from './media-policy'

/** Only authenticated Worker/Session code constructs this internal projection. */
export function studioRequest(
  env: Env,
  request: Request,
  viewer: ArtifactViewer
) {
  const headers = new Headers(request.headers)
  headers.set('X-Retreat-Viewer', JSON.stringify(viewer))
  return env.STUDIO.getByName('studio').fetch(new Request(request, { headers }))
}
