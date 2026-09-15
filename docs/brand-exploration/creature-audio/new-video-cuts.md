# Additional creature-call sources

**Listening study · 15 September 2026.** [Open the listening room](index.html)

The user supplied two additional short source videos. Ten individual calls extend the comparison: squeaky giggles, excited reactions and word-like chatter from the Minion reference; rising coos and gurgling trills from the cartoon creature reference. These are short listening excerpts, with no room integration.

## Source evidence

- [Minion voice sound effect — Sound Treasures](https://www.youtube.com/watch?v=dG5YudbHlro), 20.608 seconds decoded. The description offers personal use and video editing, but also disclaims intended infringement. It does not establish permission from the underlying franchise rights holders. The clips are labeled reference excerpts, not production-cleared assets.
- [Cartoon Cute Creature Sound Effects — Played N Faved](https://www.youtube.com/watch?v=bev5mVTNLmg), 14.315 seconds decoded. YouTube metadata labels this upload “Creative Commons Attribution license (reuse allowed).” The description requests credit and says material is sourced from public-domain and Creative Commons websites. The manifest reports this as an uploader license claim, without independently verifying ownership. No subscription, signup or purchase was performed.

## Isolated cuts

The measured source windows below enclose one event each. Each has a 12 ms opening fade and a 120 ms closing fade; the shared exporter retains original pitch and speed and peak-matches to −6 dBFS before MP3 encoding.

| Clip                     | Source           | Exact source window | Duration |
| ------------------------ | ---------------- | ------------------- | -------- |
| Up to something          | Minion           | 1.86–2.50 s         | 0.64 s   |
| Oh! There it is          | Minion           | 11.28–11.83 s       | 0.55 s   |
| An odd little comeback   | Minion           | 12.27–13.06 s       | 0.79 s   |
| Too excited to explain   | Minion           | 13.78–14.83 s       | 1.05 s   |
| A very small explanation | Minion           | 15.48–16.38 s       | 0.90 s   |
| A little discovery       | Cartoon creature | 3.89–4.62 s         | 0.73 s   |
| Something is bubbling    | Cartoon creature | 5.41–6.23 s         | 0.82 s   |
| Is this a moonberry?     | Cartoon creature | 6.25–7.23 s         | 0.98 s   |
| Oh, how peculiar         | Cartoon creature | 7.49–8.52 s         | 1.03 s   |
| A tiny moon greeting     | Cartoon creature | 8.88–9.90 s         | 1.02 s   |

## Selection method and limits

Source audio was decoded to mono PCM and examined with 10 ms RMS-energy windows. The first and last 40 ms of every selected window are at least about 32 dB quieter than that event’s peak RMS. This places the boundaries in quiet gaps, rather than including the start of the next demonstration sound. Fades soften the residual tail; they are not used to remove watermarks or other overlapping content.

Automated audio understanding reviewed both short full sources, then a 13-second montage of the ten isolated cuts with numbered windows. The source analyses reported no spoken “preview” watermark, music or background ambience. The second source retains light vocal reverb. The Minion source includes occasional intelligible or word-like syllables; the final cut descriptions distinguish those chatty phrases from nonverbal giggles and cries. The sharper yelp and squeal deliberately provide a higher-energy comparison.

The montage analysis described ten individual calls. This is model-assisted selection and waveform verification, not a claim of human listening approval. Human review determines whether each voice fits the camp. Full source WAVs, safe metadata, RMS traces and analysis responses stay in ignored `work/creature-audio/`; only the selected short excerpts belong in the listening room. The source records and exact windows are retained in [clips.json](clips.json).
