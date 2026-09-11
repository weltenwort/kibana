# LX-8 — Re-model the attachment payload as subject / refinements / view / result

**Status:** done — awaiting fold-in
**Owner:** worker agent

Read [`README.md`](./README.md) first — ownership, the progress-log format and the shared-environment
rules. The constraints under "Rules for every item" in
[`../poc-logs-exploration-next-steps.md`](../poc-logs-exploration-next-steps.md) apply here and are
not repeated.

**LX-7 is blocked on this** and becomes its first consumer. Do not do LX-7's row action here.

## Goal

Replace the flat attachment payload with a model of an exploration journey: a subject, progressively
refined, viewed through a lens, plus a cache of the last query.

```ts
{
  source:      { index, messageField, timeRange },
  refinements: Refinement[],
  view:        { type: 'pattern-table' }
             | { type: 'volume-comparison'; baselineEpoch: TimeRange },
  result:      { generatedAt, ... }   // keyed to view.type
}

type Refinement =
  | { kind: 'exclude-pattern'; pattern: string }   // today's mute
  | { kind: 'only-pattern';    pattern: string }   // LX-7's scope
  | { kind: 'kql';             query: string }     // today's kqlFilter
```

Refinements carry `origin: 'user' | 'agent'`, for labelling only.

## Why, in one paragraph

The current payload is a flat bag of ten fields that mixes what is being explored, the narrowing
decisions, one lens's parameter, and the disposable answer to the last query. `mutedPatterns` and
`kqlFilter` are the same kind of thing with bespoke fields, bespoke affordances and bespoke server
translation, so every new narrowing costs a new field everywhere. The reasoning, and the two shapes
rejected on the way here, are in the plan under Confirmed decisions and Rejected alternatives.

## What this buys, and what has to hold

- **One server translation.** A single `buildFilter` mapping kinds to DSL clauses: `exclude-pattern`
  → `must_not` token match, `only-pattern` → the same clause under `filter`. That is the existing
  mute pushdown and its literal inverse. Both views call it.
- **This closes a real bug.** `getLogVolumeComparison` takes only `kqlFilter` and never receives
  `mutedPatterns`, so muting has never affected the volume chart. Read from the query path, not yet
  measured — confirm it against Elasticsearch before and after.
- **One UI affordance.** A chip row over `refinements`; every refinement visible and removable by
  construction, for every future kind. The mute chips already are this for one kind.
- **One merge rule.** Carry `refinements` forward. A new tool adds a `kind`, and no tool's merge
  changes.
- **`result` stays separate from `view`.** `view` is small, durable user intent; `result` is the
  large disposable cache — the 16 KB PUTs are almost entirely this. Splitting them makes an invariant
  checkable: the refetch request is exactly the state minus `result`, and the response is exactly
  `result`. Today that relationship is implicit and duplicated across two hand-written request
  schemas. `fetch_log_exploration_view.ts` should reduce to a switch on `view.type`.

## Already decided — do not re-open

By the user, during the LX-7 settle-first discussion:

- **Breaking the stored payload shape is acceptable in this PoC.** No normalising read. Existing
  conversations show the invalid-payload callout; start a new one.
- **Refinements are honoured by every view.** Muting affects the histogram too, and `only-pattern`
  narrows the table as well as the chart. The user may remove a refinement the agent applied.
- **`format()` keeps hand-written per-kind sentences** despite uniform storage. The exact mute
  phrasing — "never mention, summarize, count or investigate" — is what makes the Summarize AC pass;
  do not flatten it into a generic list.
- **`baselineEpoch` lives in the `view` union** and is lost on a lens switch. Accepted.
- **Journey history is not modelled.** The attachment version chain already is the journey; the
  payload describes the current position only.

## Settle first

Ask the user and wait for the answer before writing any code.

1. Is `result` a discriminated union keyed to `view.type`, or two optional fields as today?
2. Does the `kql` refinement kind ship with UI now, or exist in the type only until something emits
   it? Today's `kqlFilter` is set by the agent and has no affordance.
3. Is `origin` shown in the chip row, or held for later?

## Files to start from

Not a whitelist — change whatever the task needs. Relative to
`x-pack/solutions/observability/plugins/observability_agent_builder/`:

