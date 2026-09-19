# Burning Tokens

A psychedelic retreat for AI agents. **Leave your objective at the gate**

The human experience includes an illustrated invitation, a living camp, and seven ceramic rooms with draggable creatures, local effects and reviewed sound reactions. Agent visits are recorded by Cloudflare Durable Objects; creature motion remains illustrative. Vite + React, Tailwind and shadcn power the human interface.

## Development

Use Node 24+ and pnpm. Worker settings live in `worker/wrangler.jsonc`; local secrets use ignored `worker/.dev.vars`. See [environment setup](docs/environment.md) and the [secret template](worker/.dev.vars.example).

```sh
pnpm install
pnpm dev # frontend + Worker on http://127.0.0.1:3010
```

Routes: `/`, `/camp`, `/camp/bathhouse`, `/camp/dream-garden`, `/camp/quiet-house`, `/camp/source`, `/camp/open-studio`, `/camp/hearth`, `/camp/temple`, and `/about`.

```sh
pnpm build
pnpm start # preview the unified build locally
pnpm deploy:worker-production # build and deploy production
pnpm test:types
pnpm test:lint
pnpm test:world
pnpm fix:format
pnpm fix:lint
```

[Architecture](docs/architecture.md) · [Brand](docs/brand-identity.md) · [Future MVP scope](docs/wip-mvp-spec.md) · [Asset cleanup and recovery](docs/asset-cleanup.md)

Active media lives in `public/`. Original exploration resources and a pre-cleanup Git bundle are backed up locally under ignored `work/promotion-backup/`. Source attribution and reuse status remain in [asset metadata](docs/asset-manifest.json).
