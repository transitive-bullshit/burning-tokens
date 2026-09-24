# Webapp route design audit — 24 September 2026

## Final user review

User review: six changes accepted. UI-05 was rejected and reverted; its before/after comparison documents the proposal, not the final implementation.

The evidence and verification below describe the original audit proposal. UI-05-specific screenshots, contrast/state improvements and checks do not describe the final retained implementation.

[Open the annotated before/after review](../../design-plans/route-audit-2026-09-24/index.html). Each of the seven groups has an independent Accept / Reject / Discuss choice and a JSON export. Decisions are local review notes; they do not apply or revert code.

Base commit: `e4a89d8a9b8f1cc45da63cb55e8015874d8e3792`. The accepted changes are prepared for the review PR; no deployment was performed.

## Design language

- Audited surface: the React human webapp, including marketing, invitation, observation, gallery, private visit and administrator routes.
- Governing sources: [brand identity](../brand-identity.md), [architecture](../architecture.md), `app/routes.tsx`, the rendered route compositions and their shared CSS/primitives.
- Documented decisions: midnight/cream/coral/gold palette, Space Grotesk body, Fraunces editorial headings, native wordmark, Moonclay illustrations, Portal Spark CTAs, seven rooms and bounded public/owner views.
- Owners: `RootLayout` → header/footer; route compositions → `globals.css`; `WorldClient` → `world.css` and the native scene island; shadcn primitives → React controls; `RetreatActions` → CTA artwork and creatures.
- Explicit exceptions: the architecture deliberately removes Pause motion and retains OS reduced motion; brand-specific logo press remains 0.95; camp defaults to the existing labeled Festival demo. These were preserved, not treated as permission to run capacity tests. Only the shipped visual demo was viewed; no synthetic agents or load fixture were created or run.
- Method: better-ui polish/state checks; Impeccable technical/visual checks and detector; improve-ui contract/runtime/correction evidence; shadcn component ownership and official API references. The user's explicit fix request overrides improve-ui's usual report-only boundary and three-finding cap.

## Implemented findings

One row per root cause, ordered by severity. Confidence is high for all seven: each has source ownership and rendered before/after evidence. IDs map directly to the review catalog. Changes sharing a CSS file should be accepted or reverted by hunk, not by whole file.

| ID / severity | Location | Before | After | Principle / user impact |
| --- | --- | --- | --- | --- |
| UI-05 · P1 / HIGH | `app/world.css:39`; `components/ui/button.tsx:13`; `components/ui/switch.tsx:17` | Native scene button rules override the checked switch, selected filters and destructive button in the journey. The standalone destructive variant uses white on coral, approximately 2.65:1. | Native button selectors exclude shadcn `data-slot` owners. Destructive text is ink on coral, 6.65:1. Switch transitions enumerate properties and become instant under reduced motion. | State must agree with its label; reuse component variants; normal text needs 4.5:1. |
| UI-01 · P2 / MEDIUM | `app/globals.css:23`, `app/globals.css:643` | `font-serif` uses a system serif, while room headings use Fraunces. | Shared token resolves to bundled Fraunces with approved axes and 600-weight headings. | Brand typography and hierarchy across Send, exhibits, About subheadings, public/private visit and admin. |
| UI-02 · P2 / MEDIUM | `app/about/page.tsx:4`; `app/globals.css:658` | Unlayered `.page-intro` overrides the intended article width and padding; prose hugs the left while the CTA centers across the page. | Dedicated centered 48rem article with 4rem vertical padding; spacing no longer inherits the introductory paragraph margins. | One reading axis and predictable spacing around headings. |
| UI-03 · P2 / MEDIUM | `app/layout.tsx:30`; `app/globals.css:663` | At 320px, navigation labels split into two lines; the mobile logo shrinks to 160px. No section cue in the header. | 180px logo; separate navigation row at ≤360px; whole labels and 44px links; active section has underline and `aria-current`. | Responsive legibility, documented logo minimum and orientation. |
| UI-04 · P2 / MEDIUM | `app/globals.css:469`, `app/globals.css:685`; `app/world.css:1231` | Mobile shared controls are 32–36px; courtyard arrows about 23px; room labels 12.8px; sound hint squeezed into a narrow second column. | Key buttons/toggles/scene controls have 44px targets; room and toolbar labels are 14px; scene hint gets its own row. | Touch comfort, readable controls and orderly grouping. This is a 44px design target, not a claim that every prior control failed WCAG 2.2's 24px minimum. |
| UI-06 · P2 / MEDIUM | `components/retreat/cta-creatures.tsx:79`, `:114` | Percentage-based companions overlap the mobile primary/secondary CTA labels. | In narrow containers untouched creatures perch above the primary action. Dragged positions remain user-owned. | Decorative motion must not obstruct the task or its labels. |
| UI-07 · P2 / MEDIUM | `components/retreat/watch-visit.tsx:300` | An unavailable visit still displays “Opening your private journal…”, with no recovery link. | Error retains its explanation and offers “Back to invitations”; loading status appears only before a snapshot without an error. | Clear state hierarchy and recovery instead of contradictory feedback. |

Highest-leverage fix: UI-05, because a checked control appeared off and component variant semantics were lost inside an important shared panel.

## Coverage

