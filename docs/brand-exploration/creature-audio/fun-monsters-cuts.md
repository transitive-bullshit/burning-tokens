# Fun Monsters — isolated call study

18 source excerpts, reviewed 15 September 2026: 10 additional calls and 8 tighter replacements. Listen in the [source collection](./?source=A_Ow1ExADyc).

These clips explore cute, playful, wondrous and slightly alien voices, with shorter individual reactions in place of broad slices through the demo. Original clip IDs are preserved so favorites and notes remain attached.

## Source and reuse

[Fun Monsters — Audio Demo per character](https://www.youtube.com/watch?v=A_Ow1ExADyc), Articulated Sounds. The [paid sound library](https://articulatedsounds.com/audio-royalty-free-library/sfx/fun-monsters) supplies the production assets and licensing. These short demo excerpts remain local listening references. This pass did not purchase a library, remove a watermark, or perform source separation.

## Cuts

Times below are seconds in the original YouTube recording. The last column distinguishes new calls from revised existing clips.

| Listening title | Source window | Length | End fade | Change |
| --- | --- | --- | --- | --- |
| Is that for me? | 5.62–6.48 s | 0.86 s | 120 ms | Recut from 4.00–6.30 |
| A small delight | 0.68–1.23 s | 0.55 s | 90 ms | Recut from 0.55–2.00 |
| Something sparkled | 30.94–31.72 s | 0.78 s | 90 ms | Recut from 31.00–32.40 |
| Moon-bubble wonder | 144.87–146.45 s | 1.58 s | 120 ms | Recut from 144.00–146.00 |
| Ceramic jellybean | 186.04–186.73 s | 0.69 s | 90 ms | Recut from 184.00–186.70 |
| An excellent bad idea | 113.72–115.17 s | 1.45 s | 120 ms | Recut from 113.60–115.50 |
| Look! Look! | 116.91–117.58 s | 0.67 s | 90 ms | Recut from 116.50–117.80 |
| You saw that too? | 169.34–170.37 s | 1.03 s | 120 ms | Recut from 169.00–170.60 |
| A tiny question | 9.94–10.65 s | 0.71 s | 80 ms | New |
| Pleasantly surprised | 11.22–12.16 s | 0.94 s | 120 ms | New |
| A mooncat hello | 161.61–162.57 s | 0.96 s | 120 ms | New |
| Would you look at that | 164.57–165.98 s | 1.41 s | 120 ms | New |
| Peeking around the corner | 167.17–167.98 s | 0.81 s | 120 ms | New |
| One small thought | 176.04–176.46 s | 0.42 s | 80 ms | New |
| A delightful secret | 180.85–181.62 s | 0.77 s | 80 ms | New |
| What is that little thing? | 191.32–191.93 s | 0.61 s | 80 ms | New |
| A pocketful of giggles | 227.26–228.26 s | 1.00 s | 120 ms | New |
| Oh, a tiny wonder | 237.29–237.87 s | 0.58 s | 80 ms | New |

## Editing and review method

- Use the source's character chapters to identify Cuty, Kitty, Swindly, Bouncy and Bitsy candidates. Automated audio analysis of short chapter excerpts informed the emotional and sonic descriptions; this is not a claim of human listening approval.
- Inspect mono waveform energy in 10 ms windows. The demo is densely sequenced, so a fixed silence threshold misses most boundaries. Locate local quiet valleys near the candidate onset and ending, and stop before the next strong rise where possible.
- Use an 18 ms entrance fade and an 80–120 ms exit fade. Keep the natural pitch and speed. Very short calls use shorter fades to retain their attack and character. Normalize to −6 dBFS before MP3 encoding, with no limiting, synthetic voice generation or added ambience.
- Decode every exported MP3 to verify finite, non-silent audio, duration and peak level. Record per-clip fades, source windows, gain and hashes in `clips.json`. The encoded MP3 header's padding is excluded from displayed duration.

Automated analysis found friendly nonverbal calls and no spoken preview watermark in the newly reviewed sections. It disagreed about faint rhythmic backing sounds in some sections. These are cleaner cuts from a mixed demo, not guaranteed isolated studio stems; final listening remains the deciding check for residual neighboring sounds and taste.

Rebuild just this source with:

```sh
python3 docs/brand-exploration/creature-audio/build-clips.py --source A_Ow1ExADyc
```

The source WAV stays in ignored `work/creature-audio/`. Per-clip `fades.inMs` and `fades.outMs` control the export; sources without explicit settings retain the prior 12 ms / 35 ms defaults.
