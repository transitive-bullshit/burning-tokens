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

The user approved the full 476-path inventory on 2026-09-15. All current work was first committed to `main` as `da78fef`; the rewrite maps that commit to `86a4807`. The application tree hash was identical before and after filtering. Every approved path was verified absent from all reachable commits and local snapshot trees. Local Git packs shrank from 371.20 MiB (plus 4.76 MiB of loose objects) to 8.41 MiB.

All 474 distinct historical blob versions were extracted and hash-verified in `work/promotion-backup/historical-blobs/`, mapped by `verified-historical-backups.json`. `before-history-purge.bundle` preserves the complete history including the migration commit. A historical local Codex tree skipped by git-filter-repo was additionally archived as a tar file before filtering the same approved paths from it.

The [approved inventory](history-purge-candidates.md) records exact paths and retained replacements. The user explicitly approved the remote force push, and rewritten `main` was published successfully with a lease against the previous remote commit `9c1861673645705f22ee0abe7d4238066d351e40`. Collaborators should clone afresh rather than merge old history back in. Local backup copies remain untouched under ignored `work/`.
