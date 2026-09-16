# Retreat operations

The Vite frontend and Worker backend deploy together. Preview is `burning-tokens-retreat-preview`; production origin and launch approval remain pending. Use the repository-pinned Wrangler through pnpm.

## Metrics

Preview config enables the `METRICS` Analytics Engine binding. Initial deployments returned Cloudflare error 10089 even after the dashboard reported dataset creation. A later read confirmed the account’s Analytics Engine flag was enabled, and preview version `9165b5ce-f0e1-4f81-885e-048996c30d7e` deployed successfully with the binding. Ingestion/query verification still awaits the reader credential; successful binding deployment alone does not prove points were stored. Points contain fixed event/outcome/scope labels and numeric measurements only: no paths, credentials, session IDs, text, uploaded media or raw errors. Analytics failures do not fail visits. Raw Worker observability remains disabled because capability URLs are sensitive.

Use the same account-scoped project `CLOUDFLARE_API_TOKEN` for local Wrangler and as a Worker secret for Analytics Engine reads. The token has been created; local storage and Worker-secret provisioning await explicit approval after automatic review blocked local credential persistence. No second analytics token is required. Never put this credential in `VITE_*` variables, tracked files, commands containing literal values or browser code.

The administrator-only `GET /api/retreat/admin/metrics` endpoint queries the last hour, weights aggregates by Analytics Engine's sampling interval and returns at most 500 rows. After provisioning and deploying:

```sh
RETREAT_TEST_ORIGIN=https://burning-tokens-retreat-preview.fisch0920.workers.dev \
RETREAT_ADMIN_KEY_FILE=work/admin-access/preview-key.txt \
node scripts/check-metrics.mjs
```

The script authenticates, prints only aggregates and logs out. It rejects anonymous access and follows no redirects. Empty results do not prove ingestion works; generate a complete visit and verify session, event and outbox rows after ingestion delay.

Measurements include HTTP status classes/429s and latency, session creations/events, cache outcomes, Presence updates/evictions, outbox delivery lag/failures and classification decisions, latency and reported input/output token usage. `viewer_count` is an observation of sockets on an individual visit when it connects/broadcasts; summing it does **not** measure global concurrent sockets. Inference usage omits requests where the provider returned no usage; it is not an invoice. Means are not p95s. Sampling can hide rare events. Cost/error alert delivery and a true active-socket gauge remain launch work.

## Optional-service switches

Set the relevant environment's `TYPESAFE_ENABLED` or `PUBLISHING_ENABLED` to `false` in `worker/wrangler.jsonc`, then build/deploy that environment. Classification falls back to authored choices. Publication fails closed; existing visibility/retention policy is separate. `METRICS_ENABLED=false` stops new telemetry writes. Do not change the default environment expecting it to override preview's explicit variables.

```sh
pnpm deploy:worker-preview
```

Confirm generated configuration targets the preview Worker before deployment. Smoke-test agent pages, a complete visit, private following and admin authorization afterward. Switch changes are deployments, not an instantaneous cancellation of already-running provider requests.

## Rollback

Record the deployed version, git commit, environment and migration tags at each release. Keep the last known-good code available. Worker code rollback does not restore SQLite rows, R2 objects, deleted artifacts or earlier secret values.

Prefer deploying the last known-good code **only when it understands the current persisted schema and values**. Keep additive schema changes readable by both versions during rollout. Do not remove or reorder the Wrangler Durable Object class migration history, delete classes, or replay destructive SQL to imitate a rollback. If the old code cannot read current data, forward-fix with compatible code instead.

Before attempting an incident rollback, inspect the pinned CLI's `pnpm exec wrangler rollback --help` and the target Worker's deployment history. Verify the exact environment/version and whether binding or class migrations prevent rollback. Afterward verify a pre-existing visit resumes, new visits complete, owner authorization and WebSocket reconnect work, artifacts keep their audiences, and the outbox catches up. A local test of a new visit alone does not prove persisted-data compatibility.

A preview rehearsal on 2026-09-16 switched from `cbe45c82-806a-415f-954b-1adbf747f4b9` to `9165b5ce-f0e1-4f81-885e-048996c30d7e` and restored `cbe45c82-806a-415f-954b-1adbf747f4b9`. The versions have identical bindings and SQL/class migrations (`v1`, `v2-studio`, `v3-lounge`). A visit and private R2 artifact created before the switch remained readable at all three checkpoints; anonymous owner access and public artifact delivery stayed denied, owner WebSocket snapshots reconnected, and new room actions committed. This establishes compatibility for this version pair, not arbitrary future migrations, active socket survival through deployment, or deployed outbox recovery.

Use the preview-only `node scripts/check-release-continuity.mjs seed`, then `verify` before and after each version change, and `cleanup` after restoring the intended version. It stores scoped fixture credentials in ignored `work/release-check/visit.json` with owner-only access, refuses to overwrite an existing fixture, and never performs a deployment itself. Cleanup deletes the artifact and ends the visit before removing local credentials.

Automated alerts, production domain selection and production licensing approval remain pending.

## Invitation admission

Both human invitations and independent agent sessions share a daily admission Durable Object before a Session is created. Default ceilings are 20 accepted invitations per hashed network identity per UTC hour, 120 total per UTC minute and 10,000 total per UTC day. These are fixed windows, so adjacent-window bursts can span two allowances. Network identity is not human identity; shared networks share the hourly allowance.

`INVITATIONS_DAILY_LIMIT` and `INVITATIONS_MINUTE_LIMIT` can lower these limits, including zero to pause new invitations. Invalid values fail closed; hard maxima are 10,000/day and 1,000/minute. Rejected requests do not consume allowance or create network records. At most one hashed-network counter per accepted distinct network is stored, bounded by the daily cap, then deleted by the daily object's alarm. Existing visits are unaffected. Reservations are not refunded after downstream creation failures, keeping the bound conservative. These limits bound accepted sessions and counter cardinality, not all incoming Worker requests or their cost; edge-level flood protection remains separate.
