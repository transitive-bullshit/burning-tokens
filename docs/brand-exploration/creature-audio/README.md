# Little sounds. Strange company.

**Sound audition study · 15 September 2026.** [Voice families & putting-down sounds](./families/) · [Latest batch](./?collection=new) · [Creature voices](./?collection=new&kind=voice) · [Room effects](./?collection=new&kind=room-effect) · [Return to Moonclay](../living-world/dynamics/?room=bathhouse)

A separate listening room for creature voices and the small sounds that make the camp feel alive. The completed family review leaves 149 active sounds for the [interactive prototype](../living-world/dynamics/?room=hearth), with stable voice families and varied reactions. All 169 historical favorites remain available for restoration. Background music remains for a later pass.

## Latest audition and integration

The latest completed expansion added **260 candidates**: **80 voices** and **180 room effects**, ten times the preceding 26-clip batch. They are distinct source takes rather than pitch variants. New entries are interleaved across voices, physical materials and stranger effects, with source attribution and processing details on every card.

The voice search follows the latest favorites: gentle laughs, wonder, sleepy expressions, trills and babble. It includes human-adjacent performances and a small kitten/purr group as deliberate alternatives to generic alien effects. Room sounds range from water, cups, paper and fabric to bells, singing glass, resonant wood and electrical signals. Most are one-shots; 12 room textures are bounded audition excerpts, not finished loops. No new music beds were added.

| Room | Matching new effects | Examples |
| --- | --: | --- |
| Bathhouse | 16 | Bubbles, splashes, water drops and pours |
| Dream Garden | 50 | Chimes, glass, kalimba, plucks and magic gestures |
| Quiet House | 27 | Soft footfalls, fabric, pages and small material movements |
| The Source | 48 | Switches, glass rewards, energy and electrical details |
| Open Studio | 50 | Paper, pencil, wood, tools and prop handling |
| Hearth | 41 | Fire, cups, bottles, kettle water and soft steps |
| Temple | 39 | Bells, bowls, resonant wood and constellation signals |
| Camp & creature handling | 58 | Padded steps, landing bumps and tactile interaction sounds |

Room tags overlap: this table describes **180 unique effects**, not the sum of its rows. Research and acquisition details are recorded in [the voice search](large-voices.md), [physical room sounds](large-foley.md), and [stranger room sounds](large-strange.md).

## Completed feedback

The full audition library contains **348 clips**. Round four recorded **169 starred favorites**, **175 hidden clips**, and **4 unstarred, visible clips**. The completed family review is now saved in `reviewed-2026-09-15-family-pass.json`: it excludes 20 additional selected clips through 12 individual dislikes and seven rejected families containing eight clips. This leaves **149 active selected sounds: 82 voices across 22 families and 67 effects** (15 putting-down sounds and 52 other effects). Across the full library, 195 clips are hidden and 153 remain visible. All 169 historical stars, notes, stable IDs and source files are preserved. The earlier round-four snapshot remains as history. The previous batch contributed 16 favorites, including all nine Hawkeye recordings, three Furble calls, three IndieSFX clips and the original giggle.

Preserve every starred clip's file, stable ID, star and note. Inspect current browser feedback before future cleanup. Saved snapshots seed only missing favorite/note records. The completed family pass applies its exclusions once per revision in both listening pages and the prototype, then preserves subsequent local restores and dislikes instead of reapplying them on reload. Existing local star and note changes remain authoritative. Star and note changes synchronize across listening tabs on the same origin.

**Latest batch** keeps the 260-clip expansion available through its existing `?collection=new` URL, with 119 visible under the completed family-pass defaults; later local restores and dislikes can change this count. All 348 cards are marked **Previously reviewed**. The optional prototype catalog adds a **Voice family** filter and reaction/target labels to approved sounds; family selection switches to creature voices and clears the room filter. Missing classification data does not block ordinary listening or feedback. **Favorites**, **All sounds**, **Mischief & babble** and the source selector remain available.

## Listening and hiding

Filter by **sound type**, **room**, **source**, or search words such as “giggle,” “water,” “ceramic” and “chime.” Filters combine, and their state is reflected in the URL. Selecting a room selects room effects; switching to creature voices clears the room. Source options show the number of matching sounds.

The page initially shows **40 matches**, with **Show 40 more** and **Show all** controls. Audio loads only when played. Pagination does not limit favorites, feedback exports or hidden-item records.

Play one clip at a time, adjust common volume, scrub or replay, and use **Stop** to end playback. Nothing autoplays. Notes and preferences stay in the browser. **Copy listening notes** exports readable feedback; **Download feedback** saves the complete review as JSON, including stars, notes and hidden items.

Use **Hide** on a sound, or **Hide source** to hide all clips with that source URL, including future additions. Playback stops when a clip becomes hidden. These are reversible preferences: **Undo** reverses the last action, and **Hidden** offers restore controls. Restoring a source preserves separate clip-level hides. Stars and notes survive hiding and are included in exported feedback. Each card exposes `data-feedback-hidden` independently of filtering and pagination so DOM-based feedback capture does not mistake an off-page card for a rejection.

