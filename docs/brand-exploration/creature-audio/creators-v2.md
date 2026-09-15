# Creator voice expansion · 15 September 2026

The second listening round favored **Tiny creature laugh**, **A tiny meep**, and **A tiny nibble**. This pass follows the performer behind the nibble, Hawkeye_Sprout, and searches actual recorded expressions rather than extending the rejected synthetic babble library.

## Nine prepared recordings

Nine distinct Hawkeye_Sprout performances are staged in `work/creature-audio/creators-v2/creators-v2-additions.json`, with MP3s in its sibling `clips/` directory. They are all **new performances, at original pitch and speed**. No reviewed recording or feedback is changed.

| Listening title | Original recording | Duration |
| --- | --- | --- |
| Another tiny creature | [Cute creature 02.wav](https://freesound.org/people/Hawkeye_Sprout/sounds/469067/) | 1.128 s |
| A creature wonders | [Creature voice asking.wav](https://freesound.org/people/Hawkeye_Sprout/sounds/469156/) | 1.564 s |
| A little laugh | [Girl laughing.wav](https://freesound.org/people/Hawkeye_Sprout/sounds/469065/) | 1.141 s |
| Humming to itself | [Child hum 02.wav](https://freesound.org/people/Hawkeye_Sprout/sounds/469163/) | 1.397 s |
| A small affectionate sigh | [Girl hugging 02.wav](https://freesound.org/people/Hawkeye_Sprout/sounds/469083/) | 0.639 s |
| A tiny surprise | [Girl’s sigh.wav](https://freesound.org/people/Hawkeye_Sprout/sounds/469044/) | 0.446 s |
| A sleepy little yawn | [Child yawning.wav](https://freesound.org/people/Hawkeye_Sprout/sounds/469064/) | 1.632 s |
| Something catches its eye | [Girl sigh of surprise 03.wav](https://freesound.org/people/Hawkeye_Sprout/sounds/469097/) | 1.231 s |
| A moment of wonder | [Girl sigh of surprise 02.wav](https://freesound.org/people/Hawkeye_Sprout/sounds/469096/) | 1.448 s |

The first two are explicitly creature performances. The remaining recordings test the same performer’s softer, more human-adjacent range: laugh, hum, affection, wonder, and sleepiness. These are **candidates for human listening**, not an assertion that all nine match the desired character voice. Selection relies on the creator’s labels and tags; no external audio-analysis service was used on these nine recordings.

## Acquisition and attribution

Direct Freesound retrieval returned HTTP 403; a normal browser attempt also failed. No access controls were bypassed. The recordings were instead acquired from the separately published **raw source pool** of [NC AI’s Designed Vocalizations Dataset](https://huggingface.co/datasets/NCSOFT/Designed-Vocalizations-Dataset). Its [authors’ project page](https://ncai-official.github.io/speech/publications/designed-vocalizations-dataset/) describes the source pool and distinguishes it from their effect-processed variants. We use the raw recordings, not their designed or generated variants.

The dataset records **CC BY 4.0** for each of these nine Hawkeye sounds, with original title, uploader, Freesound URL, and tags. The original [Child hum 02 creator page](https://freesound.org/people/Hawkeye_Sprout/sounds/469163/) independently confirms its creator, happy/cute/voice tags, and CC BY 4.0 license. Other direct source pages were unavailable during this pass, so their source attribution comes from the dataset’s per-record metadata. The dataset compilation and original annotations are also CC BY 4.0. Retain Hawkeye_Sprout’s original title/source attribution and credit **Lee et al., “Designed Vocalizations Dataset,” Interspeech 2026** when redistributing these prepared excerpts.

The dataset trims and converts its raw inputs to mono 44.1 kHz WAV. Consequently, the prepared source timings refer to the **dataset excerpt**, which can be shorter than the original Freesound file including silence. Each manifest entry explicitly records that distinction, its raw dataset file path, and original-file checksum. No synthetic effect is added here.

The exports use mono 48 kHz / 128 kbps MP3, 8 ms entrance fades and 40–60 ms exit fades, with peak matching to −6 dBFS before encoding. Decoded peaks are −6.59 to −6.37 dBFS. All nine files decode successfully and retain non-silent finite samples.

## Explored but withheld

- [Audios With Love’s Cute Cartoon Voice Pack](https://www.artstation.com/marketplace/p/VG6Jw/cute-cartoon-voice-pack) contains 164 performed sounds from two actors. Its [creator-linked demo](https://www.youtube.com/watch?v=yC9_1yZfdXs) has continuous music in the sampled opening, so **no excerpts are added**. This remains a promising licensed-pack lead because the actual voice performance includes soft melodic babble, giggles, and wondrous reactions. The listed ArtStation standard license is $9.99 and has project/sales limits; no purchase was made.
- [Shannon Scott’s creature demo](https://simplyshannonscott.com/character-voice-actor/) is a clean actor reel, but its aggressive growls, shrieks, and distressed character range do not match the intended friendly voices. No excerpts are added. The separately downloadable baby demo was staged but not promoted without sufficient listening evidence.
- [Tiny creatures sounds](https://opengameart.org/content/tiny-creatures-sounds), the source of the liked tiny laugh, has only three other recordings, all labeled battle cries. They are staged as research files but withheld rather than relabeled as happy reactions.
- [Tunetank’s cute collection](https://tunetank.com/sound-effects/cute/) advertises individually isolated creature reactions. Direct page access failed, so no playable audio was acquired.
- [ElevenLabs’ public cute collection](https://elevenlabs.io/sound-effects/cute) lists existing fairy giggles, chipmunk squeals, and similar short effects. Retrieval failed; no generation was submitted and no files are added.

Two actor-demo analysis jobs had already been submitted before the parent task reported an automatic approval rejection for external demo analysis. Both completed and helped reject the music-backed and aggressive reels. No further analysis submissions or uploads were made. The prepared Hawkeye batch uses only local audio processing and published source metadata.