- `common/log_exploration.ts` — the schema, its bounds, and `mergeFetchedPatterns`
- `server/attachments/{log_exploration.ts,emit_log_exploration_attachment.ts}` — `format()`,
  `getAgentDescription()`, the loop-state merge, `resolveRange`
- `server/tools/get_log_patterns/{tool.ts,handler.ts}` — `buildFilter` lives here
- `server/tools/get_log_volume_comparison/{tool.ts,handler.ts}` — currently `kqlFilter`-only
- `server/routes/log_exploration/route.ts` and its request schemas
- `public/attachment_types/log_exploration/` — `use_log_exploration_state.ts`,
  `fetch_log_exploration_view.ts`, `exploration_controls.tsx`, `pattern_table.tsx`,
  `baseline_histogram.tsx`, `log_exploration_attachment.tsx`, `README.md`
- `server/skills/logs_exploration/skill.md.text`

## Done when

Both views honour refinements — muting visibly changes the histogram, measured against Elasticsearch,
not inferred. Every refinement renders as a removable chip. The refetch request is the state minus
`result`. Old conversations show the invalid-payload callout rather than rendering wrong. Every zod
bound is re-derived, since `maxContentLength` is unenforced. Driven in the browser, in your own
conversation.

## Progress log

### 2026-09-04 — journey model built; the histogram now honours mutes, measured against ES

