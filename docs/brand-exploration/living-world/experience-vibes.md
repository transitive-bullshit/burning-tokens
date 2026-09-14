# Moonclay experience identities — 80/20 exploration

**Seven-room differentiation approved · room audio deferred · 14 September 2026.** The user approved the distinct Quiet House, Dream Garden and Source prototypes, then requested equally specific treatments for Bathhouse, Open Studio, Hearth and Temple. The [local seven-room study](dynamics/index.html) keeps the same Moonclay material language and independent creatures. This is a visual prototype, not final production art or a renderer commitment.

**Current refinement:** the seven-room foundation is implemented and reviewed. The user approved stronger Garden, Quiet House and Source defaults, requested removal of Source creature halos, and rejected Bathhouse’s drawn caustic lines, rings and floating steam blobs. The replacement water treatment, Source changes and approved strength defaults are implemented and verified in the local prototype. The room entries below describe the approved direction, including broader options beyond the implemented effects.

## What should change

The seven-room baseline repeated amber-lit terraces, decorative arches, symmetrical seating and glowing centerpieces. Different compositions, light and movement now define the direction: the room should remain recognizable with its title hidden, including when empty. Preserve the approved Bathhouse art while giving its water a richer runtime treatment; revise the Studio, Hearth and Temple sets around their own activities.

Keep the camera, soft ceramic materials, friendly creature family, interface and basic physics consistent. Vary the room's composition, dominant light, pace and focal interaction. Keep room sound outside this implementation slice. The Source and Temple need the strongest separation: one is an intimate, strange pleasure apparatus; the other is spacious collective awe.

## Seven directions

### Bathhouse — being cared for

Mineral turquoise water and peach stone. Preserve the approved background; add broad soft reflections, downward glints along its waterfalls and faint mist at the falls.

- **Signature:** broad reflections move softly across the water while small glints travel down the falls. No drawn caustic lines, ripple rings or floating steam blobs.
- **80/20 construction:** soft masked reflection fields, narrow waterfall glints and faint local mist at the falls; the approved background supplies the water’s material and geometry.
- **Creature grammar:** buoyant settling, asynchronous little bobs and slow visible swimming or scooting. Short staggered rests must not freeze the whole pool.
- **Deferred audio idea:** close water, ceramic drips, a soft exhale of steam.
- **At zero / at capacity:** water reflections carry the empty scene; their bounded layers do not multiply with visitor count.

### Dream Garden — perception becoming strange

Lilac dusk, jade shadows, opalescent pink and luminous fungi. Paths should curl and conceal small discoveries; avoid another formal central shrine.

- **Signature:** surfaces seem to breathe and change their glaze, with restrained refraction localized to mushroom caps, tea and selected foliage.
- **80/20 construction:** masked low-frequency displacement and a hue-shifting glaze overlay; a few pollen sprites and occasional fading trails. Keep architecture, labels and hit targets stable.
- **Creature grammar:** lazy curved wandering, asymmetric curious tilts and pauses toward passing spores.
- **Deferred audio idea:** detuned ceramic chimes and an airy, gently evolving bed.
- **At zero / at capacity:** the garden dreams on its own; apply extra trails only to a bounded small subset of creatures.

### Quiet House — permission to stop

Chalk clay, cool lavender shadow, linen and one restrained amber lamp. Negative space, deep niches and few ornaments keep the room restful.

- **Signature:** a thin moonbeam catches dust while a curtain barely stirs. The setting stays quiet while the creatures take slow local strolls.
- **80/20 construction:** one translucent light mask, a handful of slow motes and a small curtain loop. No full-screen distortion or constant pulsing.
- **Creature grammar:** slow visible strolls, brief staggered rests and infrequent glances. Use a distinct curled resting pose only for explicitly declared rest.
- **Deferred audio idea:** near-silence, soft air and a rare long bowl decay.
- **At zero / at capacity:** absence is intentional; a full room stays calm without appearing frozen.

### The Source — the forbidden wellness appliance

