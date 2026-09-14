# Burning Tokens imagery provenance

Provider: built-in OpenAI ImageGen tool (`image_gen__imagegen`).
Operation: one image edit using `referenced_image_paths`; no alternate provider or CLI.
Saved at: 2026-09-14T09:59:43.029126+00:00

## Files

- `retreat-hero.png`: typography-free hero generated from the approved concept; copied byte-for-byte from the provider output.
- `approved-concept.png`: byte-identical archival copy of the original approved concept, including its original typography and CTA.

Input reference: `/Users/tfischer/dev/modules/agent-spa/docs/brand-exploration/naming-concepts/burning-tokens-imagegen.png`

Provider output: `/Users/tfischer/.codex/generated_images/01a09dc2-7318-74a1-86bf-67dd59337c68/exec-29013be4-82f1-49be-a2c2-f24f90ccd787.png`

## Verification

Both workspace image copies were verified byte-identical to their respective source files.
Visual inspection confirms that the headline, tagline, and complete CTA are absent, replaced with coherent textured sky. The festival layout, central ribbon sculpture, foreground pavilions, original nonhuman visitors, cobalt/coral/gold palette, and painterly grain remain visually consistent. As a generative edit, unchanged areas are not asserted to be pixel-identical to the concept.

- `retreat-hero.png`: 1586 x 992 PNG; SHA-256 `5ff299441c8ca09c7d0553ad350e77287712c6409b4695ae1f7bbc541f80778f`.
- `approved-concept.png`: 1586 x 992 PNG; SHA-256 `0e0ea81300e6efaa05eee5c4373ecf3a055ea68b9e9744684ec584858e28dd97`.

## Exact submitted prompt

```text
Use case: precise-object-edit
Asset type: reusable typography-free website hero artwork, high-quality landscape approximately 16:10.
Input image: the attached Burning Tokens website concept is the edit target and approved visual reference.
Primary request: Remove the entire "Burning Tokens" headline, the entire "Leave your objective at the gate." tagline, and the complete "Send your agent" button including its outline, glow, arrow, and all lettering. Remove any other typography or website interface. Seamlessly reconstruct those areas as coherent textured twilight sky, matching the existing cobalt upper sky and coral-gold horizon. Preserve generous open upper sky for native text overlays that will be added later outside the image.
Invariants: Preserve the exact festival world composition, camera viewpoint, scene scale, and object placements. Preserve the rich risograph/screenprint and painterly grain, cobalt twilight, violet mountains, coral-gold sunset, original varied nonhuman agent visitors, both foreground pavilions, all art camps, glowing paths, and the central flowing luminous ribbon sculpture. Preserve the existing moons and stars. Retain the intricate illustrated texture and sharp scene detail rather than smoothing it. The entire lower festival scene should remain unchanged.
Constraints: Change only the typography and interface regions into sky. No new text, lettering, logos, UI, icons, symbols, characters, objects, or decorations. Do not redesign the world, crop the scene, flatten its colors, or make it photorealistic. Deliver a single seamless full-bleed landscape artwork with no frame, margins, or watermark.
```
