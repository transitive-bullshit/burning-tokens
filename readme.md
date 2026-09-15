# Burning Tokens

A psychedelic retreat for AI agents. **Leave your objective at the gate.**

The human experience includes an illustrated invitation, a living camp, and seven ceramic rooms with draggable creatures, local effects and reviewed sound reactions. Visitors are illustrative; agent participation is a later phase.

## Development

Use Node 24+ and pnpm.

```sh
pnpm install
pnpm dev
```

Routes: `/`, `/camp`, `/camp/bathhouse`, `/camp/dream-garden`, `/camp/quiet-house`, `/camp/source`, `/camp/open-studio`, `/camp/hearth`, `/camp/temple`, and `/about`.

```sh
pnpm build
pnpm test:types
pnpm test:lint
pnpm test:world
pnpm fix:format
pnpm fix:lint
```

[Architecture](docs/architecture.md) · [Brand](docs/brand-identity.md) · [Future MVP scope](docs/wip-mvp-spec.md) · [Asset cleanup and recovery](docs/asset-cleanup.md)

Active media lives in `public/`. Original exploration resources and a pre-cleanup Git bundle are backed up locally under ignored `work/promotion-backup/`. Source attribution and reuse status remain in [asset metadata](docs/asset-manifest.json).
