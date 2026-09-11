# LX-14 — Leave a scoped comparison: drop the `only-pattern` refinement and return to the table

**Status:** done — awaiting fold-in
**Owner:** worker agent

Read [`README.md`](./README.md) first — ownership, the progress-log format and the shared-environment
rules. The constraints under "Rules for every item" in
[`../poc-logs-exploration-next-steps.md`](../poc-logs-exploration-next-steps.md) apply here and are
not repeated.

## Goal

When the volume-comparison view carries an `only-pattern` refinement, offer a control that removes it
**and** switches the lens back to the pattern table in one step — the way out of the drill-down LX-7
created.

## Context, verified in the source

- **There is no client-side lens switch today.** `LogExplorationAction` has `ADD_REFINEMENT`,
  `REMOVE_REFINEMENT`, `SET_TIME_RANGE`, `SET_BASELINE_EPOCH` and the three fetch/persist outcomes.
  Nothing sets `view.type`. LX-7 deliberately left the switch to the tool because the client cannot
  invent `view.baselineEpoch` — but this is the **easy direction**: `{ type: 'pattern-table' }` takes
  no parameters.
- **`result` is a discriminated union keyed to `view.type`** (LX-8), so the moment `view` becomes
  `pattern-table` the cached `volume-comparison` result no longer belongs to it. The lens switch
  necessarily re-queries; there is no cached table to fall back on. Decide what renders in between
  and what gets persisted — the standing rule is that the window and its data are persisted in one
  write, so an intermediate state with a mismatched `view`/`result` should not be written.
- **It must be one dispatch, not two.** Removing a refinement and changing the lens are each
  refetch-triggering; `requiresImmediateFetch` would fire twice, cutting two attachment versions and
  two refs. Either a compound action or a reducer that folds both into one state transition.
- **The chip already removes the scope.** `exploration_controls.tsx` renders every refinement as a
  chip with a cross (`iconType="cross"` → `REMOVE_REFINEMENT`), on both lenses. So "remove the
  scope" exists; what does not exist is "and take me back to the table". Adding a second affordance
  beside the chip risks two controls that look like they do the same thing.
- This writes, so it must respect `isReadOnly` and be hidden on superseded renders — the same
  reasoning that hid compare-baseline in LX-7.
- It is an **instant action**, not an agent turn: no sparkle, no "Starts a new conversation turn"
  tooltip.

## Settle first

Ask the user and wait for the answer before writing any code.

1. **A separate button, or the chip's cross doing more on this lens?** A dedicated button is
   discoverable; overloading the cross avoids two controls with overlapping meaning. If both exist,
   say what the plain cross does on the volume lens — remove the scope and stay on the histogram?
2. **What renders between the switch and the arriving data.** The existing fetch spinner over an
   empty table, or hold the histogram until the table's data lands?
3. **Does removing an `only-pattern` refinement from the pattern-table lens do anything different?**
   Today it just refetches in place. This task only changes the volume lens unless you say otherwise.

## Files to start from

Not a whitelist — change whatever the task needs. Relative to
`x-pack/solutions/observability/plugins/observability_agent_builder/`:

- `public/attachment_types/log_exploration/use_log_exploration_state.ts` — the new action, the
  single-transition rule, `requiresImmediateFetch`
- `public/attachment_types/log_exploration/exploration_controls.tsx` — the chips and any new control
- `public/attachment_types/log_exploration/baseline_histogram.tsx` — if the control lives with the
  chart
- `public/attachment_types/log_exploration/fetch_log_exploration_view.ts` — already a lookup on
  `view.type`; confirm it needs nothing

## Done when

On a scoped comparison, one click returns to an unscoped pattern table: the chip is gone, the table
is populated from a fresh query, exactly one attachment version was cut, and a superseded render does
not offer the control. Driven in the browser, in your own conversation.

## Progress log

### 2026-09-09 — Escape hatch shipped as an agent turn, not a client lens switch

- **Decided (user, settle-first Q1):** a **dedicated button**, not an overloaded chip cross. The
  plain cross keeps its existing meaning on both lenses — remove the scope, stay where you are —
  which on the volume lens leaves the legitimate unscoped total-volume comparison.
