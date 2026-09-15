# Asset promotion and history cleanup

The human experience moved into the Next.js app. Only active assets are served from `public/`: the accepted hero, three vector wordmark masters, two licensed fonts, eight scene backgrounds, one lossless creature atlas and 149 selected sound clips. Scene/hero imagery shrank from 27,573,359 bytes to 4,607,860 bytes through WebP conversion. [The manifest](asset-manifest.json) records source paths, conversion sizes and audio provenance.

## Local recovery

Before cleanup, 569 exploration files (359,326,401 bytes) were copied to `work/promotion-backup/docs/`. `manifest.json` records individual SHA-256 hashes. `before-promotion.bundle` is a verified complete Git history bundle from before promotion. `cleanup-candidates.json` enumerates the 533 superseded resource files removed from the working tree, each verified against its backup. Leftover local build caches were moved to `local-build-cache/`.

The remaining superseded exploration directories, including their historical planning documents, were moved into `remaining-exploration/docs/` after the user confirmed this archival scope. Their complete pre-migration copies also remain in `docs/` inside the backup. Current brand guidance, the MVP specification and the research PDF remain in the repository.

To recover the original repository without changing this checkout:

```sh
git clone work/promotion-backup/before-promotion.bundle work/recovered-before-promotion
```

`work/` is ignored. Do not add the backup bundle or original images to Git. Copy this local backup elsewhere if you need a second durable copy.

## History

**Proposed only; awaiting user approval. No history rewrite or force push has been performed.** The proposed purge covers superseded media and standalone prototype exports at their old `docs/brand-assets/`, `docs/brand-exploration/` and `docs/archive/` paths throughout history after approval. Active replacements live at new application paths. The exact proposed history path list is in [history-purge-candidates.md](history-purge-candidates.md). Rewriting history changes commit IDs; collaborators should clone afresh rather than merge old history back in.
