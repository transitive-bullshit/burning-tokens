# Character library voice auditions

Research and preparation · 15 September 2026

Sixteen new short excerpts are staged from three professional library directions. These are **unreviewed listening references**, not approved production assets. None replaces or recuts an existing favorite. The fragment and audio are in `work/creature-audio/character-libraries/`; integration is managed by the main task.

## Sources and rationale

[IndieSFX Cute Creatures](https://indiesfx.itch.io/indiesfx-s042c) offers a free, downloadable MP3 demo of a 126-sound library. The creator describes small voice vocabularies made with vocal performance, whistles, squeakers and synthesis, without coherent words. This is a materially different source from Little Robot Sound Factory, whose previous candidates were rejected. Eight short phrases are staged. The full 22 MB WAV library is listed at **$10**; it was not purchased. The demo is explicitly offered as a preview and is kept as a local reference. The creator's original vocabulary names are not guessed from the demo timeline.

[344 SFX Cartoon Animal Voices](https://344sfx.itch.io/cartoon-animal-voices) describes studio-recorded, performed and processed animal voices, including duck conversations, laughter and reactions, bear expressions and chipmunk-style telephone voices. Its public SoundCloud demo is embedded on the creator's page. Four short reactions with separated waveform boundaries are staged. The full pack is listed at **$9.99**; it was not purchased. Animal/character identity for each short demo excerpt remains unverified.

The Soundrangers **Furry Furble** family is a closer catalog match for small friendly creature chatter: the publisher tags these individually supplied calls as fuzzy, cuddly, cute, chipmunk-like and woodland. Four complete short preview calls are staged from their own product pages: [Chatter 01](https://www.prosoundeffects.com/sound-effects/PSE_SR-COM/xs76M/Furry-Furble-Chatter-01), [Chatter 02](https://www.prosoundeffects.com/sound-effects/PSE_SR-COM/Iyj3m/Furry-Furble-Chatter-02), [Chatter 03](https://www.prosoundeffects.com/sound-effects/PSE_SR-COM/BzaqS/Furry-Furble-Chatter-03) and [Chatter 04](https://www.prosoundeffects.com/sound-effects/PSE_SR-COM/9hA84/Furry-Furble-Chatter-04). Each page lists a **$5** original download; no purchase was made. The original WAVs require a production license. Chatter 05 and Idle 04 were acquired for research but are withheld to avoid padding the set with longer variants.

Prices and page descriptions were checked on 15 September 2026. Public audition availability does not establish production reuse permission. Each candidate records its exact primary source and `licenseStatus: unknown`.

## Local screening and cuts

The IndieSFX and 344 SFX demos contain real quiet valleys, rather than a continuous prominent audio bed. IndieSFX has 100 ms RMS windows below −40 dBFS near 6.1, 7.2 and 11.1 seconds. 344 SFX has repeated quiet windows around −43 to −49 dBFS. Those observations support phrase separation, but **do not certify absence of faint music, narration or watermarks**, and do not establish that the user will like the character. The Furble samples are individual short calls rather than an edited multi-call demo. Human listening remains decisive.

| Direction | Candidate IDs | Exact source windows |
| --- | --- | --- |
| IndieSFX | `indiesfx-little-voice-01` through `08` | 3.13–3.97; 4.00–5.13; 5.38–6.13; 6.20–7.20; 8.78–9.65; 10.52–11.12; 11.21–12.04; 15.41–16.32 s |
| 344 SFX | `344-cartoon-reaction-01` through `04` | 4.18–4.79; 6.53–6.80; 7.72–8.29; 18.96–19.98 s |
| Furry Furble | `furble-chatter-01` through `04` | Individual files: 0–0.88; 0–1.27; 0–1.70; 0–1.28 s |

All sixteen exports are mono 48 kHz / 128 kbps MP3, preserve source pitch and speed, use a 12 ms opening fade and an 85 ms closing fade (60 ms for the shortest 270 ms call), and are peak-matched to −6 dBFS before encoding. Decoded durations are **0.27–1.70 seconds**; decoded peaks are **−6.74 to −6.25 dBFS**. All files decode successfully to finite, non-silent samples. SHA-256, file size, source path, exact trim and processing are included in the fragment. `screening.json` preserves source hashes and quiet-window measurements.

The source recording is retained in ignored working storage. IndieSFX was acquired through its ordinary free-demo button; 344 SFX through the creator-embedded public SoundCloud player; Furble through the public preview URLs exposed by each catalog page. No account, purchase or access-control bypass was used. Temporary signed audition URLs are not persisted as stable download links; `sourceAudio.downloadPage` identifies the source of fresh previews.

## Excluded alternative

[Squeaky Creatures](https://www.sonicsoundfx.com/products/squeaky-creatures) is a 595-sound library listed at $15. Its public demo was acquired, but no snippets are staged: an already-submitted automated analysis reported a continuous musical backing and spoken narration. That finding is sufficient to withhold this demo; the model's subjective voice characterization is not treated as user approval. No further external audio-analysis jobs are pending.
