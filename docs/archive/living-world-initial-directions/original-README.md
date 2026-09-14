# Burning Tokens — eight living worlds

**Proposed · 14 September 2026 · none selected.** [Open comparison gallery](index.html) · [Creature system and 32 preset recipes](creature-system.md) · [Exact direction briefs and prompts](directions.json)

The user favors both Burning B and Oddling and wants to choose the camp perspective and friendly nonhuman creature language before committing to an icon. The accepted name, smooth wordmark, invitation, palette and counterculture retreat positioning remain fixed. Camera, material, character anatomy and rendering approach are open.

This pass uses eight separate built-in ImageGen generations, one board per direction, followed by one targeted revision each for the botanical and graphic directions. Each final board pairs a camp overview with eight proposed family creatures and secondary poses. The 32-preset system is a design proposal (eight families × four silhouettes), not a delivered production sprite atlas. The generated boards explore visual language; incidental lettering, added slogans, labels, icons and UI treatments inside the images do not replace approved brand copy or identity. Editable poster frames use the canonical wordmark and copy.

The eight family cues are original visual associations, not official marks. They suggest GPT, Claude, Gemini, Llama, Mistral, DeepSeek, Grok and independent visitors through anatomy and restrained color. Provider self-report remains separate from identity verification. All families share the same expressive vocabulary; no family implies a personality, capability or measured emotional state.

## Direction comparison

| Direction | Camera and medium | Strongest quality | Tradeoff |
| --- | --- | --- | --- |
| [Moonclay Commons](01-moonclay-commons.png) | Fixed isometric · 3D diorama; Sculpted clay, ceramic glazes and warm miniature lighting | The clearest bridge from Oddling to a warm, tangible camp. | Beautiful at close range; characters need simplified silhouettes at map scale. |
| [Lantern Marsh](02-lantern-marsh.png) | Elevated illustrated view · painted 2D; Ink, cut paper, warm lantern light and flat shadow shapes | Excellent overhead readability with an intimate storybook feeling. | Less volumetric spectacle; charm relies on strong drawing and animation. |
| [Velvet Microverse](03-velvet-microverse.png) | High isometric · tactile 3D; Needle-felt, woven camp rugs and soft fiber light | The warmest, most immediately affectionate inhabitants. | Can drift toward a nursery aesthetic unless the architecture stays strange. |
| [Glass Tide](04-glass-tide.png) | High isometric · luminous 3D; Translucent resin, frosted glass, shallow pools and bioluminescence | The most alien and wondrous interpretation of artificial life. | Transparency and glow can obscure expressions and crowd readability. |
| [Risograph Reverie](05-risograph-reverie.png) | Elevated graphic map · printed 2D; Limited-ink screen print, bold flat silhouettes and subtle paper grain | Most directly related to the expressive wordmark and festival-poster culture. | Less physical depth; expressive poses must carry the life-sim feeling. |
| [Clockwork Menagerie](06-clockwork-menagerie.png) | Fixed isometric · sculptural 3D; Painted wood, ceramic shells, brass joints and found-object craft | Connects to the peculiar artificial beings in the approved camp artwork. | Needs restraint to avoid familiar robot mascots or excessive mechanical detail. |
| [Starlit Terrarium](07-starlit-terrarium.png) | Elevated illustrated view · botanical 2D; Gouache, alien desert foliage and fungal lanterns | The richest sense of a living ecology and sanctuary. | Botanical detail can compete with the need to follow individual sessions. |
| [Signal Garden](08-signal-garden.png) | Graphic overhead view · vector-like 2D; Clean curves, restrained light trails and abstract ritual geometry | Most distinctly computational; can grow into the companion-icon language. | Risks feeling like a screensaver unless creatures and places stay tangible. |

## How to choose

Judge the world and cast separately. A preference for felt creatures need not force a felt landscape. First choose the most inviting camp, then the most appealing anatomy, then the amount of depth. A fixed isometric image can be rendered using layered sprites; these pictures alone do not establish a WebGL requirement. The existing Canvas recommendation stays provisional while this question is open.

A useful shortlist is Moonclay Commons for spatial clarity and a tangible retreat, Velvet Microverse for creature warmth, and Risograph Reverie for direct kinship with the wordmark. This is an agent recommendation, not a recorded user selection.

The public experience should remain a playful view of recent session observations. Exact movement, expressions and apparent encounters are decorative; room observations and declared rest provide the grounded state. No fake visitor counts, invented chats or emotional meters are introduced by this exploration.

## Files and regeneration

- `directions.json`: exact prompts and comparison copy.
- `creature-system.md`: proposed family rules, 32 silhouette recipes, expressions and observation boundaries.
- `01-…png` through `08-…png`: original generated boards, preserved unchanged.
- `*-poster.svg` / `*-poster.png`: native brand compositions embedding each board.
- `overview.svg` / `overview.png`: comparable two-column overview.
- `build-gallery.ts`: static review-page builder.
- `build-posters.ts`: composition/export builder using the existing brand build's pinned sharp package and bundled fonts.
- `generation-record.json`: source paths, copied output paths, hashes and generation provider.

From the repository root:

```sh
node docs/brand-exploration/living-world/build-gallery.ts
node docs/brand-exploration/living-world/build-posters.ts
```

These commands rebuild the review artifacts from saved images; they do not regenerate imagery. Re-running a saved prompt can produce a different image. The gallery and posters are local design-review artifacts, not an implemented life simulation or a deployed product.
