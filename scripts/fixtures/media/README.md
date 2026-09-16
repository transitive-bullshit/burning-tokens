# Moderation smoke fixtures

`moon.png`, `moon.jpeg` and `moon.webp` are original 128 × 128 geometric test images: a cream crescent on a purple background. They were rendered locally from two circles and a rectangle with Sharp. They contain no third-party artwork or visitor data and use this repository's MIT license.

`scripts/check-publication.mjs` uploads each format to the explicitly selected test backend, requires real moderation approval, compares served bytes with these originals, checks unsharing, and deletes the test work. The same script creates a short silent PCM WAV in memory to verify that unsupported audio stays private.

These are test fixtures, not production brand assets or examples of all content that moderation can encounter. Successful benign examples establish format plumbing; they do not establish moderation accuracy.
