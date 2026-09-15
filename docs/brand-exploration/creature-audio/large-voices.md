# A wider voice audition · 15 September 2026

This pass follows the user's latest feedback: all nine Hawkeye performances were kept, alongside several soft character-library excerpts. The new candidates broaden the performed range: short laughs, wonder reactions, sleepy expressions, trills, tiny babbles, and a small kitten/purr comparison set. There are **80 distinct original recordings**, with no pitch-variant duplicates or demo soundtracks added.

| Direction           | New auditions |
| ------------------- | ------------: |
| Little laughs       |            30 |
| Wonder and surprise |            15 |
| Soft and sleepy     |            12 |
| Trills and oddlings |            12 |
| Tiny babble         |             5 |
| Kitten and purr     |             6 |

## Source and attribution

The recordings come from the publicly released **raw** source pool of [NC AI's Designed Vocalizations Dataset](https://huggingface.co/datasets/NCSOFT/Designed-Vocalizations-Dataset). Its [authors' project page](https://ncai-official.github.io/speech/publications/designed-vocalizations-dataset/) distinguishes those recordings from the effect-processed variants; this batch uses only raw sources. The dataset carries each original Freesound title, URL, license, tags, and uploader when available. Its compilation and annotations are CC BY 4.0; retain the Lee et al., Interspeech 2026 citation as well as the applicable original sound attribution.

The batch contains **28 CC0, 27 CC BY 3.0, and 25 CC BY 4.0 original recordings**. All 28 CC0 entries have an empty uploader field in the dataset. They are explicitly labeled **“Creator unlisted in dataset”**, with original sound title, ID, source URL, and CC0 license retained. No creator is invented and no missing attribution-required creator is promoted. The other 52 recordings name their creators.

Useful primary creator references include:

- [Lemonjolly's Character Voice pack](https://freesound.org/people/lemonjolly/packs/16860/) describes the performed cute voice collection and requests the credit “Lemonjolly.” This pass includes separate laughs and surprise reactions, including [happy squeals](https://freesound.org/people/lemonjolly/sounds/275341/) and [giggles](https://freesound.org/people/lemonjolly/sounds/275340/). These are a deliberately more human-adjacent audition direction.
- [Holadios's short giggle](https://freesound.org/people/holadios/sounds/204497/) is an individual voice recording under CC BY 3.0. Both that recording and the performer's separately published longer giggle are included.
- Hawkeye_Sprout contributes four previously unused mild expressions: three brief sighs and a playful tongue reaction. All nine previously starred recordings stay unchanged.
- Xpoki contributes four separate performed trills; NoiseCollector contributes five separate short babbling recordings. Their per-record source metadata and licenses are retained in the additions file.

## Preparation and local checks

Prepared files are in `work/creature-audio/large-voices/clips/`, with integration metadata in `work/creature-audio/large-voices/additions.json`. The final exports total **1,317,568 bytes**. Each clip is **0.280–2.466 seconds**, mono 48 kHz / 128 kbps MP3, at its supplied pitch and speed. Exports use a −6 dBFS peak target before encoding, 8 ms entrance fades, and short exit fades. Dataset excerpts can already omit silence from the original recording, so source timings refer to the dataset excerpt.

All 80 original WAV hashes and all 80 output MP3 hashes are distinct. Every output decoded to finite, non-silent samples. Output duration, decoded peak level, size, and SHA-256 are recorded individually; `local-checks.json` also records RMS levels. No existing clip or feedback record was edited by this pass.

Selection uses original creator labels/tags and the user's previous preference direction. These remain **auditions for human judgment**. Local waveform checks do not establish aesthetic fit or certify the absence of every background sound. No third-party audio was uploaded to an analysis service, and no external audio-analysis job was submitted.

## Reproduction

`prepare-voices.py` stages the chosen source recordings; `export-voices.py` makes the MP3s and additions metadata. `selected-sources.json` preserves the source rows. Each `sourceAudio` entry records its ignored local WAV path, original dataset path, acquisition URL, row index, and public metadata `refreshUrl`. The acquired audio URLs are signed public cache links and can expire; fetch the recorded metadata endpoint for a fresh audio URL when re-acquiring a source. The stable dataset and original creator URLs remain available alongside them.
