# LX-9 — A per-view global action, not one "Summarize remaining patterns"

**Status:** done — awaiting fold-in
**Owner:** unassigned

Read [`README.md`](./README.md) first — ownership, the progress-log format and the shared-environment
rules. The constraints under "Rules for every item" in
[`../poc-logs-exploration-next-steps.md`](../poc-logs-exploration-next-steps.md) apply here and are
not repeated.

## Goal

The global action offered on the attachment matches the active view. "Summarize remaining patterns"
is meaningless on a volume comparison; that lens needs its own agent-turn action.

## Context, verified in the source

- `log_exploration_attachment.tsx` registers one global button through `registerActionButtons`,
  guarded by `if (!registerActionButtons || !submitMessage)`. It does not branch on the view, so the
  same button appears on both lenses.
- It goes through `startTurn`, which `await flushPendingWrites()` before `submitMessage`. Since LX-1
  the flush also fires a pending debounced refinement refetch, so this ordering must survive.
- Agent-turn buttons carry a sparkle icon and a "Starts a new conversation turn" tooltip. That is a
  confirmed decision in the plan, and per-row actions since LX-7 use `chartAreaStack` for the
  comparison; a global action is not a row action, so the sparkle convention still applies.
- `AttachmentHeader` returns `null` when it has no action buttons, taking the title, icon and badges
  with it. A view that registers no button loses its header — do not leave a lens with none.
- The Summarize wording is load-bearing: `format()`'s "never mention, summarize, count or
  investigate" phrasing plus the Summarize prompt is what makes that AC pass. Do not reword the
  pattern-table action while adding the new one.

## Settle first

Ask the user and wait for the answer before writing any code.

1. **What the volume-comparison action asks for.** Candidates: explain the delta between the two
   epochs; identify which patterns drive the change; or something else. This decides whether the
   action needs data the histogram payload does not carry — `result` for that lens holds two series,
   not per-pattern attribution.
2. **Whether the pattern-table action keeps its exact current label and prompt.** Changing it risks
   the Summarize AC, which has not been re-driven since LX-8 rewrote `format()`.

## Files to start from

Not a whitelist — change whatever the task needs. Relative to
`x-pack/solutions/observability/plugins/observability_agent_builder/`:

- `public/attachment_types/log_exploration/log_exploration_attachment.tsx`
- `server/attachments/log_exploration.ts` — `format()` and `getAgentDescription()`
- `server/skills/logs_exploration/skill.md.text`

## Done when

Each lens offers exactly one global action that makes sense for it, both start a single agent turn,
and neither lens ends up with an empty header. The Summarize AC still passes on the pattern table,
re-driven rather than assumed. Checked in the browser, in your own conversation.

## Progress log

### 2026-09-04 — Per-lens actions shipped; found that `format()` was never reaching the model

- **Decided (user):** the volume-comparison action is **"Explain this change"**, answered from the
  attachment's own numbers, **plus** bucket shape added to `formatHistogram()` so the answer beats
  what the chart already shows. Attribution across both epochs was rejected: it needs
  `get_log_patterns` with an explicit range, and `resolveRange` + `emitLogExplorationAttachment`
  would overwrite the user's window and replace their chart.