## Family review

The separate [sound family table](./families/) retains the **169 previously selected sounds** in **29 voice families**, physical **Putting down** effects, and other room effect groups. Its current default selection contains **149 active sounds across 22 active voice families**, with rejected takes and families available in Hidden. Families open individually, with a compact play / like / dislike row for every take. Family context stays at group level. The user-approved merged palettes are Tiny + Puff, Little voice 07 + 08, and Cat + Kitten + Fiji + Osk, plus three broader laugh palettes—Bright (six takes), Snicker (five) and Warm (four). Murmur · gentle wonder combines Furry, Ato, Content and Quiet into four takes; Emi & Bird · bright calls combines Emi’s two calls with Bird’s trill. All individual takes remain available. **Hear this family** auditions its visible takes in order; the landing comparator plays one same-family voice reaction alongside a separate physical contact sound. It explicitly labels a same-family fallback when no dedicated set-down reaction exists.

**Dislike family** excludes a whole voice palette. **Dislike** on one take uses the original listening room’s hidden-clip preference. Both immediately affect the prototype on the same browser origin; cross-tab changes synchronize. **Like** records positive feedback in the existing review record. Hiding never removes stars or notes. **Hidden**, **Restore**, and **Undo** reverse exclusions; restoring a family or source retains individual clip dislikes. After the family-pass revision has been applied, an empty saved hide list is an explicit restore choice and is not replaced on reload. The download includes all earlier review records plus family exclusions. When former families are merged, old family rejections become hides for their original clips only, preserving feedback without rejecting new siblings. Future whole-family dislikes apply to the combined palette.

The reusable `review-preferences.js` module owns merged clip, source and family exclusions. Family exclusions use `burning-tokens-sound-families-hidden-v1`; individual and source exclusions retain the original hidden-storage key. The standalone `check-review-preferences.mjs` check covers clip/source/family overlap, cross-tab merge behavior, snapshot seeding, storage failure recovery and preservation of stars and notes. Browser checks covered individual playback, idempotent likes, clip/family dislike, reload persistence, family restoration retaining clip hides, synchronization with the original review, physical-effect undo and paired voice/landing playback. Temporary test dislikes were restored.

The new page is served directly from `families/index.html` with `review.js` and `review.css`; no audio files are duplicated.

## Selection and source boundaries

Prioritize isolated vocalizations with no music, unrelated effects, background noise or spoken watermarks. User listening feedback takes precedence over model-generated descriptions. Source metadata, cut boundaries and local signal checks guide candidate selection; they do not certify perceptual quality or prove that every voice is free of background noise. Do not remove a watermark to make a clip usable.

The new batch uses creator recordings, downloadable game-audio packs and individually recorded instruments. Source licenses and dataset compilation attribution are retained in [clips.json](clips.json) and the three search notes. Earlier professional demo excerpts remain local audition references; those libraries have not been purchased. The earlier original synthesis experiment is explicitly labeled and retains its prompt and model provenance. This expansion did not synthesize new voices or send audio to an external analysis service.

All clips from **Cute Baby Croc / Alien baby** (`qWhOr2ItfiY`), **Baby Croc & Alligator** (`_2g7A60JtNI`) and the watermarked Motion Array sources remain removed. Rejected clips remain hidden and recoverable. Earlier investigations are retained in [the character expansion](character-expansion-2026-09-15.md), [the first expansion](expansion-2026-09-15.md), [library research](character-libraries.md), [creator research](creators-v2.md), [synthesis findings](original-voices.md), [Minion-like sources](minionish-sources.md), [Fun Monsters cuts](fun-monsters-cuts.md), and [additional video cuts](new-video-cuts.md).

## Audio files and rebuilding

The served artifact uses `index.html`, `review.css`, `review.js`, `clips.json`, the current review snapshot and `clips/*.mp3`, plus shared brand assets. Full source recordings and preparation scripts stay in ignored `work/creature-audio/`.

New exports retain original pitch and speed, with peak matching around −6 dBFS before mono MP3 encoding and short entrance/exit fades. Per-file duration, gain, fades, byte count and SHA-256 are recorded. Very brief clicks retain their original lengths; room textures run up to ten seconds. Decoding, metadata, preservation of earlier files and browser playback/filter behavior are checked when integrating a batch.

```sh
python3 docs/brand-exploration/creature-audio/build-clips.py --source SOURCE_ID
```

The exporter skips existing files recorded as favorites in the fourth review snapshot. `--fetch` uses recorded direct/ZIP URLs or `yt-dlp` for YouTube. Dataset sources can refresh expiring download URLs through their recorded row endpoint after validating the original file path. Other temporary creator links may require retrieving the original from the recorded download page. Preserve attribution and acquisition metadata when doing so. `ffmpeg` is required. The exporter does not publish or license anything.
