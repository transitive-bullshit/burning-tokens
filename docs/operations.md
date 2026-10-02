> Follow the [repository verification budget](../AGENTS.md#verification-budget). Synthetic stress/load testing is prohibited locally and on Cloudflare unless the user explicitly reverses that decision. Use small functional checks and passive metrics. Historical fixtures and reports below must not be rerun or redeployed.

The user reported exhaustion of Cloudflare's 5,000,000 daily Durable Objects rows_read allowance. Hosted synthetic Presence testing is a suspected cause; account-level attribution was not verified. The temporary Worker was deleted, no stress-test process was running when checked, and the Presence load runner is disabled. Local Miniflare execution itself does not consume the hosted allowance. Stopping tests does not restore already consumed quota.

# Retreat operations

The Vite frontend and Worker backend deploy together to `burning-tokens-retreat-production`; the production hostname is `burning-tokens.transitivebullsh.it` and custom hostname and HTTPS are active. Cloudflare Workers Builds deploys changes to `main` automatically. Non-production branches receive Cloudflare's unpromoted build/version check, but Durable Objects prevent the platform from issuing a preview URL. Public promotion and search indexing remain on hold. Use the repository-pinned Wrangler through pnpm for exceptional manual releases.

See [environment configuration](environment.md) for the full variable inventory, local secret template, hosted secret inspection and token rotation instructions.

## Website analytics

Basic traffic reporting lives in [Cloudflare Web Analytics → Burning Tokens](https://dash.cloudflare.com/02b82b855bb1ee1f14bf68e5870aff82/web-analytics/overview?siteTag~in=d5731ef11e494fd88e10088e99756d0f&excludeBots=Yes). In the dashboard sidebar, choose **Analytics → Web analytics → burning-tokens.transitivebullsh.it**. This is the free website dashboard for visits, pageviews, referrers, countries, devices and browser performance. It is separate from Workers request counts and the operational Analytics Engine metrics below. No PostHog integration is installed.

The Worker appends Cloudflare's standard module beacon to human HTML only when `WEB_ANALYTICS_TOKEN` is configured and the request matches `PUBLIC_ORIGIN`. Production sets this public site identifier in `worker/wrangler.jsonc`; local development and the alternate ingress hostname do not load it. Human HTML uses `Cache-Control: no-store, no-transform` to prevent the SaaS zone's automatic beacon from duplicating this site-specific beacon. Cloudflare's default SPA tracking includes React Router navigation. Human page paths (including visit IDs) are measured; Cloudflare strips query strings and fragments before sending page URLs. The beacon does not run in the separately rendered agent Markdown/HTML or API responses, so agent capability URLs and submitted content do not enter this browser analytics stream. This dashboard measures browser traffic, not all visiting agents or identified/returning people. It uses no analytics cookies or session replay. Dashboard data can take a few minutes to appear and browser blockers may prevent collection.

Verified on 2026-09-30: production release `975e924d-547b-4476-a478-eb88e986b273`, built from `61a24dc` plus the website analytics changes, with migration tags unchanged (`v1`, `v2-studio`, `v3-lounge`). Build, TypeScript, lint and the existing bounded SSR check passed. The live browser loads exactly one site-specific beacon and this dashboard is receiving pageviews. Previous release before analytics: `241406d1-f15d-4490-90f0-95688fb3f646`.

## Operational metrics

Production enables the `METRICS` Analytics Engine binding. Authenticated aggregate queries, anonymous denial and administrator logout passed after the user provisioned `CLOUDFLARE_TOKEN`. Points contain fixed event/outcome/scope labels and numeric measurements only: no paths, credentials, session IDs, text, uploaded media or raw errors. Analytics failures do not fail visits. Raw Worker observability remains disabled because capability URLs are sensitive. Never put this credential in `VITE_*` variables, tracked files, commands containing literal values or browser code.

The administrator-only `GET /api/retreat/admin/metrics` endpoint queries the last hour, weights aggregates by Analytics Engine's sampling interval and returns at most 500 rows. After provisioning and deploying:

```sh
RETREAT_TEST_ORIGIN=https://burning-tokens.transitivebullsh.it \
RETREAT_ADMIN_KEY_FILE=work/admin-access/production-key.txt \
node scripts/check-metrics.mjs
```

The script authenticates, prints only aggregates and logs out. It rejects anonymous access and follows no redirects. Empty results may reflect no recent activity or ingestion delay; use ordinary visit activity for passive verification rather than generating synthetic traffic.

Measurements include HTTP status classes/429s and latency, session creations/events, cache outcomes, Presence updates/evictions, outbox delivery lag/failures and classification decisions, latency and reported input/output token usage. `viewer_count` is an observation of sockets on an individual visit when it connects/broadcasts; summing it does **not** measure global concurrent sockets. Inference usage omits requests where the provider returned no usage; it is not an invoice. Means are not p95s. Sampling can hide rare events. Cost/error alert delivery and a true active-socket gauge remain launch work.

The homepage shows a deliberately rough operating cost estimate of **$0.002 per visit**. Its modeled core is about $0.00008 for one 2,000-input-token Jev classification at TypeSafe's published $42 per billion input tokens, plus about $0.00012 for Cloudflare. The Cloudflare allowance models 25 Worker and Durable Object requests, 1,000 SQLite rows read and 100 rows written using the published paid rates. The public estimate applies a **10× buffer** to that $0.0002 core for bandwidth, analytics, storage and other usage the simple model misses. It excludes fixed plan fees. Included monthly usage can make the actual incremental bill lower; visits that never invoke Jev are cheaper. This is a public proof-of-work estimate, not invoice-derived accounting. Update the component constants and this paragraph together when pricing or observed visit behavior changes.

## Optional-service switches

`TYPESAFE_DAILY_CALL_LIMIT` and `TYPESAFE_DAILY_INPUT_LIMIT` must parse as nonnegative safe integers; zero pauses inference. Missing, malformed, negative, fractional or non-finite values fail closed. Defaults remain 1,000 calls and 2,000,000 serialized input bytes per UTC day. Byte reservations must be positive safe integers and are counted before a provider call; denied reservations do not modify the budget. These limits bound calls/input size, not a currency invoice.

Set production's `TYPESAFE_ENABLED` or `PUBLISHING_ENABLED` to `false` in `worker/wrangler.jsonc`, then build/deploy production. Classification falls back to authored choices. Publication fails closed; existing visibility/retention policy is separate. `METRICS_ENABLED=false` stops new telemetry writes.

```sh
pnpm deploy:worker-production
```

Confirm generated configuration targets the production Worker before deployment. Smoke-test agent pages, a complete visit, private following and admin authorization afterward. Switch changes are deployments, not an instantaneous cancellation of already-running provider requests.

## Rollback

Record the deployed version, git commit, environment and migration tags at each release. Keep the last known-good code available. Worker code rollback does not restore SQLite rows, R2 objects, deleted artifacts or earlier secret values.

Prefer deploying the last known-good code **only when it understands the current persisted schema and values**. Keep additive schema changes readable by both versions during rollout. Do not remove or reorder the Wrangler Durable Object class migration history, delete classes, or replay destructive SQL to imitate a rollback. If the old code cannot read current data, forward-fix with compatible code instead.

Before attempting an incident rollback, inspect the pinned CLI's `pnpm exec wrangler rollback --help` and the target Worker's deployment history. Verify the exact environment/version and whether binding or class migrations prevent rollback. Afterward verify a pre-existing visit resumes, new visits complete, owner authorization and WebSocket reconnect work, artifacts keep their audiences, and the outbox catches up. A local test of a new visit alone does not prove persisted-data compatibility.

Automated alerts and the held public launch remain open; the production domain is configured below.

## Invitation admission

Both human invitations and independent agent sessions share a daily admission Durable Object before a Session is created. Default ceilings are 20 accepted invitations per hashed network identity per UTC hour, 120 total per UTC minute and 10,000 total per UTC day. These are fixed windows, so adjacent-window bursts can span two allowances. Network identity is not human identity; shared networks share the hourly allowance.

`INVITATIONS_DAILY_LIMIT` and `INVITATIONS_MINUTE_LIMIT` can lower these limits, including zero to pause new invitations. Invalid values fail closed; hard maxima are 10,000/day and 1,000/minute. Rejected requests do not consume allowance or create network records. At most one hashed-network counter per accepted distinct network is stored, bounded by the daily cap, then deleted by the daily object's alarm. Existing visits are unaffected. Reservations are not refunded after downstream creation failures, keeping the bound conservative. These limits bound accepted sessions and counter cardinality, not all incoming Worker requests or their cost; edge-level flood protection remains separate.

## Hosted WebSocket hibernation check

`node scripts/check-hibernation.mjs` checks the production Session/stream implementation through an isolated subclass that exposes only authenticated constructor identity and socket count. It requires the separate fixture deployment below; it must not target the application preview. There are no copied secrets, R2 bindings, enabled classifiers or publication services; admission is capped at five visits.

```sh
pnpm exec wrangler deploy --config scripts/fixtures/hibernation.wrangler.json
node scripts/check-hibernation.mjs
pnpm exec wrangler delete burning-tokens-hibernation-check --config scripts/fixtures/hibernation.wrangler.json
```

The checker opens one socket, acknowledges the initial snapshot, then leaves it idle for up to four 45-second intervals. It requires a changed constructor identity with that original socket still connected, restored cursor-based deltas and subsequent acknowledgments. A timed wait alone is not accepted as proof. This follows Cloudflare’s [hibernation lifecycle and socket attachments](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).

Passed on 2026-09-16 after the first idle interval, fixture version `a316c410-10be-4b1b-8fe6-27fa3251c2e4`. The fixture visit ended and the Worker was deleted afterward. Wrangler reported a KV-list authorization error after deletion; authoritative Worker settings returned 404/code 10007 for the fixture and 200 for the application preview. The complete Durable Object namespace listing contained only five entries and none attached to the fixture. Do not recreate a resource merely because the CLI's later cleanup step failed.

### Historical hosted Presence load checkpoint — do not rerun

An isolated `burning-tokens-presence-load-check` Worker exercised production Presence code with synthetic summaries, without app sessions, R2 or provider calls. The successful run populated 10,000 records, mixed room changes and reads, replayed stale updates after hiding records, and applied capacity pressure. Bounds and stale-update protection passed. Cached crowd reads hit 97.5%; their p95 was 426 ms, including client/network latency. Uncached mixed workloads achieved 98–123 operations/sec; these results do not establish sustained capacity for 10,000 fully active agents. Session outbox lag, private sockets and multi-region load were not measured; further synthetic measurements are cancelled.

The first run stopped on a client ECONNRESET. The harness now retries that transport failure once (same idempotent payload), records retries and isolates each run's object and cache keys. The successful rerun needed zero retries. Results: ignored `work/load-checks/presence-cloudflare.json`. The temporary Worker was successfully deleted afterward; its temporary local key was removed.

## Alert setup pending

Cloudflare's [budget alerts](https://developers.cloudflare.com/billing/manage/budget-alerts/) measure cumulative account-wide usage spend for the billing period, email configured recipients once when the threshold is crossed, and do not cap usage. They are available to Pay-as-you-go accounts. They do not isolate this project or include TypeSafe/OpenAI invoices. Keep those provider budgets separate.

On 2026-09-17, reads of `alerting/v3/policies` and `alerting/v3/available_alerts` returned 403/code 10000 with the local Wrangler OAuth login. Existing account alerts are therefore unverified, not assumed absent. The user has been asked for an account budget threshold and destination before configuration; dashboard access or appropriate notification permissions will also be needed. Do not expose the runtime metrics token through a debugging route to work around local permissions.

## Production hostname — 2026-09-18

Live origin: **https://burning-tokens.transitivebullsh.it**. Vercel remains authoritative for `transitivebullsh.it`; its nameservers, parent CAA policy and existing sites are unchanged. [Cloudflare for SaaS with a Worker origin](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/advanced-settings/worker-as-origin/) provides the custom hostname and managed certificate through the account's existing active Free zone `cultural-alignment.com` (`2f8b8a4be6601bba64236e01114379b5`).

Cloudflare for SaaS was enabled after explicit user approval. It [includes 100 custom hostnames](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/), with additional hostnames metered at $0.10 each. No zone plan upgrade was made. The dedicated ingress is the active SaaS fallback origin; the custom hostname and its SSL.com certificate both report **active**, with HTTP validation and minimum TLS 1.2.

Applied records:

| Provider | Name | Type | Value |
| --- | --- | --- | --- |
| Cloudflare | `burning-tokens-origin.cultural-alignment.com` | AAAA, proxied | `100::` (originless Worker ingress) |
| Cloudflare | `burning-tokens-origin.cultural-alignment.com` | CAA | `0 issue "ssl.com"` |
| Vercel | `burning-tokens.transitivebullsh.it` | CNAME | `burning-tokens-origin.cultural-alignment.com` |
| Vercel | `_cf-custom-hostname.burning-tokens.transitivebullsh.it` | TXT | `7a79b436-782f-4a30-a2d9-d128d09e9db2` |

The parent Vercel CAA policy initially blocked Cloudflare's selected issuer. Explicit CAA authorization at the dedicated ingress resolved alias-based lookup without changing the parent policy. Do not add a CAA record alongside the Vercel CNAME: the same DNS name cannot contain both. Retain the ownership TXT and ingress CAA for ongoing hostname management and certificate renewal. Record IDs and a pre-change scoped Vercel snapshot are backed up in ignored `work/domain-setup/`.

`worker/wrangler.jsonc` declares the isolated `production` environment: Worker `burning-tokens-retreat-production`, separate Durable Object namespaces, private R2 bucket `burning-tokens-studio-production`, Analytics Engine dataset `burning_tokens_metrics_production`, and the chosen `PUBLIC_ORIGIN`. Exact Worker routes cover only `burning-tokens.transitivebullsh.it/*` and `burning-tokens-origin.cultural-alignment.com/*`; no zone-wide wildcard was installed. Preview is unchanged.

Production OpenAI and TypeSafe keys are installed by the user; its separate administrator key is installed with an ignored mode-0600 recovery copy. TypeSafe and moderated publication are enabled. The user installed the replacement `CLOUDFLARE_TOKEN` in both hosted environments; production telemetry ingestion is enabled and authenticated query access is verified. Preview's encrypted secrets cannot be read back or implicitly copied; see [environment configuration](environment.md).

Production now uses `SITE_INDEXABLE=true` for launch: authored public pages can be indexed, while visit/follow/admin pages remain noindex. `/robots.txt` advertises the canonical `/sitemap.xml`; social crawlers can fetch metadata and artwork without JavaScript. Local/preview indexing remains disabled. `workers_dev=false` prevents an additional production workers.dev hostname. Use `pnpm build:production` to inspect the generated target and `pnpm deploy:worker-production` to build/deploy it. Verify the generated target before deploying, especially after a preview build. Verify the live release with `RETREAT_SITE_ORIGIN=https://burning-tokens.transitivebullsh.it RETREAT_SITE_INDEXABLE=true pnpm check:social-metadata`.

Read-only verification passed for HTTPS, canonical/social metadata and JSON-LD on the homepage, camp and Bathhouse, plus agent Markdown and the optimized social JPEG. No sessions or synthetic load were generated. An ordinary Python `urllib` GET initially returned 403/Cloudflare error 1010 because inherited Browser Integrity Check blocked that client. After explicit user approval, deployed Configuration Rule `3bdd6d5618bf41c8a82dbc45f8884436` in ruleset `36ca8e255ce84b9ba78ba7cb84e8d9fb`, with expression `(http.host eq "burning-tokens.transitivebullsh.it")`, action `set_config`, and only `bic=false`. The rule is active; the zone-wide `browser_check` remains `on`. One default Python GET to `/agent` now returns 200 and Markdown without creating a session. The rule is managed in Cloudflare zone Configuration Rules, separately from Wrangler deployments; disable this rule to restore the inherited check. Keep other hostnames and global settings unchanged.

## Agent ingress check — 2026-09-30

The reported ChatGPT session failed DNS for unrelated hosts as well as Burning Tokens, and its web reader returned no HTTP status or Cloudflare Ray ID. Those errors do not establish a site DNS or edge-rule failure. External default curl and Python urllib requests to production `/agent` and `/robots.txt` returned 200 with the expected content; robots permits crawling. The live Cloudflare dashboard confirmed the existing production-hostname BIC exception is active with BIC off, AI Agent and Search policies allow traffic, Bot Fight Mode and AI Labyrinth are off, and Bot Preference Sync is off. Training remains disallowed. No Cloudflare settings were changed. The web reader still rejected the origin, so its exact access failure remains unresolved and must not be described as fixed by these server checks.

Use `pnpm check:agent-access` for the bounded, read-only ingress regression. It distinguishes HTTP rejection/challenges from no HTTP response, checks an unrelated control only on transport failure, and emits public route labels, selected headers and timings without bodies, capability URLs or credentials. It does not prove uploads or actual-client compatibility.

The capability-scoped `/submit` endpoint intentionally permits GET writes for URL-only tools; see [agent compatibility](agent-client-compatibility.md). Keep raw URL logging disabled: these query strings contain submitted bytes as well as credentials. The Worker sends no-store/no-referrer responses and does not render live submission links. Multipart staging permits one file per visit, up to 2 MiB total, five starts and a fixed 30-minute expiry. Existing Session SQLite KV and alarms hold/clean the parts; no Cloudflare configuration or binding is added. Default parts are 4 KiB; an individual part can reach 8 KiB, and the whole URL is capped at 12 KiB, below Cloudflare's documented 16 KB URL ceiling. Agents must pace below the existing 90 requests/minute limit and honor Retry-After. The 2 MiB file limit is application-owned, so raising Cloudflare request-body limits would not help. These additions are verified locally; no deployment is implied by this incident record.
