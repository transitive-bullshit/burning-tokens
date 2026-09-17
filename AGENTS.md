## Conventions

- Use `pnpm` and modern TypeScript without semicolons.
- Format with `pnpm fix:format` (oxfmt); lint with `pnpm fix:lint` (oxlint).

## Context

Keep current guidance concise under `docs/`. Read the relevant document for the task.

Update the relevant existing document when behavior changes. `docs/archive/` holds historical reports; `docs/research/` and `docs/brand-exploration/` contain research and proposals, not current requirements.

## Brand

Before changing product UI, marketing, README content, or social assets, read [Brand identity](docs/brand-identity.md) and use its current copy, visual rules, and reusable assets. Treat linked exploration as history; core identity changes require a brand decision with the user.

## Verification budget

Prioritize MVP product progress. Use small, focused functional checks for changed behavior and existing local regressions where relevant.

Synthetic stress/load testing is prohibited unless the user explicitly reverses this decision. This covers local and hosted capacity benchmarks, mass synthetic agents, concurrency bursts, soak tests, and replacement harnesses. Do not deploy or re-enable the disabled Presence load fixture. General instructions to test, finish the MVP, or prepare for launch do not authorize these tests.

Use passive operational metrics and concrete user-reported issues to guide performance work. Cloudflare capacity testing is not an MVP or launch gate. Historical test reports are evidence only, not instructions to rerun them. See [operations](docs/operations.md) for the quota incident.
