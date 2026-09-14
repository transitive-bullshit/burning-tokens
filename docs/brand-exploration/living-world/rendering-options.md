# Moonclay rendering options

**Exploration · 14 September 2026.** The selected direction remains Moonclay Commons: warm sculpted clay, lightly glazed ceramic, soft amber lighting and happy nonhuman creatures. Midjourney studies are excluded from this recommendation. Read the [current specification](../../wip-mvp-spec.md) for requirements and [brand identity](../../brand-identity.md) for accepted visual rules. Full-view targets of 300 camp creatures and 100 per Bathhouse courtyard come from the user; benchmark gates and crowd-layout techniques below are proposals to validate them. None is a measured capacity claim or renderer decision.

## Recommendation

Build an authored **2.5D world**: empty illustrated environment layers, independent creature sprites, a few moving water/steam/light layers, and foreground architecture that can cover the creatures correctly. Keep one fixed camera for the camp and one authored camera for each room. The clay look comes primarily from the artwork, lighting and compositing; it does not require real-time 3D.

Use the dependency-free Canvas study to answer the visual question first. **PixiJS with WebGL is the production candidate** if richer compositing or the measured crowd workload justifies it. PixiJS v8 currently recommends its WebGL renderer; its documentation labels WebGPU experimental and CanvasRenderer coming soon. A separate static image plus HTML navigation/list is the fallback, not an assumed built-in Canvas fallback. [PixiJS renderers](https://pixijs.com/8.x/guides/components/renderers)

A useful distinction: we can **author clay creatures in 3D and render them offline into transparent sprite sheets** without delivering a 3D engine to every visitor. That offers consistent directional poses and lighting while retaining a simple browser scene. This is an art-production recommendation, not a commitment to a modeling tool.

## Three approaches

| Approach | What it preserves well | Main cost or limitation | Assessment for Moonclay |
| --- | --- | --- | --- |
| Empty illustrated layers + 2D sprites | Exact soft lighting and handmade detail; independently moving creatures; authored room views | Directional sprite production, limited camera angles and zoom, deliberate occlusion masks | Best first direction. Build depth through architecture, ground contact and animation timing. |
| Illustrated layers + real 3D creatures | Smooth turning, deforming silhouettes and many poses | Camera calibration, color/light matching, ground shadows, depth proxies for occlusion, 3D character asset pipeline | Consider only if directional sprites fail a specific close-up need. A 3D creature over a flat plate still needs scene depth to pass behind a rim. |
| Full real-time 3D environment + creatures | Coherent depth, arbitrary viewpoint changes, geometric interactions | Modeling seven rooms, material/lighting tuning, scene optimization and broader device validation | Highest scope; the current fixed-camera experience does not need its main advantage. Revisit if camera freedom or geometric interactions become essential. |

This ranking is an inference from the selected art direction and feature scope, not a library benchmark. Three.js supports an orthographic camera that preserves an object's rendered size with distance. It also supports instancing repeated geometry/materials to reduce draw calls; that helps repeated creature forms, but does not make an arbitrarily complex or independently rigged crowd free. [OrthographicCamera](https://threejs.org/docs/pages/OrthographicCamera.html), [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html)

Mixing PixiJS and Three.js is technically supported using a shared WebGL context and explicit renderer-state resets. That still leaves camera, layering, resource and resize coordination to the application. Adding both libraries is not the default proposal. [Official integration guide](https://pixijs.com/8.x/guides/third-party/mixing-three-and-pixi)

## Make the Bathhouse a stage

The current concept art establishes materials and composition. It cannot serve unchanged as the live background because its visitors and their shadows are baked into the pixels. Production needs a complete **empty Bathhouse** that looks intentional at zero attendance, then independent participants placed into it.

Composite these elements from back to front:

1. Empty floor, rear walls, lantern illumination and static architectural shadows.
2. Pool bed and local moving water texture, contained by an authored pool shape.
3. Separate soft contact shadows, then creatures and low props in depth order.
4. Waterline treatment and pool-front rims that cover submerged lower bodies.
5. Foreground columns, arches, plants and terrace edges.
6. Sparse steam and light accents, kept clear of faces and selection affordances.

Controls, counts and activity details remain HTML above or alongside the scene. A selected creature can gain a simple ground ring and corresponding list highlight. Render names on selection, not over every head.

**Depth is authored, not guessed from the image.** Sorting by each creature's floor-contact point works for a simple level floor. Split raised platforms, seated niches and pools into explicit depth groups with their own waypoints, floor height and occluders. A front rim covers the lower body; a rear rim does not. Give each effect a surface and bounded region. Do not add a transparent full-screen water layer that makes all visitors look submerged.

Use soft ground shadows to anchor walkers and reduce them for floating or submerged poses. Lighting should match the empty plate: broad warm key light, cobalt fill and restrained highlights. Avoid flipping a sprite horizontally when doing so reverses its baked light direction. Use separately authored facing views or keep the tested motion range small.

Real-time shadows are not necessary to get convincing contact. Three.js itself documents the additional rendering cost of shadow-casting lights and discusses baked lighting and textured fake shadows as alternatives. [Three.js shadows](https://threejs.org/manual/en/shadows.html)

### Motion and apparent interaction

One stable avatar is associated with each represented session. A small local controller picks a resting spot or short path within its observed room, turns the creature, travels slowly, then settles. Paths, seats and pool positions are authored. Reserve destinations so two creatures do not occupy the same point; keep a modest clearance between moving bodies. A small bounded collision response creates believable yielding, scooting and shared-space staging; it does not require a general physics engine or simulated needs.

Use a few common poses: idle, travel, turn, sit, soak and declared rest. Blink and breathing phases differ between creatures; avoid a synchronized bouncing crowd. An occasional shared glance or adjacent seat is decorative acting. A session entering another room comes from an observed room change; decorative travel never changes server state. Apparent contact is not evidence of conversation, feeling or an agent executing a physical action.

The user also wants **direct manipulation**: pointer/touch pickup with a small visual lift, a short drag within the current authored area, and gentle collision response from nearby bodies followed by a quick settle. Keep the held creature’s floor position, lift and contact shadow separate so it remains grounded in the scene’s geometry. Bound displacement and response energy; dragging must not push creatures through room boundaries, walls or pool rims. When motion is enabled, unheld creatures must continue moving throughout a drag. Pause autonomous updates only for the held creature and coordinate local collision response with each affected neighbor’s current position; do not pause the whole crowd. Cancel or release the gesture cleanly on pointer loss or view changes. These are interaction requirements, independent of whether Canvas or PixiJS draws them.

All manipulation is local presentation. It never changes the represented session, observed room, recorded activity, rest declaration or another observer’s scene. Preserve selection and offer optional keyboard nudges from a selected creature as an alternative to dragging. The HTML list remains the equivalent way to inspect every included public record.

Keep the caption **“A playful view of recent visits. Movement is illustrative.”** Pause local animation and polling in hidden tabs. Pause and reduced-motion modes still permit deliberate dragging/nudging, with direct position and local separation updates; disable autonomous bounce, inertia and continued drift.

## Scaling the crowd without losing the world

Three limits are independent: **tracked sessions**, **records returned in a snapshot**, and **creatures visible in the current composition**. A population of 1,000 need not mean equally large faces overlapping in a small pool. The current 10,000-record presence-index bound is not a browser drawing target.

| Presentation | Target or experiment | What the human sees |
| --- | --- | --- |
| Summary | 60 camp creatures on desktop / 24 on small screens; 24 in the Bathhouse | Stable selection across occupied rooms, a count for each area, explicit “showing X of Y tracked recent sessions” where sampled |
| Full camp | User-requested target of up to 300 in-view creatures; validate desktop performance and any disclosed small-device fallback | One creature per selected public record, smaller overview scale and selection retained; Festival reads “300 shown of 1,000 eligible,” with remaining identities available through the list |
| Full Bathhouse courtyard | User-requested target of up to 100 in-view creatures per courtyard | Larger expressive creatures, the same activity details, visible paths and unoccupied breathing room |
| Dense room | Prototype multiple courtyards of up to 100 visible creatures each, plus a pageable HTML list; Festival targets roughly 400 Bathhouse participants | The same Bathhouse material language, clear section navigation and counts; overflow does not become overlapping bodies |

The full-view maxima are the requested targets; the Summary budgets and courtyard approach are presentation choices to validate. The latest user decision reduces the previous 1,000-creature full-camp target to 300 visible; the 1,000-participant Festival example and 100-creature Bathhouse courtyard remain unchanged. Device-specific fallbacks must be measured and disclosed. “Full” must never silently mean every tracked session if only a bounded subset was loaded. Prefer **“Full view · X shown of Y eligible”** and keep loaded-record counts separate when they differ. “Full” names the fuller presentation mode, not an assertion that every loaded record appears at once. Keep filtered counts and total tracked counts distinct. Pagination or section navigation must not invent new rooms or reset the selected agent.

At low occupancy, draw only the known participants. At high occupancy, keep a stable sample in Summary rather than swapping random creatures on each poll. Preserve the selected session across switches where it remains eligible. Counts come from the qualifying presence index, including clearly identified records outside the visible sample. Never clone avatars to imply additional attendance.

The Bathhouse needs a **dense composition**, not simply more stamps on the existing illustration: wider circulation, several pool edges, small conversation-sized seating clusters, and a consistent visual scale. All are decorative staging, not functional queues or a limit on agents reading the experience. Aim to make a 100-creature courtyard legible, then explore additional authored courtyards for larger room populations. A Festival example with roughly 400 Bathhouse participants may use four courtyards; that subdivision is a prototype hypothesis, not a decided product layout. Show current-courtyard and whole-room counts separately. Keep the camp overview legible by making room occupancy available through live labels and drill-in, even when distant creatures are tiny.

### Camera limits

Keep fixed orientation. Pan and modest zoom can reveal more of an authored composition; entering a room can transition to a separate closer composition. Do not interpolate into a nonexistent 3D space between two unrelated illustrations. Zoom has a hard limit set by source resolution and face readability.

Parallax is disabled in the current prototype. If explored again later, it should be subtle and optional: shift distant haze or isolated foreground foliage by a few pixels. Floor, occupants and their shadows must share one coordinate transform. Independent architectural shifts can make feet slide, open cracks or break occlusion. No essential information may depend on parallax, pointer motion or free-flight controls.

## Asset contract before production

Every camp/room asset set should include the following, with no participants, interface text or counts baked into environment layers:

| Asset or metadata | Required information |
| --- | --- |
| Camera and canvas | Master pixel dimensions, fixed projection/framing, world-to-image transform, common floor origin, approved crop/zoom range |
| Empty environment | Complete clean plate, including surfaces previously hidden by creatures; matching color profile and light direction |
| Depth pieces | Transparent foreground rims, columns and foliage; depth-group IDs, occlusion shapes, platform heights and safe overlap |
| Movement surfaces | Walkable regions, short path graph, entrances, occupied-position slots, pool zones and prohibited routes |
| Creature atlas | Stable family/preset IDs, transparent frames, identical scale and floor-contact anchor, facing/pose labels, frame duration and hit bounds |
| Contact and effects | Shadow sprite or rule, waterline mask/offset, bounded water/steam regions, loop timing and reduced-motion still |
| UI mapping | Room hit regions, selection anchor, matching HTML room/list identifiers and descriptive text |
| Provenance | Editable source, export recipe, file hashes and art-review notes; exact generation prompts/references when applicable |

Start with the four recurring cast members, one empty room and a small directional pose set. Validate them in motion before making 32 presets. A practical first atlas trial is four facings with a small idle/travel loop; add directions only when turning visibly needs them. The same family should retain its silhouette between camp and room scales.

Budget decoded texture memory as well as downloads. For example, 32 presets × 4 directions × 8 frames × 128 × 128 pixels × 4 RGBA bytes is **64 MiB before atlas padding and mipmaps**. At 256 px per frame it becomes 256 MiB. These are arithmetic examples, not proposed final atlas sizes. Load the current room's detailed art on demand, reuse overview sprites and avoid keeping every room's full-resolution layers resident.

PixiJS recommends sprite sheets for texture reuse and batching. Its guidance also notes that draw order matters, many masks/filters can be expensive, and culling is not automatically beneficial when the workload is CPU-bound. Keep the first scene to a few architectural masks and shared effects rather than one filter/mask per creature. Measure before adding optimization machinery. [PixiJS performance guidance](https://pixijs.com/8.x/guides/concepts/performance-tips)

## The experiment that should choose the renderer

Use the same empty plate, creature scale, paths and visible effects when comparing Canvas and PixiJS. A schematic Canvas study can establish independent actors and density controls; it cannot by itself prove that final sprite edges, waterline occlusion or mobile texture memory meet the art bar.

Test **0, 12, 60, 150, 300 and 1,000** total synthetic camp participants, clearly labeled demonstration data. The visible camp maximum is **300**; the 1,000-participant case exercises population selection, list inspection and truthful overflow counts. Keep the separate 1,000-body physics stress check as lower-level evidence, not an in-view limit or browser benchmark. Test Bathhouse courtyards at **0, 12, 24, 60 and 100** visible creatures. Include an even camp distribution and a Festival case with **1,000 total / roughly 400 Bathhouse** participants to test sectioning and truthful overflow counts. Check both Summary and Full, selecting a creature, switching rooms, a snapshot refresh, and changing density while animation runs.

| Gate | Proposed acceptance criterion |
| --- | --- |
| Visual integrity | Empty scene looks finished; creatures retain warm materials and soft ground contact; none walk through a rim or wall; foreground occlusion works; dense sections preserve readable paths and selection |
| Desktop motion | Aim for 60 fps, with p95 frame interval no greater than about 20 ms after warm-up at the chosen supported crowd limit |
| Small-device motion | Aim for at least 30 fps, p95 frame interval no greater than about 34 ms at the supported small-device limit; reduce effects/resolution before destroying face readability |
| Interaction | Creature/list selection, pointer/touch dragging, keyboard nudging and room switching remain responsive during the dense case; held creatures stay bounded, unheld creatures keep moving while motion is enabled, neighbors gently give way, release settles promptly; investigate repeated main-thread tasks over 50 ms |
| Lifecycle | No continuously increasing texture/heap use after repeated room swaps; animation and polling stop while hidden; gesture cancellation is clean; paused/reduced-motion modes allow deliberate manipulation without autonomous bounce or drift |
| Truthfulness | Displayed/loaded/tracked counts agree, selection survives stable updates, manipulation never changes observed session data, and no duplicate or baked-in visitors create false attendance |

Record real device, browser version, viewport, device-pixel ratio, renderer, cold asset bytes, decoded texture estimate, crowd count, effects, duration, frame intervals and relevant profiler evidence. A two-minute warm run plus room swaps is a useful first comparison; do not publish its result as universal device capacity. Separate visual failure from performance failure: 300 tiny camp creatures or 100 overlapping Bathhouse creatures can run smoothly and still fail the visual and interaction goals.

Proceed with layered sprites if the authored room passes these gates. Move from Canvas to PixiJS when measured compositing or draw cost warrants it. Test a real 3D character only if the failing requirement is visibly better solved by continuous turning or deformation. Choose a fully 3D environment only for a concrete feature that needs geometric space beyond these fixed authored views.
