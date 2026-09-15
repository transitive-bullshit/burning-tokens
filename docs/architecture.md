# Human retreat app

The Next.js App Router owns `/`, `/camp`, `/camp/[room]`, and `/about`. All seven room routes are statically generated; unknown rooms return 404. The root layout supplies a consistent header and footer. Next links and canvas hotspots participate in browser history. Agent entry and real presence are deferred.

The landing page is server rendered, with the accepted background, a live vector wordmark and one primary CTA. Tailwind v4 and the Radix-based shadcn Button provide the shell. Space Grotesk and Fraunces are self-hosted with their licenses.

`components/world.tsx` lazily imports the existing renderer into a scoped DOM island. React owns routing and surrounding UI; `lib/world/scene.js` owns its scene markup, animation and controls. The Canvas modules remain JavaScript behind a typed mount/dispose boundary. The markup is trusted static source, never user HTML.

Each mount loads only the current background and shared lossless WebP creature atlas. Sound clips load on demand. Unmount aborts listeners, disconnects observers, cancels animation and disposes physics, GPU resources and sound. Pending image loads cannot restart a departed room. Crowd count and display mode survive navigation in session storage; sound and effect settings retain browser storage keys.

`public/brand` contains identity and fonts; `public/world` contains scenes; `public/audio` contains the 149 active sounds. [Asset provenance](asset-manifest.json) retains source and licensing metadata. The atlas preserves authored silhouette clipping; this migration does not create new transparent animation assets.

## Validation

Run `pnpm build`, `pnpm test:types`, `pnpm test:lint`, and `pnpm test:world`. The world checks cover population caps, sustained motion, cross-zone dragging, effects, audio selection/cooldowns and preference preservation. Browser checks additionally cover direct routes, back/forward, repeated mounts, drag/drop, audio unlock and narrow layouts.
