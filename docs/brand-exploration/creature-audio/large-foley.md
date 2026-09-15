# Physical room effects — wide audition, 15 September 2026

Prepared **90 distinct auditions from 16 sources** for the Bathhouse, Hearth, Open Studio, Quiet House and camp. This is a selection pool for human listening feedback, not an approved production sound palette. The batch contains **83 one-shots and 7 texture excerpts**; no music. Room assignments overlap when an action plausibly belongs in more than one space.

The approach favors individual recorded game sounds over mixed demonstration videos: water bubbles and splashes, dish and glass contacts, kettle simmer, cup stirring, pencil and paper, fabric, small containers, soft landings and footfalls. A few original takes of the same gesture provide comparisons for weight and texture. These are separate source recordings, not pitch-shifted copies. One exact duplicate carpet footstep in the source pack was detected and excluded.

## Sources and audition coverage

| Source | Creator | License | Auditions | Intended use |
| --- | --- | --- | --: | --- |
| [Impact Sounds](https://kenney.nl/assets/impact-sounds) | Kenney | CC0 | 27 | Carpet, grass and wood steps; glass, dish, timber and tin contacts; cushioned landings |
| [RPG Audio](https://kenney.nl/assets/rpg-audio) | Kenney | CC0 | 18 | Journal handling, cloth folds, soft pouches and kettle contacts |
| [Bubble Sound Effects](https://opengameart.org/content/bubble-sound-effects) | Brian MacIntosh / BMacZero | CC0 | 5 | Three isolated bubbles and two short bubbling textures |
| [6 Short water splashes](https://opengameart.org/content/6-short-water-splashes) | ezwa; excerpts by qubodup | CC0 | 6 | Small pool entry and paddling gestures |
| [Water splashes](https://opengameart.org/content/water-splashes) | Michel Baradari | CC BY 3.0 | 2 | Broader pool splashes |
| [Water Waves](https://opengameart.org/content/water-waves) | transitking; excerpts by qubodup | CC0 | 2 | Short washes over a pool ledge |
| [Dripping water loop](https://opengameart.org/content/dripping-water-loop) | Independent.nu; hosted by qubodup | CC0 | 1 | Resonant falling-drop texture; source is a basement recording |
| [boiling water loops](https://opengameart.org/content/boiling-water-loops) | TinyWorlds | CC0 | 2 | Covered and open simmering pots at the Hearth |
| [Pencil Sounds](https://opengameart.org/content/pencil-sounds) | AntumDeluge; original recordings by NachtmahrTV and damsur | CC0 | 2 | Writing and erasing in the Studio |
| [10 Book Page Flips](https://opengameart.org/content/10-book-page-flips) | StarNinjas | CC0 | 5 | Paper turns with a different texture from the journal pack |
| [Item Handling](https://opengameart.org/content/item-handling) | Iwan “qubodup” Gabovitch | CC BY 3.0 | 3 | Small tools or props changing position |
| [Liquid Bottle Drink Set](https://opengameart.org/content/liquid-bottle-drink-set) | qubodup | CC0 | 7 | Opening, closing and moving liquid inside tea or pigment bottles |
| [Fire Crackling](https://opengameart.org/content/fire-crackling) | AntumDeluge | CC0 | 1 | A close crackle cluster |
| [Fireplace Sound loop](https://opengameart.org/content/fireplace-sound-loop) | PagDev | CC0 | 1 | A quieter fire texture |
| [Scorchers Foley Sounds](https://opengameart.org/content/scorchers-foley-sounds) | scorcher24 | CC0 | 5 | Paper movement, shaking cups and stirring |
| [Fabric Rustling](https://opengameart.org/content/fabric-rustling) | Iochi Glaucus | CC0 | 3 | Isolated leg-warmer rustles for blanket and cushion movements |

Preserve the attribution for Michel Baradari and the Item Handling recordings. The latter archive's `notes.txt` and the creator's page both specify CC BY 3.0. The source page is authoritative; the fact that it appears in a broad collection of free sounds does not change its license.

## Preparation and limits

The fragment is staged at `work/creature-audio/large-foley/additions.json`, with MP3 files in its `clips/` directory and the local exporter in `prepare.py`. Each clip records its exact direct download or archive URL, archive member where relevant, retained source path, crop times, source checksum, output checksum, duration, fades and gain. The staging exporter does not modify the shared listening manifest or existing clips.

All source files were decoded locally. One-shots have outer near-silence trimmed with short padding. Fixed excerpts are used for the longer fabric, fire and dripping recordings. Original pitch and speed are retained, peaks are matched to −6 dBFS before encoding, and short entrance/exit fades avoid abrupt cuts. Exports are mono 48 kHz / 128 kbps MP3, totaling 1,771,512 bytes. Decoded durations range from 0.115 to 8.4 seconds. Very short footfalls are intentionally brief; the seven longer textures are labeled separately and are not presented as finished seamless loops.

Room coverage: 16 Bathhouse, 41 Hearth, 50 Open Studio, 27 Quiet House and 23 camp assignments. These counts overlap. Source labels and waveform checks establish provenance, event boundaries and playable files; they do not substitute for the user's judgment of warmth, detail or fit. No third-party audio was uploaded to an external analysis service. All 90 output hashes are unique and their decodes contain finite, nonzero audio.
