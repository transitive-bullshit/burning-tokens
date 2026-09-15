# Resonance, strange signals, and little interactions

15 September 2026 · 90 new room-effect auditions for the wider listening pass.

The collection expands the Dream Garden, Source, Temple and camp interaction palette with distinct materials and gestures. Instrument recordings are isolated strikes, plucks, sweeps or brief sustained tones used as event sound candidates. They are not songs or background music. Room assignments describe possible uses for auditioning, not implemented behavior or approved sound choices.

## What is staged

| Family | Auditions | Candidate uses | Primary source and reuse terms |
| --- | --: | --- | --- |
| Real resonant instruments | 32 | Temple points and shared patterns; Garden discoveries; Source glass resonance; pickup and landing | [Versilian Community Sample Library](https://github.com/sgossner/VCSL), CC0 |
| Atmospheric interactions | 20 | Particles, link/unlink, activation, settling, boundary nudges | [Krank / legoluft](https://opengameart.org/content/atmospheric-interaction-sound-pack), CC0 |
| Tactile and glassy controls | 20 | Receiving stations, drag/drop, arrival, expansion and contraction | [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds), CC0 |
| Small tactile controls | 4 | Pickup, release, creature and entrance highlighting | [Kenney UI Audio](https://kenney.nl/assets/ui-audio), CC0 |
| Filtered magic phrases | 7 | Local perception changes and reward pulses | [JaggedStone Magic Spell SFX](https://opengameart.org/content/magic-spell-sfx), CC0 |
| Glass bells | 4 | Soft station rewards and individual constellation points | [Hansjörg Malthaner / Varkalandar](https://opengameart.org/content/glass-bell-sounds), CC BY 3.0 |
| Individual creator effects | 3 | A bell acknowledgement, echoed reward ding and energy field | [Spring Spring bell](https://opengameart.org/content/pleasing-bell-sound-effect), [Cynic Project bell echo](https://opengameart.org/content/bell-arpeggio-24), [zeroisnotnull energy emission](https://opengameart.org/content/seamless-energy-emission-loop), CC0 |

VCSL provides the strongest material variety: Nepalese hand bells, two soft gongs, hand chimes, bell-tree strikes and sweeps, Kenyan and Tanzanian kalimbas, soft and bowed vibraphone, singing wine glasses, soft glockenspiel, individual harp strings, hanging chime sweeps, a tubular bell, soft balafon and a hollow wooden slit-drum note. These are separate source recordings, not automated pitch variants. The creator documents the collection as CC0 and describes neutral-space recording standards on the [repository page](https://github.com/sgossner/VCSL). Download URLs are pinned to commit `c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e`.

Krank's summer and space sound sets supply two different electronic interaction palettes. The industrial set is withheld. Kenney's errors, glitches and scratches are omitted; only a limited set of different interaction families is included. The seven JaggedStone effects are creator-designed filtered note sequences, not excerpts from accompanied music. [The creator explains their construction](https://opengameart.org/content/magic-spell-sfx).

## Attribution and acquisition

All 90 files were retrieved through public, direct creator/library downloads. No purchase, account registration, message, or external audio-analysis upload was used. Each manifest entry retains the original filename, source page, creator, license, source start/end times, source-file checksum and direct URL or archive member.

The four glass-bell entries select CC BY 3.0 from the creator's offered licenses. Production attribution should name **Hansjörg Malthaner**, link to [Varkalandar's profile](https://opengameart.org/users/varkalandar), and note trimming, fades and level matching. CC0 source credits remain in the catalog for traceability.

## Preparation and verification

Staging lives in `work/creature-audio/large-strange/`: `prepare.py` produces `clips/*.mp3` and `additions.json`; source originals, archives and a pinned VCSL file inventory remain alongside them. The shared listening-room manifest and all reviewed clips are left to the main integration pass.

Each export keeps original pitch and speed, trims boundary silence, applies short entrance/exit fades, and peak-matches to −6 dBFS before mono 48 kHz / 128 kbps MP3 encoding. Encoded output is decoded again to measure duration and peak, verify finite samples and record checksum and byte size. Bell/gong and bowed/glass decays have bounded audition lengths; textures are explicitly labeled as auditions rather than prepared seamless loops. The original source files retain their full decays.

Selection is based on primary creator descriptions, individual-file structure and local waveform/decode checks. These checks do not establish subjective fit, guarantee absence of every unwanted sound, or replace the user's listening decisions. The pool is deliberately broad so the user can reject most candidates without losing useful variation.
