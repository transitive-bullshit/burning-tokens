# Original creature voice experiment

**15 September 2026 · One candidate from four generated takes.** This bounded trial explores a different source of voices alongside the internet search. It does not establish an accepted creature voice or a production sound system.

Four original six-second takes were generated with [ElevenLabs Sound Effects v2 through fal](https://fal.ai/models/fal-ai/elevenlabs/sound-effects/v2). Inputs were original text descriptions only: no third-party recordings, voice clones, franchise names or existing character names were supplied. The requested directions were soft nasal babble, tiny giggles, wondrous coos and bouncy bean-creature reactions. Each requested three short vocal reactions with silence between them. The same tool provider analyzed its own generated output URLs; no external reference audio was uploaded.

The live tool schema selected `duration_seconds: 6`, `prompt_influence: 0.65`, `output_format: mp3_44100_192` and `loop: false`. Initial submissions were rejected by validation because the schema omitted the endpoint's 450-character text limit. The prompts were shortened once. Four successful generations were completed; none was regenerated in search of a better result.

## Result and screening

The approach did not reliably follow the requested emotional direction. Automated audio checks described bleating, throat-clearing, baby-like wailing or distressed whines in most of the takes. Those descriptions are fallible screening evidence, not human listening approval. Their approximate timestamps sometimes disagreed with the measured quiet boundaries, so export windows use local waveform/silence measurements.

| Take | Decision |
| --- | --- |
| Mochi nasal babble | Withheld. Automated check described strained bleating and throat clearing. |
| Puff giggles | Retain only the opening giggle as an unstarred audition candidate. Withhold the sustained later cry. |
| Moonmoth coos | Withheld. Automated check described a baby-like distressed wail. |
| Bean reactions | Withheld. Automated check described whiny calls and a piercing cry. |

`original-puff-giggle` is the 0–1.73-second opening of the Puff take, ending in a measured quiet gap that begins at approximately 1.65 seconds. It uses 12 ms in / 70 ms out fades, mono 48 kHz / 128 kbps MP3, and −6 dBFS peak matching before encoding. Decoded duration is 1.73 seconds and decoded peak is −6.37 dBFS. No pitch, formant or speed processing was applied. Its listening-card source explicitly says **Original synthesized voice exploration**.

All raw takes decoded into finite samples. Three have floating-point decoded peaks above 0 dBFS before level matching; this is recorded as insufficient headroom, not proof of audible clipping. Export normalization handles headroom for the retained excerpt. The entire six-second Puff take is not included.

This trial produced one candidate rather than padding the next batch with weak synthetic material. Future synthesis, if pursued, should test a single short gesture per generation and compare its actual sound with the user's accepted clips. Multi-reaction prompts did not provide dependable character direction here.

## Provenance and reuse

The ignored local folder `work/creature-audio/original-voices/` contains the four raw MP3 files, exact prompts and provider request IDs in `generations.json`, the provider's audio screening output in `audio-review.json`, `export-candidates.py`, the exported candidate and a separate `manifest-fragment.json` for integration. Source timing, URL, prompt, model, output format and checksum travel with the clip metadata.

These are newly synthesized comparison materials, subject to [fal's provider terms](https://fal.ai/legal/terms-of-service). This note does not assert exclusivity, copyrightability or an independently cleared production license. The candidate is not user-approved; no stars, saved feedback, shared manifest or existing audio files were changed by this experiment.