- **Decided (user, settle-first Q2):** _neither_ offered option. **No client-side lens switch at
  all.** The control removes the `only-pattern` refinement and starts an agent turn that renders the
  pattern table. This dissolves the question the task was built around: there is no intermediate
  state where `view` and `result` disagree, because the client never sets `view` — the tool does, as
  it always has. The task's premise that "the lens switch necessarily re-queries; decide what renders
  in between" is answered by not switching the lens on the client.
- **Decided (user, settle-first Q3):** removing an `only-pattern` chip from the pattern-table lens is
  unchanged. Volume lens only.
- Changed: `public/.../log_exploration_attachment.tsx` — `onLeaveScope`, the exact mirror of LX-7's
  `onCompareBaseline`: dispatch `REMOVE_REFINEMENT`, then `startTurn`. No new reducer action and
  **no change to `use_log_exploration_state.ts`** — `REMOVE_REFINEMENT` already sets
  `requiresImmediateFetch` and `changesRefinements`, so the removal's own refetch is what writes it,
  and `startTurn` awaits that before submitting. The task's "must be one dispatch, not two" is met by
  there being only one dispatch to begin with.
- Changed: `public/.../baseline_histogram.tsx` — the button, beside the Baseline selector, shown only
  when an `only-pattern` refinement exists and `!isReadOnly`. Sparkle icon and a "Starts a new
  conversation turn" tooltip, per the button convention — the task's assumption that this is an
  instant action no longer holds, since Q2 made it an agent turn. Also lifted the header row out of
  the `!histogram` early return so the way back does not depend on the comparison having data.
- Changed: `server/skills/logs_exploration/skill.md.text` — "four actions" → five, and a
  **Back to top patterns** bullet: the scope is already removed before the message arrives, call
  `observability.get_log_patterns` with no parameters, do not re-apply the scope, do not name the
  pattern (deliberately absent from the message), and present the table rather than analysing the
  comparison just left.
- Label is "Back to top patterns", not "all patterns" — the top-N framing rule applies to the UI as
  much as to `format()`.
- Verified: `type_check` (plugin), `eslint --fix`, `jest` (21 suites / 186 tests), `i18n_check --fix`
  — all clean, and `--fix` left the working tree at my three files only.
- Verified, in my own conversation in the browser (`155e0854-58e3-4281-9154-6ca9f1a35c53`, seeded
  data, 7-day window since 24 h was empty): pattern table → compare-baseline on the top pattern →
  scoped histogram with the `Only:` chip and the new button → one click → unscoped pattern table,
  8 rows, fresh query, `Last 7 days` preserved, chip gone, global action back to "Summarize top
  patterns". Attachment versions across the click, read from the attachments API:

  ```
  v3 pattern-table      [only-pattern]   LX-7's client write
  v4 volume-comparison  [only-pattern]   the comparison tool
  v5 volume-comparison  []               <- this click's own write, exactly one
  v6 pattern-table      []               the agent's get_log_patterns
  ```

- Verified: the agent called `observability.get_log_patterns` with `params: {}` — no reconstructed
  pattern, no range — so the window and any mutes carried forward as the skill instructs.
- Verified: on the superseded volume render, `leaveScopeButtonsOnPage` is **0**, and the one `Only:`
  chip still on the page is that render's, with no remove icon. Write-disabled-on-stale holds for the
  new control.
- **The "exactly one attachment version was cut" criterion needs restating.** It was written for the
  client-side lens switch the user rejected. The click itself cuts exactly one version (v5); the
  agent's tool call cuts v6, as any tool call does. Two versions per round-trip, identical in shape
  and cost to compare-baseline (v3 + v4). Nothing regressed; the criterion assumed a different design.
- Unverified: the `!histogram` empty branch I restructured around is **unreachable in practice** —
  `result` is keyed to `view.type` and only the server ever changes them, always together — so the
  header-row change is a type-guard hardening that cannot be driven. Also unverified: behaviour with
  a `kql` or `exclude-pattern` refinement present alongside the scope (the removal is keyed, so it
  should leave them, but I did not drive it), and the read-only path was observed only as button
  absence, not by clicking through a stale render.
