# LX-13 — "Focus the window" action on the pattern table

**Status:** ready
**Owner:** unassigned

Read [`README.md`](./README.md) first — ownership, the progress-log format and the shared-environment
rules. The constraints under "Rules for every item" in
[`../poc-logs-exploration-next-steps.md`](../poc-logs-exploration-next-steps.md) apply here and are
not repeated.

## Goal

An agent-turn action on the pattern table that narrows `source.timeRange` to the most salient part of
the current window — the burst, the spike, the interval where the shape of the cut actually changes —
and re-renders the table over it.

## Context, verified in the source

- **The model cannot currently see where in the window anything happens.** `formatPatternTable()`
  emits, per row, only `count`, share of the cut, and a single `trend` from `halfOverHalfDelta()` —
  first half versus second half. `formatCutShape()` adds cut-level aggregates. No bucket-level
  detail reaches the model.
- **The sparkline is not time-anchored.** `patternSchema` is `{ pattern, count, sparkline: number[] }`
  with no `startMs` or `intervalMs` — unlike `histogramSchema`, which has both. Bucket _i_ can only be
  turned into a timestamp by re-deriving the interval from `source.timeRange` and the array length.
  Anything that asks the model to name a sub-window needs that arithmetic done for it, server-side, or
  it will be invented.
- Global actions are one per lens, chosen on `data.view.type` (LX-9). The pattern table's is
  "Summarize top patterns". This adds a **second** button to that lens, which the LX-9 decision did
  not contemplate — see settle-first.
- Agent-turn buttons carry a sparkle icon and a "Starts a new conversation turn" tooltip. `sparkles`
  is already used by the per-row Investigate action, and the row actions use `chartAreaStack` for
  compare. Invalid icon names fail silently.
- The turn goes through `startTurn` → `await flushPendingWrites()` → `submitMessage`, which must not
  change.
- **Loop-state precedence already supports this**: `resolveRange` is explicit request → user state →
  default, so the agent calling `explore_log_patterns` with an explicit range overrides the user's window
  and the emit helper persists it. No new write path is needed.

## The prose tension, which is real

LX-10's rule says a message that renders the view must not state the literal range — the picker is
the authoritative label. But this action's entire content _is_ a range change, and "I narrowed to the
14:05–14:20 burst because it holds 60 % of the cut" is exactly the sentence the user needs.

The three-case rule already accommodates it: attribution is allowed **above** a
`<render_attachment />` tag, never below. Confirm the model actually does that here rather than
assuming — LX-10 noted the above/below rule was never adversarially tested, because the model happened
to put the tag last.

## Settle first

Ask the user and wait for the answer before writing any code.

1. **Two buttons on the pattern table, or one?** LX-9 settled on one action per lens. Adding a second
   is a change to that decision, not an application of it.
2. **What "salient" means, and who decides.** Either give the model bucket-level, time-anchored data
   in `format()` and let it choose, or compute the candidate window server-side (peak, largest
   change) and have the agent explain and apply it. The second is cheaper and reproducible; the first
   is what "LLM-turn action" implies. This is the main design question.
3. **What the model needs added to `format()`** if it chooses — anchored sparkline buckets are a
   payload change (`startMs`/`intervalMs` on the pattern-table result, bounded in zod), not just a
   wording change.
4. **What happens to the old window.** Is it recoverable — an undo, a chip, or nothing but the
   picker?

## Files to start from

Not a whitelist — change whatever the task needs. Relative to
`x-pack/solutions/observability/plugins/observability_agent_builder/`:

- `public/attachment_types/log_exploration/log_exploration_attachment.tsx` — action registration,
  `startTurn`
- `server/attachments/log_exploration.ts` — `format()`, if the model needs the shape of the window
- `server/tools/explore_log_patterns/{tool.ts,handler.ts}` — the explicit-range path already exists
- `common/log_exploration.ts` — only if the pattern-table result gains time anchors
- `server/skills/logs_exploration/skill.md.text`

## Done when

Clicking it starts one agent turn that narrows the window to something defensible, the picker shows
the new range, the table refetches over it, and the explanation sits above the re-rendered view rather
than below it. Driven in the browser against a seed with a real burst — the seed carries one
deliberately, added in LX-9, because an even spread makes a correct implementation indistinguishable
from a broken one.

## Progress log

_No entries yet._