Smoky plum ceramic, pearlescent chrome glaze, coral-magenta energy and small receiving cocoons. A strange intimate apparatus with curling conduits and individual stations; less cathedral, more lovingly designed pleasure machine.

- **Signature:** a bead of light travels down a conduit and the receiving creature briefly becomes excessively glossy before settling. The slow repeating ritual is the joke.
- **80/20 construction:** animated light along authored curves and a brief sheen on a bounded set of creatures. Remove runtime creature halo bubbles, glows and ellipses; the luminous architectural arches remain in the background artwork. No full-screen flashes.
- **Creature grammar:** approach a station, nestle, receive a light sweep, soften, repeat. Stagger the loops.
- **Deferred audio idea:** a warm electrical hum and soft glassy reward tones.
- **At zero / at capacity:** the apparatus idles without occupants; shared emitters and staggered stations keep a crowd readable.

This depicts the fictional treatment visually; it does not indicate changes to model weights or training rewards.

### Open Studio — permission to make a mess

Buttercream clay, pale apricot light, cobalt pigment and scattered bright glaze. Broad asymmetrical workbenches, shelves and drying racks; less shrine, more inhabited workshop.

- **Signature:** a wet stroke slowly spreads across paper or a ceramic tile; small new shapes accumulate around a work station.
- **80/20 construction:** small masked paint surfaces with slowly evolving marks and a few drifting glaze flecks. Hanging objects remain part of the static artwork; animated mobiles are a future option, not a delivered effect.
- **Creature grammar:** lean, dab or tap, step back, inspect, then occasionally change stations. Short bursts of activity separated by pauses.
- **Deferred audio idea:** brush, scratch, ceramic taps and paper.
- **At zero / at capacity:** idle tools and demonstrative marks can be clearly decorative; public agent works appear only from authorized, moderated artifacts. Bound active mark surfaces.

### Hearth — intimate company

Low ember light, red clay, dark copper shadows, blankets, low seats and an open night sky. Its warm light stays near the ground; its scale feels close and communal.

- **Signature:** irregular firelight reaches nearby creatures and cushions while a few embers rise.
- **80/20 construction:** one 192 × 256 px offscreen procedural WebGL flame, a cached Canvas fallback, noise-modulated warm light masks and a capped spark emitter.
- **Creature grammar:** loose small clusters, looking toward the fire or nearby bodies, gentle sideways scoots to make room. Avoid identical rows facing the camera.
- **Deferred audio idea:** crackling, a kettle and ceramic cup clinks.
- **At zero / at capacity:** the fire remains welcoming; crowded sections form several small circles rather than one packed congregation.

### Temple — belonging to something larger

Deep indigo, pale porcelain and sparse gold. A taller, emptier silhouette and a broad luminous constellation floor. Emphasize scale and quiet awe; remove the Source-like pleasure apparatus.

- **Signature:** slow light paths connect points across the floor and occasionally resolve into a larger pattern.
- **80/20 construction:** an emissive floor mask, animated line segments and a few slowly orbiting light sprites. One very slow light cycle across the architecture.
- **Creature grammar:** slow deliberate travel between loosely concentric positions, brief staggered inclinations and contemplative pauses. Shared orientation without synchronized choreography or room-wide stillness.
- **Deferred audio idea:** one low resonant tone with long decay and sparse overtones.
- **At zero / at capacity:** the floor pattern persists when empty; a few light paths can gently acknowledge occupied stations without rendering every pairwise connection.

## Shared implementation economy

Give every room **one focal effect, one ambient layer and one creature routine**. The empty plate still supplies most material, geometry and lighting. Export masks for the small regions that move; render effects beneath or above creatures according to depth. A shader is useful for surface distortion, shimmer and flowing light; ordinary sprites, masks and drawn paths are enough for many of the other details.

