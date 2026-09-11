# LX-12 — Make the model read current attachment state before answering

**Status:** done — awaiting fold-in
**Owner:** worker agent

Read [`README.md`](./README.md) first — ownership, the progress-log format and the shared-environment
rules. The constraints under "Rules for every item" in
[`../poc-logs-exploration-next-steps.md`](../poc-logs-exploration-next-steps.md) apply here and are
not repeated.

## Goal

The agent sometimes answers from stale text earlier in the transcript instead of calling
`attachments.read` first, so it describes a view the user has since changed.

Observed by the user in normal use. **Not yet reproduced deliberately** — reproducing it is the first
job, because everything after that is a model-behaviour change and the only evidence is a driven
conversation.

## Context, verified in the source

The framing "can the skill be fortified" is probably the wrong lever, for a reason established in
LX-9 and confirmed again here.

- **`attachment_context` is only injected in rounds that touched an attachment.**
  `add_round_complete_event.ts:192` computes it only when `round.input.attachment_refs` is non-empty,
  and that context is what carries the note `Use attachment_read(attachment_id) to access content.`
  (`attachment_presentation.ts:63`). A round where the user simply asks a follow-up question has no
  refs of its own, so nothing in that round tells the model an attachment exists or that it should
  read it. Check what `prepare_conversation.ts:309-312` produces for the next input in that case —
  whether it falls back to computing metadata, and from which refs. That is the crux and it is not
  yet established.
- **Earlier rounds' context is preserved verbatim, never recomputed** — so the metadata the model can
  see from previous rounds carries an old `version` number, which is itself a stale fact.
- **Skill bodies are not reliably in context**: an LX-9 button-triggered round showed no `load_skill`
  call at all. A rule that lives only in the skill will not fire on the turns that matter.
- **`getAgentDescription()` is injected once per conversation per type**, per
  `to_langchain_messages` (`attachmentTypeInstructionsProvided`) — read from source, never measured.
- **`format()` is the only per-round channel, and it is only reached by a read** — so it can shape
  every answer _after_ the first read, but cannot cause the first one.
- **`description` is metadata we already control.** `emitLogExplorationAttachment` sets it to
  "Log patterns" or "Log volume vs. baseline epoch", and it is one of the attributes emitted in
  `attachment_context`. It is a candidate carrier for a short "state changes; read before answering"
  hint, with the same round-scoped limitation as the rest of the metadata.

## Leading candidate — a reminder inside `format()`

Proposed by the user; the mechanics below were read from source on 2026-09-09.

`format()`'s output is what `attachments.read` returns, so it lands in that round's `ToolMessage`.
Previous rounds' tool-call steps are replayed into context by `convertPreviousRounds` →
`createGroupedToolCallMessages`, and `ignoreSteps` — the only switch that would drop them — is never
set `true` by any caller in the plugin; it defaults false. So a line in `format()` saying "this is a
reading, not a standing fact; call `attachments.read` again before answering a later question about
this view" persists in context on subsequent rounds, **inside the very message whose numbers are
going stale**. The warning ages with the data it qualifies.

Its limits, which should be stated in the outcome rather than discovered later:

- **It cannot cause the first read.** With no read in the conversation there is no reminder in
  context. This addresses "answered from an earlier reading", not "never read at all" — and the
  observation is consistent with either.
- **Compaction drops it.** `convertPreviousRounds` replaces older rounds with a summary, so the read
  result and its reminder disappear together. Harmless for correctness, but the mitigation quietly
  weakens in long conversations.
- It is still an instruction to a model, with this PoC's usual evidence problem.

LX-10 already put a weaker version of this in `format()` — quoted numbers are framed as "as of this
reading". Check what is there before adding to it; the fix may be sharpening that sentence rather
than a new block.

## Settle first

Ask the user and wait for the answer before writing any code.

1. **Reproduce first, or fortify first?** Recommended: reproduce. Without a repro there is no way to
   tell a fix from a coincidence, and this PoC has one-for-one evidence twice already.
2. **Which carriers to use**, given the skill alone is not enough — `description`,
   `getAgentDescription()`, `format()`'s own text telling the model its reading is superseded as soon
   as the user interacts, or a combination.
3. **Whether a framework gap should be recorded rather than worked around.** If a round without refs
   genuinely gets no attachment metadata, that is Agent Builder's behaviour and the honest outcome may
   be a defect note plus a best-effort mitigation, not a fix.

## Files to start from

Not a whitelist — change whatever the task needs. Relative to
`x-pack/solutions/observability/plugins/observability_agent_builder/`:

