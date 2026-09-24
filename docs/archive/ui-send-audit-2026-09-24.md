# Send and invitation handoff audit — 24 September 2026

## Final user review

User review: all four Send changes accepted and retained.

All four proposed groups are included in the final implementation.

[Open the annotated before/after review](../../work/design-plans/send-audit-2026-09-24/index.html). Four individually reviewable groups, with local Accept / Reject / Discuss decisions and JSON export. This extends the [major-route audit](ui-route-audit-2026-09-24.md); its earlier screenshots remain unchanged.

## Design language and evidence

Scope: `/send`, `Invitation`, the existing owner stream and transition to `/visit/:id`. Governing sources: current brand identity, architecture, agent-client compatibility notes, rendered states and installed shadcn primitives. Preserve the existing palette, fonts, options, invitation API, privacy defaults and automatic arrival routing. Explicit exceptions: none additional to the route audit.

The audience is a human moving between this site and a separate agent chat. The site can observe clipboard success and an agent opening its link; it cannot observe the human pasting or sending a message. Copy must never be presented as proof of arrival. No real-client compatibility claims were added.

Used better-ui, Impeccable's clarification guidance, improve-ui's contract/runtime/correction evidence, and shadcn Field, Textarea, Button and Alert composition. The user's implementation request takes precedence over improve-ui's report-only workflow.

## Changes

| ID / severity | Location | Before | After | Why / confidence | | --- | --- | --- | --- | --- | --- | | SEND-01 · P2 / MEDIUM | `app/send/page.tsx`; initial branch in `components/retreat/invitation.tsx` | Long static instructions and agent examples precede the actual form. | Short overview, immediate numbered setup, clear description of what creating an invitation produces. Compatibility detail and reflection guidance move into a supporting disclosure. | Progressive disclosure: the current task gets priority. High confidence from mobile screenshots. | | SEND-02 · P2 / MEDIUM | Generated-prompt branch and `copy()` in `components/retreat/invitation.tsx` | Prompt has a hidden label, sits below old instructions, and competes with a Watch action. Copied lasts three seconds. Current invitation repeats in recent visits. | Focus moves to step 2; a leading Copy prompt button, visible field label, bounded prompt height and persistent paste-and-send confirmation clarify the handoff. The current invitation is excluded from previous visits. | One primary next action; copying and sending stay distinct. High confidence from screenshots and browser interaction checks. | | SEND-03 · P2 / MEDIUM | Arrival section in `components/retreat/invitation.tsx` | Gate/connection wording does not clearly explain the observed condition or what to do while waiting. | Separate step 3 names the wait, asks the human to return to this tab and explains automatic navigation. Arrival errors are shown. Troubleshooting holds tool-access advice, reuse of the same invitation and the optional manual visit link. | Honest status without simulated progress or a false Sent state. High confidence; unchanged `lastSeen` routing verified with browser sample events. | | SEND-04 · P2 / MEDIUM | Clipboard catch and recovery in `components/retreat/invitation.tsx` | Generic gate alert, manual selection left to the human, stale copy error can survive a successful retry. | Specific adjacent alert; focus and full text selection for manual copying; successful retry clears error. Manual-copy status supersedes prior copied feedback. | Actionable recovery with no duplicate invitation or lost prompt. High confidence from denied-clipboard checks. |

## Before/after evidence

Captured **16 before + 16 after screenshots**: setup, generated prompt/waiting, successful copy and failed copy at **320, 390, 768 and 1440px**. Same local app and browser-only sample invitation/stream responses. Prompts contain an unusable `example.test` link, not real credentials. Recent-visit sample state is present in some setup captures; the current invitation is deliberately omitted from the new ready state.

Raw PNGs and capture/verification scripts: `work/send-audit/` (local, ignored). Local, ignored representative WebP crops: `work/design-plans/send-audit-2026-09-24/images/`. Comparisons crop corresponding task regions at their respective vertical positions because the main improvement moves those regions upward. Yellow boxes are removable HTML annotations. The focus ring on the new step-2 heading and selected textarea text are real UI states.

## Verification

- Four-width browser pass: create → ready → copy → clipboard denial → retry → sample arrival. No real invitation creation or external message sending.
- Focus on the generated-prompt heading, exact whole-prompt copying, confirmation still present after 3.2 seconds, full-text selection on denial, retry clearing the error, remaining on Send after copying, and automatic visit navigation after an observed arrival are checked.
- Current choices and backend request shapes are unchanged. The private prompt is not persisted in local storage.
- Impeccable detector: no findings on the two changed product files.
- Formatting, lint, TypeScript and production build are checked before handoff.

Not verified: actual OS clipboard permission prompts, physical-device selection menus, full screen-reader reading, or sending the invitation to ChatGPT/Claude/other actual clients. Browser clipboard and arrival behavior use fixtures; these checks do not establish third-party agent compatibility. No load or capacity tests ran.

**Approve for the inspected UI-polish scope**, subject to individual design review. No high-severity issue remains in the inspected handoff states; unverified coverage is not approved.
