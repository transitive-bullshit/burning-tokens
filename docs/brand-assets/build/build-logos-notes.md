# Burning Tokens native logos

These are the editable native logo masters for the accepted Burning Tokens direction.

## Assets

- `../logos/wordmark-sunset.svg`, `wordmark-cream.svg`, `wordmark-ink.svg`: the approved ImageGen lettering, refined as smooth cubic Bézier silhouettes as fifteen independently editable filled paths (thirteen letters and two star accents), with counters preserved. ViewBox: 1043 × 324.
- `../logos/mark-sunset.svg`, `mark-cream.svg`, `mark-ink.svg`: a manual abstraction of the reference's looping luminous sculpture. Three editable ribbon paths and vector overlap masks preserve its ascending loop, smaller returning loop, and broad lower loop. ViewBox: 256 × 256.
- `../logos/favicon.svg`: two simplified, heavier ribbon paths on a rounded ink field. The third loop is omitted to preserve legibility at small sizes. ViewBox: 256 × 256.

All seven SVGs are self-contained native geometry, with no raster images, font dependencies, or external references. The mark uses editable path strokes and vector masks; the wordmark uses filled contour paths. The original PNG is used read-only and its pixels are not modified.

## Regenerate

From the repository root, the command run successfully was:

```sh
/Users/tfischer/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 docs/brand-assets/build/build-logos.py
```

Ordinary regeneration uses Python's standard library and `build-logos.geometry.json`; it does not require the reference PNG, Pillow, NumPy, or fonts. Equivalent on another machine: `python3 docs/brand-assets/build/build-logos.py`.

The reviewed geometry input is the canonical editable source. The palette is explicitly held in the script's `COLORS` mapping: ink `#151632`, cobalt `#2447B8`, coral `#FF7464`, gold `#FFCC83`, cream `#FFF0CF`.

The smooth master uses 2.8-source-pixel Gaussian contour preprocessing, cusp-aware least-squares cubic fitting, hand-corrected B and T terminal spans, and clean curved stars. It contains 249 cubic segments across the same fifteen paths. The reviewed geometry preserves the broad silhouette while removing high-frequency trace noise. [Before/after proof](../../brand-exploration/logo-refinement/smooth-wordmark-proof.png); original geometry, SVGs and builder are preserved in the sibling `before/` folder.

`--wordmarks-only` regenerates only the three current lettering colorways. `--smooth-source` derives a reviewed-geometry candidate from the preserved source; normal rebuilding uses the saved smooth geometry. The old ribbon and favicon are now historical: the user rejected that icon, and replacement options are under exploration.

## Usage and verification

- Full wordmark: minimum **180 CSS pixels** wide; use larger when the wordmark carries the page.
- Full ribbon mark: minimum **24 CSS pixels**.
- Simplified favicon: verified at **16, 32, and 48 pixels**.
- Clearspace: at least **one quarter of the visible wordmark's height** around the wordmark, or **one quarter of the visible mark's width** around the mark. The small transparent padding in each SVG does not replace this surrounding layout space.
- Sunset and cream variants are intended for ink or other sufficiently dark fields. Ink variants are intended for cream or light fields.
- Preserve proportions. Do not replace the traced lettering with display type or add the concept image's tagline/navigation to the logo.

SVG structure was parsed and verified for native paths and absence of image/text/use elements or external references. Actual rendered proof sheets were inspected at full and reduced sizes. The preview PNGs in `../logos/` are QA proofs, not additional logo masters. The parent brand build produces the publication PNGs, ICO, social preview, and identity poster from these SVGs.