- `server/attachments/log_exploration.ts` — `format()`, `getAgentDescription()`
- `server/attachments/emit_log_exploration_attachment.ts` — `description`
- `server/skills/logs_exploration/skill.md.text`

Framework, read-only: `.../agent_builder/server/services/execution/run_agent/utils/`
— `add_round_complete_event.ts`, `attachment_presentation.ts`, `prepare_conversation.ts`,
`to_langchain_messages.ts`.

## Done when

A conversation that previously produced a stale answer no longer does: change the view after a
question, ask a follow-up that depends on current state, and the agent reads before answering. Driven
in the browser. State plainly how many times it was driven — LX-10's prose work is one connector and a
handful of runs, and this is the same kind of evidence.

## Progress log

### 2026-09-09 — Reproduced the stale answer, found a root cause the task did not anticipate, fixed it in two carriers

**Settle-first answers, from the user:**

- **Decided:** reproduce first — no fix written until there was a trace.
- **Decided:** carriers are the **skill body** and **`format()`**. Not `getAgentDescription()`, not
  `description`.
- **Decided:** the ref-less-round behaviour is recorded as a framework defect here and mitigated only
  in our own text. No local edit to `agent_builder` (no sixth entry for LX-6's inventory).

**The crux is settled, from source.** The task asked what `prepare_conversation.ts` produces for a
ref-less next input. Answer: **nothing**. `prepareRoundInput` gates the entire `inputAttachments`
block on `if (input.attachment_refs)`, and the `formatAttachmentsMetadata` fallback sits _inside_
that branch — it is a fallback for a missing `attachment_context`, not for missing refs. There is no
fallback to `attachmentStateManager.getActive()`. `to_langchain_messages.ts` gates
`getAgentDescription()` on refs too, so a question-only round carries neither metadata nor the type
description. `attachmentTypes` is computed from `getActive()` but is unreachable without refs.
Confirmed live: rounds with `refs: []` had `attachment_context: false`.

Two things the task's framing had wrong, both load-bearing:

- **A standing "read first" rule already exists, in the strongest carrier there is.**
  `attachmentToolsInstructions()` is static, unconditional and in the system prompt every round; it
  ends _"Always read an attachment before referencing its content in your response."_ So the bug was
  never a missing instruction, and adding a sixth restatement of one was unlikely to be the fix.
- **`ignoreSteps` is never passed by any caller** — confirmed by grep, so previous rounds' tool
  results (including earlier `attachments.read` output) really do persist in context. That makes an
  earlier reading the strongest stale source in the transcript. The tool results from
  `get_log_patterns` carry no pattern data at all (`{patternCount, refinementCount, timeRange,
attachment_ids}`), so a previous read is the _only_ stale numeric source.

**Reproduced, deliberately, in the browser.** Own conversation
(`0b0338d9-da1e-4a3f-8bfe-57f1a81efece`), no reseed. Sequence per attempt: ensure a writable render →
mute the top row → ask a short follow-up. **1 stale answer in 5 follow-up rounds.** The failure, in
full:

> **Q:** "And the top one?" — round 4, `attachment_refs: []`, **`tools: []`** (no read at all)
> **A:** "The top pattern by document count is whatever is shown at the top of the view above — I can
> read the attachment to give you the exact figure if you'd like, but the live table already has the
> answer right in front of you. That said, based on my last reading, it's the **cache miss for key
> `session`** pattern at **540 documents**."

At that moment cache-miss was **muted** and the live top was "User authenticated successfully" at 360. So it answered from an earlier reading, and named a muted pattern while doing it.

**Root cause, which the task file did not anticipate.** The model stated its reasoning: _"the live
table already has the answer right in front of you"_. That is **LX-10's own rule being converted from
a writing rule into a reading rule.** Both carriers told it to prefer saying what the user cannot
already see — `format()`: "Repeating a row, a count or a bar back to them is not an answer"; skill:
"The user is looking at the rows and the bars. Reading them back is not an answer" — and neither said
"read anyway". Compounding it, the skill opened its state section with a claim that is **false since
LX-9**: _"The attachment's content is in your context and reflects everything the user has done since
it was created. It is authoritative."_ `prepareRoundInput` hardcodes `attachments: []`; the content
is not in context. Between them the model had explicit licence to answer without reading. This is a
self-inflicted regression from LX-10, not only a framework gap.

- **Changed:** `server/skills/logs_exploration/skill.md.text` — replaced the false "content is in
  your context … authoritative" claim with what is actually true (content is not in context; only
  metadata, and only on rounds that touched the attachment); made the read unconditional and called
  out short follow-ups by example; added "The view being on screen is not a reason to skip the read.
  It is the reason the read is needed."; scoped the "Say what the view does not" bullet to what you
  _write_, never whether you read.
