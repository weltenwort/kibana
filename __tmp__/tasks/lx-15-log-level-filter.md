# LX-15 — Filter the pattern table by log level

**Status:** ready
**Owner:** unassigned

Read [`README.md`](./README.md) first — ownership, the progress-log format and the shared-environment
rules. The constraints under "Rules for every item" in
[`../poc-logs-exploration-next-steps.md`](../poc-logs-exploration-next-steps.md) apply here and are
not repeated.

## Goal

A control on the pattern table that narrows the view to one log level (or a set of them).

## Context, verified in the source

- **This is the task LX-8 named and deferred.** `kql` ships as a removable chip with _no input to
  create one_ — the agent sets it, the view shows and removes it. The rejected option was "a KQL
  input (its own task)". A level picker is the narrower, safer form of that.
- **Refinements apply to every lens by design** (LX-8). A level filter will narrow the volume
  comparison too. That is the model working as intended, not a leak, but say it in the outcome.
- **Two ways to model it**, and the choice is the task's main question:
  - **Reuse `kql`** by constructing `log.level: "error"`. Nothing new server-side —
    `buildRefinementFilter` already maps `kql` → `query_string`. But the chip then reads as a KQL
    string, and a user-set `kql` refinement is indistinguishable from an agent-set one except by
    `origin`, which is stored but not displayed.
  - **A new `level` refinement kind.** `exploration_controls.tsx` switches exhaustively over kinds,
    so a new one is a compile error until it has a label — the property LX-8 built for exactly this.
    Needs a clause in `buildRefinementFilter`, a hand-written sentence in `format()` (LX-8 decided
    per-kind sentences stay hand-written), and a zod bound.
- **Log level is messy, and this plugin already knows it.**
  `server/utils/warning_and_above_log_filter.ts` matches `log.level` against 20 spellings (upper and
  lower case of `ALERT`, `CRIT`, `CRITICAL`, `EMERGENCY`, `ERR`, `ERROR`, `FATAL`, `SEVERE`, `WARN`,
  `WARNING`) _and_ OTel `severity_number >= 13`, syslog severity, `winlog.level_id` and HTTP 5xx. The
  RCA skill states outright that `log.level` is often unreliable — mixed casing, absent on OTel
  events — and recommends discovering real values with
  `get_index_info(operation="get-field-values")` rather than guessing. A naive `term` query on
  `log.level` will silently under-match.
- **The payload has no level field.** `source` is `{ index, messageField, timeRange }`. Either the
  field is fixed at `log.level`, or it joins `source` and needs the same allow-list treatment
  `utils/esql.ts` gives identifiers.

## Blocker: the seed has no log levels

`__tmp__/seed_logs_poc.js` emits no `log.level` at all — grep returns nothing. Against
`logs-poc-default` this feature cannot be driven, only unit-tested, and this PoC has a standing rule
that unit tests are not sufficient evidence. Extending the seed is part of the task; reseeding is a
shared-environment action, so log it, and preserve the invariants the other tasks depend on: 3685
docs, 32 categories, strictly descending counts, and the deliberate burst LX-9 added.

## Settle first

Ask the user and wait for the answer before writing any code.

1. **`kql` refinement or a new `level` kind?** See the trade-off above.
2. **Where do the offered values come from** — a fixed list, the ECS-ish spellings
   `warning_and_above_log_filter.ts` already carries, or a terms query against the current window so
   the picker only offers levels that exist?
3. **One level or several?** Multi-select is a `terms` clause and one chip; single is simpler and
   composes by adding refinements.
4. **How hard to try on the messy-data problem.** Case-insensitive matching and OTel
   `severity_number` are the difference between a demo and something that works on real data; both
   are already solved in that utility if you want to reuse the shape.

## Files to start from

Not a whitelist — change whatever the task needs. Relative to
`x-pack/solutions/observability/plugins/observability_agent_builder/`:

- `common/log_exploration.ts` — the refinement union and its bounds
- `server/utils/log_exploration_refinements.ts` — `buildRefinementFilter`
- `server/utils/warning_and_above_log_filter.ts` — prior art for level matching, read-only
- `server/attachments/log_exploration.ts` — the per-kind sentence in `format()`
- `public/attachment_types/log_exploration/exploration_controls.tsx` — the control and the chip label
- `__tmp__/seed_logs_poc.js` — levels in the seed

## Done when

Picking a level narrows the table to it, the filter shows as a removable chip, removing it restores
the previous cut, and the same refinement is honoured by the volume comparison. Verified against
Elasticsearch with counts that add up — the LX-7/LX-8 standard, where exclude and only were shown to
be complements — not only in the browser and not only in unit tests.

## Progress log

_No entries yet._
