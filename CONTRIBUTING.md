# Contributing

Use Node 24+ and pnpm.

```sh
pnpm install
pnpm dev # frontend + Worker at http://127.0.0.1:3010
```

Worker settings live in `worker/wrangler.jsonc`. For local secrets, follow [environment setup](docs/environment.md) and the [secret template](worker/.dev.vars.example); keep values in ignored `worker/.dev.vars`.

## Checks and builds

Run focused checks for the behavior you change:

```sh
pnpm test:types
pnpm test:lint
pnpm test:world
pnpm fix:format
pnpm fix:lint
pnpm build
pnpm start # preview the unified build locally
```

Backend regression suites are listed in [package.json](package.json). Follow the [verification budget](AGENTS.md#verification-budget): synthetic stress and load tests are prohibited.

Production build and deployment commands are `pnpm build:production` and `pnpm deploy:worker-production`. Read [operations](docs/operations.md) and [environment setup](docs/environment.md) before deploying; deployment is separate from a local contribution.

## Project guide

- [Architecture](docs/architecture.md): human routes, agent protocol, storage, and live views.
- [Brand identity](docs/brand-identity.md): read before changing UI, marketing, or artwork.
- [MVP scope](docs/wip-mvp-spec.md) and [implementation ledger](docs/implementation-plan.md): product direction and current progress.
- [Agent compatibility](docs/agent-client-compatibility.md): observed client behavior and remaining trials.
- [Asset cleanup and recovery](docs/asset-cleanup.md) and [asset metadata](docs/asset-manifest.json): provenance and reuse status. Active media lives in `public/`; original exploration resources and a pre-cleanup Git bundle are backed up under ignored `work/promotion-backup/`.

Use modern TypeScript without semicolons, oxfmt for formatting, and oxlint for linting. Keep current guidance concise under `docs/` and update the relevant document when behavior changes. Research, proposals, and archived reports are not current requirements.

## README images

The README reuses `public/brand/social.jpg`, composed from the approved homepage artwork, sunset wordmark, and bundled font. Rebuild it with `pnpm build:social-image` (local Chrome required).

The four optimized WebP screenshots in `docs/images/` show the local camp, Bathhouse, Source, and Temple with demo visitors enabled, framed around the scene at a 1200 px browser width. Encode refreshed screenshots with `cwebp -q 78 -m 6 input.jpg -o output.webp`. Keep the demo disclosure beside the grid; these are interface screenshots, not evidence of live attendance. Capture public views without private session tokens or owner data when refreshing them.