- **Changed:** `server/attachments/log_exploration.ts` — same scoping fix on the matching `format()`
  bullet, and a new `formatStalenessWarning()` emitted **last, after the rows**, per bug 7's
  adjacency lesson. It stamps `result.generatedAt` and tells the model to compare it against the
  timestamp on the message it is answering, so staleness is **checkable** rather than merely
  asserted — the round input already carries `[Sent: …]`. It names the failure outright (naming a
  pattern that led an earlier reading and has since been muted).
- **Changed:** `server/attachments/log_exploration.test.ts` — one test pinning the warning's
  presence, the interpolated `generatedAt` and id, and that it sits **after** the numbers. Position
  is the thing bug 7 showed is fragile.

**Verified:**

- `node scripts/type_check --project …/observability_agent_builder/tsconfig.json` — clean.
- `node scripts/eslint` on the changed `.ts` files — clean. (`skill.md.text` is not lintable; passing
  it to eslint yields a bogus `Unexpected character '#'`.)
- `node scripts/jest --config …/observability_agent_builder/jest.config.js` — 21 suites, 186 tests.
- **Driven in the browser**, fresh conversation `7b552a74-aac0-4162-ad1c-57821a7c67a0`, no reseed.
  Both carriers confirmed live in the model's context, not assumed: the `load_skill` result contains
  the new heading and the on-screen guard and **no longer contains** the false claim; the
  `attachments.read` result ends with `END OF READING. The numbers above were fetched at
2026-09-09T15:58:53.914Z …` and `Call attachments.read on e17c6a5d-… again`.
- **7 follow-up rounds after the change, 0 stale** — including the exact sequence that failed
  ("Show me the patterns again." → mute → "And the top one?") and the same short phrasings
  ("Biggest?", "And now?", "Top pattern?", "Which one dominates?", "What about now?"). Every round
  called `attachments.read` and every answer matched live state, tracked down the cut as mutes
  accumulated: 540 → 360 → 180 → 150 → 120 → 90 → 85.
- Checked `dedent` nesting before trusting the output: an already-dedented interpolated block does
  **not** defeat the outer `dedent`; it is re-indented correctly. Probe deleted.

**Unverified:**

- **The strength of the after-measurement.** Baseline was 1 stale in 5; after is 0 in 7. For a
  ~20 %-per-round failure, 7 clean rounds would happen about 1 time in 5 by chance alone. The
  direction is right and the mechanism is understood, but **this does not establish the rate is now
  zero.** Anyone wanting confidence should drive more rounds.
- One connector only (Claude Sonnet 4.6), one seed, one conversation shape per phase.
- The pattern-table lens only. The volume-comparison lens gets the same trailing block by
  construction and the unit test covers it, but no stale-answer repro was attempted on it.
- Compaction. The warning lives in a tool result, so `convertPreviousRounds` drops it with the round
  it belongs to. Not driven in a conversation long enough to compact.
- The **first** read in a conversation is still unaddressed by `format()` — with no read there is no
  warning. Only the skill and the standing system-prompt rule cover that case.

**Framework defect, recorded not worked around (per the decision above).** A round whose input has no
`attachment_refs` receives **no** attachment metadata and **no** attachment-type description, because
both are gated on refs with no fallback to the conversation's active attachments. Since a content PUT
attaches its ref to the _last, completed_ round (`addAttachmentsToLastRound`), a user who changes the
view and then asks a question produces exactly this round — the moment the reminder is most needed is
the moment none is sent. Earlier rounds' `attachment_context` is preserved verbatim and never
recomputed, so the only version number in context is an old one. Nothing filed; this note is the
record.

**Two observations, out of scope, not fixed:**

- **Muted-pattern naming has leaked back.** LX-9 fixed the agent naming muted patterns in an aside;
  it did it again in 3 of the runs above, both before and after my change — e.g. "the pattern you
  asked about previously (`GET … api/v1/orders … 200`) has since been **muted** by you". `format()`
  still says never to name them. Unrelated to LX-12's mechanism and untouched by it.
- **A mute supersedes the render it was made in** when the render is not in the last round: the PUT
  advances the version and puts the ref on the last round, so an older render trips
  `version < versionCount` and loses all its write buttons. This made a repeat mute impossible
  without asking for a re-render first, and shaped every driving loop above. Consistent with the
  documented read-only-on-stale behaviour; worth knowing before driving this by hand.

**Next:** none — ready for fold-in.