- Overlap for the coordinator: `log_exploration_attachment.tsx` is also listed by **LX-11**, and both
  it and `skill.md.text` by **LX-13**. My change to the first is one added `useCallback` plus one
  prop on `<BaselineHistogram />`; to the second, one list item and one word. `baseline_histogram.tsx`
  is listed by no other open task.
- Next: none — ready for fold-in.

### 2026-09-09 — Moved the control into the attachment header, beside the lens action

Replaces the placement in the entry above — the button is no longer in `baseline_histogram.tsx`, and
that file is now byte-identical to `HEAD`. Everything else in that entry stands: the mechanism, the
message, the skill bullet and all of its measurements were re-driven and unchanged.

- **Decided (user):** the control belongs in the `AttachmentHeader` alongside "Explain this change",
  not inside the chart body.
- This turned out to be free, contract-wise: `registerActionButtons` already takes an array, and
  `AttachmentActions` renders `SECONDARY` as an `EuiButtonEmpty` immediately left of the `PRIMARY`
  `EuiButton`. No framework change, so **no sixth entry in LX-6's local-edits inventory**.
- Changed: `public/.../log_exploration_attachment.tsx` — `onLeaveScope` moved above the registration
  effect (it is now in the effect's dep array, so declaring it after would be a TDZ error), and the
  effect prepends a `SECONDARY` button when the lens is `volume-comparison`, a scope exists, and the
  render is writable. `isReadOnly` is now a dep of that effect; it was not before, because the lens
  action is a pure agent turn that stays enabled on stale renders while this one writes first.
- Reverted: `public/.../baseline_histogram.tsx` entirely, including the header-row restructure from
  the previous entry. The unreachable `!histogram` branch noted there is moot — the header is outside
  the component, so the way out no longer depends on the chart having data at all. This also drops
  the file from my change set, so the LX-2 adjacency note no longer applies.
- **Icon is `sortLeft`, not the agent-turn sparkle.** Measured, not assumed: `AttachmentHeader`
  switches `AttachmentActions` to `iconOnly` at `COMPACT_WIDTH_THRESHOLD` (560 px), and the header
  measured 768 px at my window size — so labels show here, but a narrower viewport collapses both
  buttons to bare icons, where two sparkles would be indistinguishable. `sortLeft` is Kibana's
  established back-affordance (`@kbn/ui-app-header`'s back button).
- **Cost, accepted:** the "Starts a new conversation turn" tooltip is gone. `ActionButton` exposes a
  tooltip only through `disabledReason`, for disabled buttons. The two existing header actions have
  the same gap, so this is consistent rather than new — but it does mean the button convention's
  tooltip half is unavailable to any header action, which is worth knowing before more are added.
- Verified in the browser, same conversation, driven twice more end to end: on the pattern-table lens
  the header shows only "Summarize top patterns", **including when a scope is applied** (compare-
  baseline's own scoped table render); on the live scoped comparison it shows
  `← Back to top patterns` then `Explain this change`; on the superseded comparison above it, only
  "Explain this change". One click from the header produced the same two versions as before:

  ```
  v8  volume-comparison  [only-pattern]
  v9  volume-comparison  []               <- the click's own write, exactly one
  v10 pattern-table      []               the agent's get_log_patterns
  ```

- Verified: `eslint --fix`, `type_check`, `jest` (21 suites / 186 tests), `i18n_check --fix` — all
  clean, working tree down to **two** files.
- Unverified: icon-only mode below 560 px was reasoned from the source, not driven — I did not
  narrow the viewport to see the two icons side by side.
- Overlap for the coordinator, restated: only `log_exploration_attachment.tsx` (also listed by
  **LX-11** and **LX-13**) and `skill.md.text` (also **LX-13**). The first now carries a slightly
  larger change than the previous entry described — the action-registration effect, which LX-13's
  "action registration" note points at directly. Worth sequencing those two.
- Next: none — ready for fold-in.
