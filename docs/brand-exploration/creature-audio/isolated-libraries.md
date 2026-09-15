# Isolated creature voices from open libraries

Research and candidate preparation · 15 September 2026

The brief is short, cute, curious or delighted creature vocalizations without music, environmental sound or watermarks. These files come from individually downloadable effects and creator packs, rather than edited video demos. Existing reviewed clips and stars are outside this preparation pass.

## Sources

- **[Tiny creatures sounds — fvcalderan](https://opengameart.org/content/tiny-creatures-sounds).** The creator says these are recordings of their own voice, pitched up and processed in Audacity, and offers them under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Selected the laugh. Three battle cries were acquired but not promoted; a battle-focused delivery is less aligned with this listening round.
- **[Rodent or Alien Speaking — Yo Frankie!](https://opengameart.org/content/rodent-or-alien-speaking-cute-weird-yo-frankie).** Three individual FLAC files are attributed to Blender Foundation and labeled [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Selected files 1 and 3. File 2 was excluded after the automated review described an abrupt, guttural grunt. Credit Blender Foundation / Yo Frankie!, retain the source and license links, and identify trimming, fades and level matching as modifications.
- **[Dialogue Sfx — AmbroggioMusic](https://ambroggiomusic.itch.io/dialogue-scribble-scrabble-noises-sfx).** The creator describes cute character dialogue and emotes, with 15 sounds suitable for Animal Crossing-like voices. The page permits use in projects with credit. It does not name a standard license. Three distinct candidates are retained, including a 0.235-second blip; these are intentionally shorter than most of the study. The pack is tagged as made without generative AI. Preserve credit to AmbroggioMusic.
- **[Voices Sound Effects Library — Little Robot Sound Factory](https://opengameart.org/content/voices-sound-effects-library).** The creator lists 450 isolated, premixed voice effects, including 65 small-creature and 54 funny-alien sounds. The page specifies [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) and asks for attribution to Little Robot Sound Factory, with [its website](https://www.littlerobotsoundfactory.com) linked where possible. Selection focuses on expressive noncombat reactions rather than the pack's horror, death and attack material.

These statements report the permissions on the source pages; they do not independently establish ownership of every upstream recording. The manifest keeps the exact source, license statement and modification notes with each clip.

## Preparation and reproducibility

Source recordings and downloaded archives remain in ignored `work/creature-audio/expansion-libraries/`. No full pack is copied into the served listening page. `prepare.py` writes only candidate MP3s and an `additions.json` fragment in that work directory.

- Decode to mono, 48 kHz float PCM.
- Keep each original isolated event. Trim surplus silence using a threshold 42 dB below that file's peak, retaining up to 25 ms of lead and 70 ms of tail.
- Preserve the source's pitch and speed. No new voice transformation, denoising, source separation, added music or artificial layering.
- Peak match to −6 dBFS before MP3 encoding. Apply a 12 ms entrance fade and a 35–100 ms exit fade appropriate to the event length; never use an exit longer than one-fifth of a clip.
- Export mono 128 kbps MP3; decode again to measure actual duration, peak and checksum. Exact trim bounds and fade durations are recorded per clip.

OpenGameArt direct-file and ZIP-member URLs are recorded in `sourceAudio` acquisition metadata. The itch.io pack uses an expiring download URL, so its lasting provenance is the creator page, original archive, original member filename and local source path. To recreate it on another machine, obtain the free pack from that page and place the recorded member at the manifest's work path.

## Screening evidence and limitations

`fal-ai/audio-understanding` reviewed the tiny laugh and a montage of the three Yo Frankie! effects. It described the laugh and rodent files 1 and 3 as cute, friendly, and free of music or environmental noise; it noted a very slight short reverberant character on the rodent voices. It rejected file 2 for its gruffer delivery. Those are automated perceptual judgments, not a claim of human listening or a guarantee of perfect isolation.

- Tiny laugh audit request: `01a0a382-d8f5-7381-968d-c86c2e0a820a`, completed.
- Rodent montage audit request: `01a0a384-459a-7a53-8f69-3d51ad7ed2a5`, completed.

A combined automated review accepted the tiny laugh, both selected rodent voices and three Ambroggio reactions as clean, music-free candidates. It rejected Ambroggio’s Garble Long for sounding primarily like wet mouth popping rather than a voice. The initial Little Robot screen similarly removed growls, pain-like cries and mouth-clicking effects; four clear vocal fits survived from that first group of 24. The user's earlier starred clips remain the reference for taste.

## Final prepared batch

**25 clips from four source families**, all independently playable, with no music or environmental noise reported in the automated screens. This is a listening shortlist, not a guarantee that every delivery will match the user's taste.

| Source family                       | Retained | Duration range |
| ----------------------------------- | -------: | -------------- |
| fvcalderan · tiny laugh             |        1 | 1.487 s        |
| Blender Foundation · Yo Frankie!    |        2 | 0.964–1.175 s  |
| AmbroggioMusic · Dialogue Sfx       |        3 | 0.235–1.175 s  |
| Little Robot Sound Factory · Voices |       19 | 0.637–1.574 s  |

The Little Robot pass reviewed 48 distinct events across the Funny Alien and three Small Creature families. Nineteen vocal candidates survived: Funny Alien files **08, 24, 25, 26, 29, 34, 35, 39, 40, 41, 43, 44, 45, 47, 48, 49, 52, 54**, plus **SmallCreature3_15**. Selections include melodic babble, gentle coos, curious nasal utterances, breathy laughter and playful exclamations. Alien 34 has a slightly electronic vocal texture; it is included as an alien-voice variation, not an environmental beep.

- Initial Little Robot audit: `01a0a38b-a2f4-7222-828b-4edac6eab71a`, completed.
- Focused Funny Alien audit: `01a0a38f-adf7-71a3-846b-d63da1270e19`, completed.

Both full audit responses and timestamp maps are retained with the ignored working sources. No audio-analysis job remains running. Files excluded from the final `additions.json` stay in the ignored work directory and must not be copied into the listening interface.

All 25 final files decoded successfully, every checksum matched, all original source paths resolved, and the encoded peaks are between −6.49 and −6.19 dBFS. The manifest records exact source trims, original archive members, fade lengths, decoded durations and SHA-256 hashes. Earlier stars and reviewed assets were not touched during preparation.