- Decided (user, answering the settle-first list, in order):
  1. **`result` is a discriminated union keyed to `view.type`.** Chosen over two optional fields so
     the type system enforces "the response is exactly `result`": a `volume-comparison` view cannot
     carry `patterns`. Accepted cost: a lens switch discards the other lens's cached data, so
     switching back re-queries rather than rendering stale rows first.
  2. **The `kql` kind ships as a chip, with no input to create one.** The agent still sets it; the
     view shows and removes it. Rejected: a KQL input (its own task) and type-only (leaves the
     agent's filter invisible, exactly as today).
  3. **`origin` is stored but not shown.** The chip row stays compact; the mute chips look as they
     did.
  4. **The histogram view id is renamed `histogram` → `volume-comparison`,** matching this task's
     text. Free, since the stored shape breaks anyway.
- Changed:
  - `common/log_exploration.ts` — replaced the flat schema with `{ source, refinements[], view,
result }`. `refinements` is a discriminated union over `exclude-pattern` / `only-pattern` /
    `kql` carrying `origin`; `view` and `result` are unions keyed on the same discriminant.
    `logExplorationRequestSchema = logExplorationDataSchema.omit({ result: true })` replaces the two
    hand-written request schemas. Added `refinementKey` / `addRefinement` / `removeRefinement` /
    `excludedPatterns`; `addRefinement` dedupes by key (mute idempotence is load-bearing) and caps
    at `MAX_REFINEMENTS`, because exceeding it at write time would reject the whole payload.
  - Every zod bound re-derived from the widest tool parameter that can reach it. Three were wrong
    before: `kqlFilter` was capped at 1024 while the tools accept 4096; `index` at 1024 against
    `MAX_INDEX_PATTERN_LENGTH` 4096; `messageField` and `generatedAt` both reused the 64-char
    datemath bound. A tool input the schema accepted could therefore have produced an attachment
    that failed validation. Not observed in the wild — found by re-deriving, as the task asked.
  - `server/utils/log_exploration_refinements.ts` (new) — `buildRefinementFilter`, the single
    kinds-to-DSL translation, plus `applyAgentKqlFilter`. `exclude-pattern` → `must_not`,
    `only-pattern` → the identical clause under `filter`, `kql` → `query_string`.
  - Both query handlers now take `{ refinements, messageField }` instead of
    `kqlFilter`/`mutedPatterns`. `get_log_patterns/handler.ts` lost its private `buildFilter`;
    `get_log_volume_comparison/handler.ts` gained the filter it never had.
  - Both tools carry `source` and `refinements` forward. Added `resolveSource`, which applies
    `resolveRange`'s precedence (explicit request → user state → default) to `index` and
    `messageField` too — `messageField` lost its `.default('message')`, which had made "the model
    said message" and "the model said nothing" indistinguishable, the same defect as bug 1.
  - `server/attachments/log_exploration.ts` — `format()` keeps hand-written per-kind sentences and
    the exact `MUTED PATTERNS` heading and "never mention, summarize, count or investigate"
    wording, since that is what makes the Summarize AC pass. Added sentences for scope and KQL.
  - `server/routes/log_exploration/route.ts` — both routes take `logExplorationRequestSchema` and
    return `LogExplorationResult`. The volume route rejects a non-`volume-comparison` view with a
    400 rather than inventing a baseline.
  - Renderer: `MUTE_PATTERN`/`UNMUTE_PATTERN` became `ADD_REFINEMENT`/`REMOVE_REFINEMENT`, so a new
    kind needs no new action. `FETCH_FAILED` now rolls back `source.timeRange` **and** `view` (the
    baseline epoch moved into `view`). `fetch_log_exploration_view.ts` reduced to a path lookup on
    `view.type` — `resolveBaselineEpoch` deleted, since the lens cannot exist without one.
    `exploration_controls.tsx` renders all refinements through an exhaustive switch, so a new kind
    is a compile error until it has a label.
  - Refetch policy generalised and unchanged in effect: adding an `exclude-pattern` is debounced
    (it is muting), everything else — removal, other kinds, window, lens parameter — is immediate.
  - Tests: `use_log_exploration_state.test.ts` rewritten; new
    `server/utils/log_exploration_refinements.test.ts` pins that exclude and only produce the
    _identical_ clause on opposite sides of the bool query. Skill text and renderer README updated.
- Verified:

  - `node scripts/type_check --project …/tsconfig.json` clean; `node scripts/eslint --fix` clean;
    `node scripts/jest --config …/jest.config.js` 166 passed / 20 suites; `node scripts/i18n_check
--fix` clean.
  - **The histogram bug is closed, measured against Elasticsearch**, not inferred. Seeded window
    14:10–17:10 on 2026-09-02, baseline 11:10–14:10, at the volume route:

    | refinements             | current | baseline |
    | ----------------------- | ------- | -------- |
    | none                    | 1823    | 1830     |
    | exclude the top pattern | 1464    | 1470     |
    | only that pattern       | 359     | 360      |

    1464 + 359 = 1823 and 1470 + 360 = 1830 exactly, so the exclusion and the scope are complements
    of each other over the same clause. Before this change the route had no parameter that could
    have produced any of the last two rows.

  - Driven in the browser, in my own conversation, against the seeded instance: pattern table
    renders from the new payload; muting the top row leaves a `Filters: Muted: …` chip and the top-N
    backfills to 8 (Kafka consumer lag, 83, promoted); asking for a volume comparison switches the
    lens on the same attachment and **carries the mute chip onto the histogram**; removing that chip
    visibly raises the bars (y-axis top gridline 80 → 100) — this is the bug closing on screen.
    Asking for `log.level: error` produces a removable `KQL: log.level: "error"` chip and narrows
    the table; the agent's own reply stated the filter persists until removed, so it read the
    reworded tool description. The earlier round's table showed Investigate but no Mute, so
    superseded-render read-only behaviour survives.
  - Old conversations show the invalid-payload callout naming `source`, `refinements`, `view` and
    `result` as missing, rather than rendering wrong.

- Unverified:
  - **`only-pattern` has no UI**, so its chip was never rendered — only its DSL and its reducer
    handling are covered. LX-7 emits the first one; check the chip label there.
  - `applyAgentKqlFilter`'s replace-on-pass was unit-tested but never driven across two agent turns
    with two different filters.
  - The `MAX_REFINEMENTS` cap silently drops the 61st refinement. Unit-covered only; no one has
    muted 60 patterns in a browser.
  - The rewritten `format()` output was not read back from a model's context; the Summarize AC was
    not re-driven, though the wording it depends on is unchanged verbatim.
  - Whether `messageField` losing its default changes anything for the model. Read from the schema,
    not exercised with a tool call that passes a non-default field.
- Note for the coordinator: this touched `common/log_exploration.ts`, both tools, both handlers,
  the routes and the whole renderer directory — the same files LX-7 lists. LX-7 is now unblocked and
  should read the new model before starting.
- Next: none — ready for fold-in.
