# Environment configuration

The frontend and backend deploy as one Cloudflare Worker. There are no application `VITE_*` variables; keys belong to the Worker. Cloudflare's [secrets documentation](https://developers.cloudflare.com/workers/configuration/secrets/) describes local and hosted storage.

| Configuration | Where to edit or inspect |
| --- | --- |
| Non-secret settings, feature switches and bindings | `worker/wrangler.jsonc`: top-level settings for local development and `env.production` for deployment |
| Local secret values | Ignored `worker/.dev.vars`; copy the tracked `worker/.dev.vars.example` if the local file does not already exist |
| Hosted secret names | Wrangler commands below, or Cloudflare → Workers & Pages → select Worker → Settings → Variables and Secrets |
| Hosted secret values | Encrypted in Cloudflare; cannot be read back through Wrangler or the dashboard |

Local files are not synchronized with hosted secrets. Deploying code preserves existing hosted secrets; it does not upload `worker/.dev.vars`.

## Local development

Run `pnpm dev` to serve the frontend and Worker together through Portless. Do not wrap it in another `portless run` command. Open the URL printed at startup for `burning-tokens.localhost`; the protocol and proxy port follow your existing Portless settings. Portless assigns Vite's internal port automatically and prefixes the hostname in git worktrees. The Worker recognizes this request origin during local development, so invitations, agent links, owner controls and administrator sessions use the Portless URL even though `worker/wrangler.jsonc` retains a loopback fallback for non-Portless tools.

Print the current URL again with `pnpm exec portless get burning-tokens`. For a worktree, use the prefixed name shown by `pnpm dev`.

When running check scripts against the dev server, set `RETREAT_SITE_ORIGIN` (and `RETREAT_TEST_ORIGIN` for backend checks) to that URL. Their raw localhost defaults remain available for the separate preview/Worker commands.

## Secret inventory

| Name | Purpose | Required when |
| --- | --- | --- |
| `OPENAI_API_KEY` | Moderates notes and uploaded media before public sharing | `PUBLISHING_ENABLED=true` |
| `TYPESAFE_API_KEY` | Bounded semantic judgments in rooms | `TYPESAFE_ENABLED=true`; authored choices remain available without it |
| `CLOUDFLARE_TOKEN` | Reads aggregate Analytics Engine metrics on the server | Using the administrator metrics view |
| `STUDIO_ADMIN_KEY` | Administrator sign-in and review of private works | Using administrator tools |

Use the consolidated account-scoped “Burning Tokens project” API token for `CLOUDFLARE_TOKEN`, including Account Analytics Read. It is separate from Wrangler's existing local OAuth login. If its original value is lost, replace it and install the replacement in production. Save a new value in your password manager before closing its one-time display.

The existing token is under [My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens), not Account API Tokens. Next to **Burning Tokens project**, choose **⋯ → Roll → Confirm**. [Rolling preserves permissions and immediately invalidates the old value](https://developers.cloudflare.com/fundamentals/api/how-to/roll-token/); update both Workers with the replacement through their interactive prompts:

```sh
pnpm exec wrangler secret put CLOUDFLARE_TOKEN --config worker/wrangler.jsonc --env production
```

Production `METRICS_ENABLED` is true and deployed. For future rotation, update the production secret; only redeploy configuration if a feature switch also changes.

The production administrator key has an ignored recovery file under `work/admin-access/production-key.txt`. The existing `worker/.dev.vars` currently contains only the local administrator key. Production has OpenAI, TypeSafe, Cloudflare and administrator secrets; no Cloudflare token value is stored locally.

## Non-secret settings

Use Wrangler configuration as the single source rather than duplicating these in a dotenv template.

| Names | Purpose |
| --- | --- |
| `PUBLIC_ORIGIN` | Canonical origin for agent links and social metadata |
| `SITE_INDEXABLE` | True in production for public pages; false locally/preview. Private pages always remain noindex. |
| `TYPESAFE_ENABLED`, `TYPESAFE_MODEL` | Optional room classification switch and model |
| `TYPESAFE_DAILY_CALL_LIMIT`, `TYPESAFE_DAILY_INPUT_LIMIT` | Per-UTC-day call and serialized input-byte ceilings |
| `PUBLISHING_ENABLED` | Moderated public sharing switch |
| `METRICS_ENABLED` | Telemetry ingestion switch; separate from metrics query access |
| `ANALYTICS_ACCOUNT_ID`, `ANALYTICS_DATASET` | Server-side metrics query target |
| `WEB_ANALYTICS_TOKEN` | Public Cloudflare Web Analytics site identifier, configured only in production; safe to include in the browser beacon and unrelated to the secret `CLOUDFLARE_TOKEN` |
| `INVITATIONS_DAILY_LIMIT`, `INVITATIONS_MINUTE_LIMIT` | Shared admission ceilings for human invitations and independent agents |

Durable Object namespaces, private R2 buckets, Analytics Engine datasets, static assets, routes and the account ID are also declared in `worker/wrangler.jsonc`; these are Cloudflare bindings/configuration, not secrets. `pnpm build:production` selects the production environment; `pnpm dev` uses the local defaults.

## Inspect and update hosted secrets

List names only:

```sh
pnpm exec wrangler secret list --config worker/wrangler.jsonc --env production
```

Set or replace a secret interactively, using its name instead of `<NAME>`:

```sh
pnpm exec wrangler secret put <NAME> --config worker/wrangler.jsonc --env production
```

The prompt accepts the value without putting it in the command; `secret put` creates and deploys a new Worker version. Edit non-secret settings in Wrangler configuration and deploy with `pnpm deploy:worker-production`. Never place keys in `VITE_*`, tracked files or frontend code.
