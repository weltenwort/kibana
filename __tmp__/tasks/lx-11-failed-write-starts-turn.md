# LX-11 — A failed write must not start an agent turn

**Status:** ready
**Owner:** unassigned

Read [`README.md`](./README.md) first — ownership, the progress-log format and the shared-environment
rules. The constraints under "Rules for every item" in
[`../poc-logs-exploration-next-steps.md`](../poc-logs-exploration-next-steps.md) apply here and are
not repeated.

## Goal

`startTurn` should not submit a message when the write it depends on failed.

## Context, verified in the source

- Found by review during LX-7, not by a failure in the wild. `persist`'s `.catch` resolves, so
  `flushPendingWrites` cannot signal failure and `startTurn` proceeds regardless.
- Pre-existing and shared: Investigate and Summarize have the same hole. It only changes the
  _meaning_ for compare-baseline, which submits a message whose scope lives entirely in the write
  that just failed — the agent then charts the whole index while the user sees a scope chip.
- The sibling race was fixed in LX-7: an immediate fetch triggered by `ADD_REFINEMENT` or
  `REMOVE_REFINEMENT` now passes `persistOnFailure: true`, so a failed _refetch_ still persists the
  refinement. This task is the _write_ failing, not the fetch.
- The existing ordering constraint stands: agent-turn handlers `await flushPendingWrites()` before
  `submitMessage`, and the flush awaits the in-flight refetch and fires a waiting debounced one.

## Settle first

Ask the user and wait for the answer before writing any code.

1. What should the user see when the write fails — the existing error callout, a disabled action, or
   the turn starting anyway with the message rewritten to drop the stale claim?
2. Does this change `startTurn`'s contract for all three actions at once, or only for the one whose
   meaning depends on the write?

## Files to start from

Not a whitelist — change whatever the task needs. Relative to
`x-pack/solutions/observability/plugins/observability_agent_builder/`:

- `public/attachment_types/log_exploration/use_log_exploration_state.ts` — `persist`,
  `flushPendingWrites`
- `public/attachment_types/log_exploration/log_exploration_attachment.tsx` — `startTurn`

## Done when

With a forced 500 on the content PUT, clicking compare-baseline does not produce an agent turn that
claims a scope the server never stored. Driven in the browser with the failure forced — LX-7's
equivalent race was only settled that way.

## Progress log

_No entries yet._