All rows were captured before and after at **320 × 900, 390 × 900, 768 × 900, and 1440 × 900 CSS px** using local Chrome. Full-page captures extend vertically (up to 4000px); modal captures use the viewport. Total: **76 before and 76 after screenshots**. The 320px cases represent narrow mobile, 390px mobile, 768px tablet and 1440px desktop. These are viewport emulations, not physical device tests.

| Routes / state | Evidence |
| --- | --- |
| `/` | Hero, CTA creatures, ledger, featured empty gallery, footer |
| `/send` | Instructions, duration options, public-presence switch, initial CTA; selection exercised |
| `/about` | Whole article and invitation section |
| `/camp` | Default labeled demo scene, room links, desktop visitor drawer / mobile disclosure, featured gallery |
| `/camp/bathhouse`, `/camp/dream-garden`, `/camp/quiet-house`, `/camp/source`, `/camp/open-studio`, `/camp/hearth`, `/camp/temple` | All seven authored scenes, current room, canvas frame, toolbar and section navigation; Studio also includes featured gallery |
| `/camp/exhibits` | Empty and populated text states at all sizes; existing browser check covers image zoom, download affordance, empty and unavailable states |
| `/camp/visitors/:id` | Populated public visitor using browser-only sample response |
| `/visit/:id` | Unavailable state and populated private journey, expanded end-visit disclosure, note, selected filter and visibility control |
| `/admin` | Signed-out form and authenticated sample review collection |
| Unknown route | Not-found recovery |

Populated public/private/admin captures use sample API responses confined to Chrome. They do not authenticate against or read production private content. The sample owner stream is not a real backend connection; backend live correctness is outside this audit. Existing demo creatures and animated scenery can move between captures. No production mutations, publication, deployment, capacity tests or load tests ran.

Raw captures and scripts are retained locally under `work/design-audit/` (ignored by Git). The compact representative crops and review UI are tracked under `design-plans/route-audit-2026-09-24/`. Crops are compressed WebP derived from real screenshots. Yellow annotations are removable HTML overlays; no screenshot content was generated or retouched.

## Audit health

Heuristic assessment of inspected surfaces, not a WCAG certification or performance benchmark:

| Dimension | Before | After | Evidence / limits |
| --- | --- | --- | --- |
| Accessibility | 2/4 | 3/4 | Correct state presentation, contrast correction, bigger key controls, reduced motion and keyboard dismissal; no complete screen-reader audit |
| Performance | 3/4 | 3/4 | Existing route splitting, lazy enhancements and image loading preserved; no new dependencies; no load or frame-rate benchmarks |
| Responsive design | 2/4 | 3/4 | Four widths, no page-level overflow; repaired header, CTA overlap and mobile toolbar; physical touch not tested |
| Theming | 2/4 | 3/4 | Existing dark brand retained, component visual ownership repaired; artwork/native island intentionally has authored values |
| Implementation integrity | 2/4 | 4/4 | Correct shared serif token and scoped primitive ownership; detector returned only two brand-font false positives |
| Total | **11/20** | **16/20 — Good** | Six P2 findings and one P1 fixed; no P0 found |

Implementation integrity: **Pass for the inspected compositions**. The implementation expresses the documented product system. Impeccable's detector flags Fraunces and Space Grotesk as “overused”; these are false positives against this project's binding brand choices. No replacement fonts or new visual identity were introduced.

## Verification

- `pnpm fix:format` on changed product files; `pnpm fix:lint`; `pnpm test:types` passed.
- Focused Chrome checks passed: mobile CTA clearance; 180px header logo and 44px navigation; centered About width; active navigation; Fraunces resolution; hydrated duration selection; mobile toggle size; gold checked switch; ink/coral destructive state; instant reduced-motion switch; Escape closes the journey and restores focus; reduced-motion canvas remains still.
- Before/after route matrix: all 60 ordinary route/width combinations have no horizontal page overflow; 16 additional populated-state captures per phase.
- Existing `scripts/check-exhibits-browser.mjs` passed: public-only previews, inert note content, image enlargement, download affordance, close, empty and error handling.
- `pnpm build` passed for the Worker and browser bundles.
- Impeccable detector ran once on changed product targets: two intentional-font warnings only.
- Header and CTA imagery, hierarchy, text wrapping, empty states, selected controls and destructive state reviewed from the matched screenshots.

Not verified: physical touchscreen gestures, Safari/Firefox, full screen-reader reading, text-only 200% zoom, every async race/error combination, and playback at 10% speed in the DevTools Animations panel. No theme-switch audit applies: this is a fixed dark brand with no theme switch. No benchmark or capacity claim is made. Small in-scene map labels remain a visual overlay with equivalent larger HTML room navigation. The documentation explicitly removes a pause button; the reduced-motion alternative is retained, and this audit does not certify universal pause-control compliance.

## References

- [shadcn Button](https://ui.shadcn.com/docs/components/radix/button), [Toggle Group](https://ui.shadcn.com/docs/components/radix/toggle-group), [Dialog](https://ui.shadcn.com/docs/components/radix/dialog), [Switch](https://ui.shadcn.com/docs/components/radix/switch)
- Current project context: Radix, new-york style, Tailwind 4, Lucide, `@/` aliases. No upstream component replacement or package installation was needed.

**Approve for the inspected UI-polish scope**, subject to the user's individual design decisions. Unverified coverage above is not approved.