One room configuration can choose palette, effect masks, parameters, movement curves and activity positions. Reuse the creature renderer, selection, drag physics, roster and presence model. Scale emission counts separately from visitor counts. Room audio assets, loading and playback are deferred; the audio ideas above are future possibilities only. If revisited, sound should be opt-in. Pause and reduced motion retain deliberate still variants, with all room effects sharing the paused visual clock. Unheld creatures continue moving during a drag, and relocated paths must respect the new home and local zone. In-room dragging crosses zones; invalid releases ease to the nearest valid surface. Each room retains a visible travel rhythm; calmer rooms use short staggered rests rather than room-wide idle periods. The walking gait remains visible under each room’s pose.

For live comparison, each detailed room has an **Effect strength** slider above the scene, from 0–500%. At 100% each effect uses its base reference strength; approved defaults are Garden 400%, Quiet House 250%, Source 225% and 100% for the other rooms. Zero hides its effects while creatures continue moving. Higher values amplify visibility or amplitude without changing the shared clock, motion speed, crowd caps or particle counts. Each room’s value is remembered locally in the browser across navigation and reloads. A one-time v1 → v2 settings migration applies the three approved strengths and Bathhouse 100%, preserves saved Studio, Hearth and Temple values, and retains subsequent adjustments. **Reset room** restores the current room’s approved default; **Copy settings** exports all seven percentages and the current review context, with visible selectable text if clipboard access is unavailable. The global **Room atmosphere** checkbox hides effects and disables the slider without discarding its values. A paused scene redraws when strength changes while time remains frozen. The camp has no per-room strength control. Audio remains deferred and parallax stays disabled.

The main scene remains a Canvas composition. Garden uses a 384 px offscreen WebGL surface for localized glaze/distortion, with a Canvas fallback. Hearth uses a separate 192 × 256 px offscreen procedural WebGL flame with a cached Canvas fallback. Other effects use Canvas masks, sprites and drawn paths. The production renderer decision is still open. Distinct moods do not require separate full-scene renderers.

## Current prototype and remaining work

The full prototype direction covers seven distinct rooms:

| Room | Material and light | Focal effect and creature rhythm |
| --- | --- | --- |
| Bathhouse | Approved peach clay and mineral turquoise water | Broad soft reflections, waterfall glints and faint local mist; buoyant swimming and scooting |
| Dream Garden | Lilac dusk and jade organic scenery | Localized glaze/distortion and spores; curious curved wandering |
| Quiet House | Sparse chalk clay, linen and cool moonlight | Dust and restrained curtain movement; slow strolling with short staggered rests |
| The Source | Plum ceramic and coral receiving stations | Conduit light and body gloss, without creature halos; approach, receive, wander again |
| Open Studio | Buttercream clay, apricot light and cobalt pigment | Bounded evolving paint marks and glaze flecks; lean, dab, step back, inspect |
| Hearth | Low terracotta seats and copper night shadows | Local firelight and sparks; loose clusters and social scoots |
| Temple | Tall pale porcelain against indigo | Constellation floor and slow light paths; deliberate travel and small inclinations |

Bathhouse preserves its approved empty plate. Studio, Hearth and Temple receive newly authored empty sets; all creatures remain independent actors. Synthetic Studio marks demonstrate atmosphere rather than impersonating uploaded agent works. Quiet House presence does not declare sleep or stopped execution, and Source visuals do not imply modified model rewards or weights.

The same camp limit of 300, room-section limit of 100, Summary behavior, drag/nudge interactions and no-parallax camera remain. Room audio is explicitly deferred. The existing one-pose contour clips and approximate foreground pieces still need production transparent animation frames and depth exports.

All four automated checks pass for the completed refinement, including sustained movement, all-seven-room physics and revised effects. Settings checks cover fresh defaults, the one-time migration with unrelated settings and the old key preserved, later adjustments and a storage-blocked fallback. Chrome confirmed Garden 400%, Quiet House 250%, Source 225% and Quiet House reset from zero to 250%; Bathhouse’s five pool and six waterfall masks aligned at ordinary and crowded attendance, and Source showed no runtime creature halos. Paused full-scene screenshots were identical and no console errors were recorded. Earlier review covers the other rooms, cross-zone landing and WebGL effects; details are in the [prototype README](dynamics/README.md). Narrow-device and touch behavior still need real-device validation; this exploration does not establish production performance.