- **Decided (user):** open to rewording the pattern-table action. Label changed
  `Summarize remaining patterns` → **`Summarize top patterns`** ("remaining" reads as "the ones you
  haven't shown me", which is the exact misreading the top-N framing exists to prevent). The
  **prompt is unchanged verbatim**, since it is the model-facing half the AC depends on.
- Changed: `log_exploration_attachment.tsx` — one action per lens, chosen on `data.view.type`.
  Never zero, so `AttachmentHeader` cannot collapse. Both still route through `startTurn`, so the
  `flushPendingWrites()` ordering is untouched.
- Changed: `server/attachments/log_exploration.ts` — `formatHistogram()` now states the signed
  change and percent, busiest bucket per epoch, and the bucket that moved most.
- Changed: `server/skills/logs_exploration/skill.md.text` — fourth action documented.
- Changed: `server/attachments/log_exploration.test.ts` (new) — pins the `format()` arithmetic
  (totals, ±%, zero-baseline division, empty-series omission) and the pattern-table wording.

**Correction to a load-bearing assumption in the state and plan docs.** Both say the attachment's
content is in the model's context every round and that `format()` "re-reads it every turn". That is
**false in this framework version**. Read from source and confirmed in the browser:

- `prepareRoundInput` hardcodes `attachments: []` (commented as legacy), so the
  `representation.value` path in `to_langchain_messages` is dead.
- What is injected is `attachment_context` = `formatAttachmentsMetadata(...)`, which emits **metadata
  only** — id, type, operation, actor, version, estimated_tokens, description — plus the literal note
  `Use attachment_read(attachment_id) to access content.`
- `attachments.read` returns the **raw payload** unless the type sets `isReadonly: true`, in which
  case it returns `format()`'s representation. Ours did not set it.

So every word in `format()` — the muted-pattern rule, the top-N framing, the "do not total these
counts" rule — was dead code, and the agent was reasoning off raw JSON. Observed directly: it quoted
`121, 143, 146` and "buckets 33–36 are 0", values that appear only in the raw series.

- Changed: `log_exploration.ts` — set **`isReadonly: true`**. Verified safe before doing it:
  `readonly` is enforced only in the agent's builtin `attachments.add`/`update` tools;
  `AttachmentStateManager.update()` has no guard and neither does the content-update HTTP route, so
  the tool emit path and the user's writes are unaffected. Bonus: it structurally enforces the
  "never call `attachments.add` for this data" rule the skill previously only asserted in prose.
- Reverted a wrong turn of my own: I had first written "you cannot see the individual buckets" into
  `format()` and a "do not call `attachments.read`" rule into the skill. Both were wrong —
  `attachments.read` is the framework's prescribed content channel, and telling the model it lacked
  data is what sent it to fetch the raw payload in the first place.
- **Skill bodies are not reliably in context for button-triggered turns.** The "Explain this change"
  round showed no `load_skill` call, so the skill instruction was never seen. `getAgentDescription()`
  is injected via `prepare_conversation`, but only **once per conversation per type**. `format()`
  (through `attachments.read`) is the only per-round channel. Anything that must hold every turn
  belongs in `format()`, not the skill.
- Changed: muted-pattern wording. `Never mention, summarize, count or investigate` → never _name_
  them, never include them in a summary/count/comparison, never investigate, **but you may say how
  many are muted**. Driven first, then changed: with `format()` finally live, the agent obeyed the
  exclusion but named both muted patterns in an aside — re-surfacing the noise the user muted. The
  new wording gives it a sanctioned way to stay transparent.
- Changed: `formatPatternTable()` now states the un-muted count instead of leaving the model to
  count. It had opened with "6 un-muted patterns" above its own correct 8-row table.

- Verified, in my own conversations, on the reseeded data:
  - Volume lens registers exactly one button, "Explain this change"; header intact (title + action).
  - Its answer is now built purely from the summary lines: totals 1,764 / 1,657,
    `+107 documents, +6.5%`, busiest bucket per epoch, moved-most bucket 48 → 146. No raw bucket
    enumeration. Arithmetic cross-checked: 1764−1657 = 107, 107/1657 = 6.5%.
  - Pattern lens registers exactly one button, "Summarize top patterns"; an older round in the same
    conversation still shows the histogram with "Explain this change", so per-lens registration
    holds per render, and superseded renders keep their header.
  - **Summarize AC re-driven, not assumed.** Two mutes → table backfills to 8 → Summarize returns
    "the 8 un-muted patterns from the top of the cut (2 patterns have been muted)": count matches
    `aria-rowcount` 8, both promoted patterns present with correct counts, neither muted pattern
    named anywhere, top-N framing present, percentages scoped to "the visible cut" rather than
    presented as a document total.
  - Persisted state cross-checked in the conversation API: `readonly: true`, v2 holds 10 patterns
    (8 fetched + 2 retained muted) with 2 `exclude-pattern` refinements — so the debounced backfill
    write lands before the turn, as designed.
- Reseeded once (logged): `seed_logs_poc.js` timestamps redistributed to add a burst, because the
  old seed spread every pattern evenly and current/baseline totals matched to within rounding —
  nothing for "Explain this change" to explain, and no way to tell a correct implementation from a
  broken one. Invariants preserved: 3685 docs, 32 categories, strictly descending counts.
- Checks: jest 34 passed, `type_check` clean, eslint clean.

- Unverified:

  - The "6 un-muted" miscount was observed once and the fix (stating the count in `format()`) was
    driven once. Not repeated across connectors or several turns.
  - `isReadonly: true` was verified not to block the tool emit or the user's writes **by reading the
    enforcement sites and by observing writes still landing** (v2 was written after the flag was on).
    The agent's own `attachments.update` on this type was not attempted, so the new rejection path
    is unexercised.
  - Existing attachments created before the flag keep `readonly: false` in storage;
    `attachment_read` branches on the **type definition**, so they still get `format()`. Reasoned
    from source, not driven against a pre-flag conversation.
  - The volume action was driven on one seed shape (single burst). Not driven on a drop, an empty
    baseline, or a scoped (`only-pattern`) comparison.
  - `getAgentDescription()` being injected only once per conversation is read from
    `to_langchain_messages` (`attachmentTypeInstructionsProvided`), not measured.

- **Overlap warning for the coordinator:** this touched
  `log_exploration_attachment.tsx` and `format()`, which LX-10 and LX-11 also list. LX-10 in
  particular is now easier to judge: prose-vs-view contradictions were invisible while `format()`
  was dead, and the "6 vs 8" case above is exactly its subject.
- Next: none — ready for fold-in. The `format()`-never-reached-the-model finding and the
  skill-not-in-context finding both need folding into the state and plan docs; they invalidate
  specific claims quoted above.
