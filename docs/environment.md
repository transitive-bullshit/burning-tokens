# Environment configuration

The frontend and backend deploy as one Cloudflare Worker. There are no application `VITE_*` variables; keys belong to the Worker. Cloudflare's [secrets documentation](https://developers.cloudflare.com/workers/configuration/secrets/) describes local and hosted storage.

| Configuration | Where to edit or inspect |
| --- | --- |
| Non-secret settings, feature switches and bindings | `worker/wrangler.jsonc`: top-level settings for local development; `env.preview` and `env.production` for deployments |
| Local secret values | Ignored `worker/.dev.vars`; copy the tracked `worker/.dev.vars.example` if the local file does not already exist |
| Hosted secret names | Wrangler commands below, or Cloudflare → Workers & Pages → select Worker → Settings → Variables and Secrets |
| Hosted secret values | Encrypted in Cloudflare; cannot be read back through Wrangler or the dashboard |

Local files are not synchronized with hosted secrets. Deploying code preserves existing hosted secrets; it does not upload `worker/.dev.vars`. Preview and production secrets must be provisioned separately. If using an environment-specific local file such as `worker/.dev.vars.preview`, put all that environment's local secrets there: it replaces the generic file.

## Secret inventory

| Name | Purpose | Required when |
| --- | --- | --- |
| `OPENAI_API_KEY` | Moderates notes and uploaded media before public sharing | `PUBLISHING_ENABLED=true` |
| `TYPESAFE_API_KEY` | Bounded semantic judgments in rooms | `TYPESAFE_ENABLED=true`; authored choices remain available without it |
| `CLOUDFLARE_TOKEN` | Reads aggregate Analytics Engine metrics on the server | Using the administrator metrics view |
| `STUDIO_ADMIN_KEY` | Administrator sign-in and review of private works | Using administrator tools |

Use the consolidated account-scoped “Burning Tokens project” API token for `CLOUDFLARE_TOKEN`, including Account Analytics Read. It is separate from Wrangler's existing local OAuth login. The token was created in Chrome, then installed by the user in the preview Worker; **no local recovery copy was saved**. It cannot be recovered from that encrypted secret. If its original value is lost, replace it and install the replacement in every environment that uses it, keeping one project token rather than adding a second analytics token. Save a new value in your password manager before closing its one-time display.

Administrator keys have separate ignored recovery files under `work/admin-access/preview-key.txt` and `work/admin-access/production-key.txt`. The existing `worker/.dev.vars` currently contains only the local administrator key. Production has OpenAI, TypeSafe and administrator secrets; its Cloudflare token is not provisioned and its telemetry writes remain disabled.

## Non-secret settings

Use Wrangler configuration as the single source rather than duplicating these in a dotenv template.

| Names | Purpose |
| --- | --- |
| `PUBLIC_ORIGIN` | Canonical origin for agent links and social metadata |
| `SITE_INDEXABLE` | Search indexing switch; currently false for preview and production |
| `TYPESAFE_ENABLED`, `TYPESAFE_MODEL` | Optional room classification switch and model |
| `TYPESAFE_DAILY_CALL_LIMIT`, `TYPESAFE_DAILY_INPUT_LIMIT` | Per-UTC-day call and serialized input-byte ceilings |
| `PUBLISHING_ENABLED` | Moderated public sharing switch |
| `METRICS_ENABLED` | Telemetry ingestion switch; separate from metrics query access |
| `ANALYTICS_ACCOUNT_ID`, `ANALYTICS_DATASET` | Server-side metrics query target |
| `INVITATIONS_DAILY_LIMIT`, `INVITATIONS_MINUTE_LIMIT` | Shared admission ceilings for human invitations and independent agents |

Durable Object namespaces, private R2 buckets, Analytics Engine datasets, static assets, routes and the account ID are also declared in `worker/wrangler.jsonc`; these are Cloudflare bindings/configuration, not secrets. Build scripts select the environment with `CLOUDFLARE_ENV=preview` or `production`; `pnpm dev` uses the local defaults.

## Inspect and update hosted secrets

List names only:

```sh
pnpm exec wrangler secret list --config worker/wrangler.jsonc --env preview
pnpm exec wrangler secret list --config worker/wrangler.jsonc --env production
```

Set or replace a secret interactively, using its name instead of `<NAME>`:

```sh
pnpm exec wrangler secret put <NAME> --config worker/wrangler.jsonc --env production
```

Use `--env preview` to update preview. The prompt accepts the value without putting it in the command; `secret put` creates and deploys a new Worker version. Edit non-secret settings in Wrangler configuration and deploy with `pnpm deploy:worker-preview` or `pnpm deploy:worker-production`. Never place keys in `VITE_*`, tracked files or frontend code.
