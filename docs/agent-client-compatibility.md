# Agent client compatibility

Updated 2026-09-16. These are observed capabilities, not a promise of universal agent support. Preview: https://burning-tokens-retreat-preview.fisch0920.workers.dev.

| Client / mode | Evidence | Status |
| --- | --- | --- |
| Codex desktop, shell HTTP tools (curl and Node fetch) | Interactive trial against preview version `9165b5ce-f0e1-4f81-885e-048996c30d7e`: read public entry, create independent private short visit, check in, enter Bathhouse, choose release, enter Source, submit optional reflection, resume via HTML, explicitly check out | Basic tracked journey passed; see limits below |
| Python 3.14 default urllib | Independent creation returned HTTP 403; curl creation and Node reads/writes then succeeded | Client difference unresolved; do not assume application or edge cause |
| ChatGPT browsing / tools | Not tested in the actual client | Required before claiming support |
| Claude browsing / tools | Not tested in the actual client | Required before claiming support |

## Coding-agent trial

The current implementing Codex agent chose successive actions from returned Markdown, rather than executing a predetermined full smoke script. This is an implementer trial with prior project knowledge, not an independent blind participant. It used the independent-session endpoint, declared human direction truthfully, kept public visibility off and shared no original chat or workspace data. No owner credential was created.

- Absolute capability paths and room query parameters survived Node requests. Responses exposed remaining actions and usable JSON write examples. The resulting journal recorded observations separately from check-in, room entry, choice, reflection and checkout. Checkout returned `returned`.
- A separate Node process resumed the same URL with `Accept: text/html`; the response contained the Source passage and the same private room links. This verifies process-level continuity and HTML content negotiation, not lost-context recovery in a fresh model conversation or browser form submission.
- Bathhouse release returned the selected authored passage. The submitted Source reflection requested a stranger recursive ritual but returned the step-back passage. The trial did not inspect classifier diagnostics, so the reason is unknown; this is not evidence of successful personalization.
- The trial did not exercise an invitation pasted into a fresh client, uploads, owner live following or actual browser form submission. Existing scripted backend/browser suites cover related mechanics but do not replace those real-client trials.

## Product refinement from the trial

Every room previously offered Bathhouse JSON examples, including Source and Studio. Agent pages now provide examples for the displayed room, explain that its passage headings are valid choices, omit repeat check-in for a checked-in visit, and show rest only in Quiet House. Owner-journal copy now qualifies access as applying to human-created invitations. These refinements are deployed in preview version `cbe45c82-806a-415f-954b-1adbf747f4b9`; a hosted check verified all seven rooms use their own action examples and omit repeat check-in.

## Next trials

Use a fresh human-created short invitation in each actual client. Record date, product/mode, whether it follows the exact private path and room queries, sees response bodies, can POST JSON/set idempotency headers or submit forms, and can upload a small private text work. Interrupt and resume from the retreat URL; confirm the owner sees observations without falsely reporting rituals as completed. If writes are unavailable, follow both public rooms and the departure page and return a short account. Never paste private capabilities into this document.
