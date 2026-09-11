# LX-7 — Per-row baseline comparison from the pattern table

**Status:** done — awaiting fold-in. The button works and is driven end to end; races 1 and 3 are
fixed. Three things need the coordinator's call, all in the 2026-09-04 log entries: a separate bug in
LX-8's work that I found and fixed (`exclude-pattern` had no effect on the histogram), race 2, and
whether to keep an unproven duplicate-turn guard.
**Owner:** unassigned

Read [`README.md`](./README.md) first — ownership, the progress-log format and the shared-environment
rules. The constraints under "Rules for every item" in
[`../poc-logs-exploration-next-steps.md`](../poc-logs-exploration-next-steps.md) apply here and are
not repeated.

## Goal

A per-row action on the pattern table that runs a baseline volume comparison for that one pattern.
It starts a new agent turn.

After LX-8 this is one journey step: add an `only-pattern` refinement for the row, set the view to
`volume-comparison`, then start the turn. The filter translation, the chip that removes the scope and
the persistence all come from LX-8.

## Context, verified in the source

Rewritten by the coordinator on 2026-09-04 after LX-8 landed — most of what this task once had to
build now exists.

- **The refinement already exists.** `only-pattern` is a refinement kind in `common/log_exploration.ts`,
  translated by `buildRefinementFilter` in `server/utils/log_exploration_refinements.ts` as the mute
  clause under `filter` instead of `must_not`, and pinned by a unit test asserting the two produce the
  identical clause on opposite sides. Both handlers apply it. `exploration_controls.tsx` already has a
  `case 'only-pattern'` in its exhaustive chip switch.
- **So this task is now: one button.** Dispatch `ADD_REFINEMENT` with
  `{ kind: 'only-pattern', origin: 'user', pattern }`, set `view` to `volume-comparison`, then start
  the turn. No schema, route, handler or DSL work.
- Rows carry mute (`eyeSlash`, dispatching `ADD_REFINEMENT` for `exclude-pattern`) and Investigate
  (`sparkles`, agent turn) in `pattern_table.tsx`. The new action sits beside them.
- Investigate is wired `onInvestigate` → `startTurn` in `log_exploration_attachment.tsx`, which
  `await flushPendingWrites()` before `submitMessage?.(message)`. That ordering is a constraint: the
  flush also fires a pending debounced refinement refetch.
- The lens switch is `view.type`, and the renderer branches on it at
  `log_exploration_attachment.tsx:146`.
- **`only-pattern` has never been rendered as a chip** — LX-8 shipped its DSL and reducer handling but
  nothing emits one yet. This task emits the first; check the chip's label and that removing it
  behaves.
- **Adding it narrows the table too**, not just the chart — refinements are shared across lenses by
  design. Switching back to the table with the scope still applied gives a one-row table. Accepted
  when the model was agreed; do not treat it as a bug.

## Decided — do not re-open

Answered by the user on 2026-09-04; the reasoning is in the progress log.

1. **Icon:** `chartAreaStack`. Not `compare`, not a second `sparkles`. Verified as a real EUI icon in
   `icon_map.js` but **not yet rendered at `EuiButtonIcon` size** — check it in the browser, since
   invalid or badly-scaled icons fail silently.
2. **Scope of the filter:** positive `extractCategorizeTokens` match, the literal inverse of the mute
   pushdown — in LX-8's terms, an `only-pattern` refinement. Not a `kqlFilter` string built from the
   pattern text: a paraphrased pattern is a silently wrong scope rather than an error. The pattern
   reaches the tool through loop state, written by the renderer before the turn, never interpolated
   into the message through the model.
3. **The table is not lost, so no second attachment.** `computeCumulativeRefs` scans only rounds
   `0..roundIndex`, and a completed round's refs are preserved verbatim, so round N stays pinned to
   the pattern-table version. It only becomes read-only — existing superseded-render behaviour. Read
   from framework source, not driven in a conversation.

## Files to start from

Not a whitelist — change whatever the task needs. Relative to
`x-pack/solutions/observability/plugins/observability_agent_builder/`:

- `public/attachment_types/log_exploration/pattern_table.tsx` — the row action
- `public/attachment_types/log_exploration/log_exploration_attachment.tsx` — `startTurn`, the prompt
- `public/attachment_types/log_exploration/exploration_controls.tsx` — the `only-pattern` chip label,
  never yet rendered
- `server/skills/logs_exploration/skill.md.text` — the agent has to understand the prompt this sends

Read but probably do not change: `server/utils/log_exploration_refinements.ts` and
`common/log_exploration.ts`, which already carry `only-pattern`.

## Done when

Clicking the action on a row starts one agent turn, the resulting histogram is scoped to that pattern
rather than the whole index, the scope shows as a removable chip, and the button is distinguishable
from both mute and Investigate at `EuiButtonIcon` size. Driven in the browser, in your own
conversation.

## Progress log

### 2026-09-04 — settle-first answered; the answers make this a data-model change, not a button

- Changed: nothing in product code. No implementation was started.
- Verified: by reading source only. `chartAreaStack` is a real EUI icon (`@elastic/eui`
  `icon_map.js`). `computeCumulativeRefs` in `round_layout.tsx` scans only rounds `0..roundIndex`,
  and `add_round_complete_event.ts` writes `attachmentStateManager.getAccessedRefs()` onto the round
  that ran the tool while `prepare_conversation.ts` preserves earlier rounds' refs verbatim.
  `get_log_volume_comparison/handler.ts` takes `kqlFilter` only — it never receives `mutedPatterns`,
  though `tool.ts` carries them forward into the attachment.
- Unverified: everything browser-dependent. `chartAreaStack` was not rendered at `EuiButtonIcon`
  size. The version-pinning conclusion in decision 3 is read from source, not driven in a
  conversation. The claim that the histogram ignores mutes is read from the query path, not measured
  against Elasticsearch.
- Decided (user, in order of the settle-first list):
  1. **Icon** — `chartAreaStack`, not `compare` and not a second `sparkles`.
  2. **Scope of the filter** — positive `extractCategorizeTokens` match, the literal inverse of the
     mute pushdown, not a `kqlFilter` string. The pattern reaches the tool **through loop state**,
     written by the renderer before the turn, not interpolated into the message through the model.
     Rejected because a paraphrased pattern is a silently wrong scope rather than an error.
  3. **The table is not lost, so no second attachment.** Round N keeps its own ref and stays pinned
     to the pattern-table version; it only becomes read-only, which is existing superseded-render
     behaviour.
  4. **Breaking the stored payload shape is acceptable within this PoC.** No normalising read is
     needed; existing conversations will show the invalid-payload callout and a new one is started.
- Decided (user) on the data model, after rejecting two intermediate proposals:
  - A flat `patternFilter` field was rejected as polluting loop state.
  - Grouping fields into per-view `patternTable` / `histogram` subobjects was then also rejected: the
    taxonomy is keyed on which renderer drew the data, so a third tool needs a third bucket and every
    tool's merge has to learn about it. It contains spill-over instead of removing its cause.
  - Agreed target shape — subject, refinements, lens, cache:
    `{ source: { index, messageField, timeRange }, refinements: Refinement[], view: { type: 'pattern-table' } | { type: 'volume-comparison', baselineEpoch }, result }`
    with `Refinement` a discriminated union over `exclude-pattern` (mute), `only-pattern` (LX-7's
    scope) and `kql`, carrying `origin: 'user' | 'agent'` for labelling only.
  - Consequences accepted by the user: refinements are honoured by **every** view, so muting affects
    the histogram too and `only-pattern` narrows the table as well as the chart; the user may remove
    a refinement the agent applied; `format()` keeps hand-written per-kind sentences despite uniform
    storage, because the exact mute phrasing is what makes the Summarize AC pass; `baselineEpoch`
    lives in the `view` union and is lost on a lens switch.
  - Not modelled: journey history. The attachment version chain already is the journey, so the
    payload describes the current position only.
- Next: none from this agent — the user is asking the coordinator to re-scope the queue, because the
  agreed model is a larger step than this task describes. LX-7 (the row action) then becomes the
  first consumer of the new model: one journey step that adds an `only-pattern` refinement and sets
  the lens to `volume-comparison`. Do not start implementing until the queue is updated.

### 2026-09-04 — button built and driven; found and fixed an unrelated exclusion bug in LX-8's work

- Changed:
  - `public/.../pattern_table.tsx` — third row action, `chartAreaStack`, dispatching
    `ADD_REFINEMENT` for `only-pattern`. Trailing column 76 → 108 px for three buttons.
  - `public/.../log_exploration_attachment.tsx` — `onCompareBaseline`: dispatch the refinement, then
    `startTurn`. The message deliberately contains no pattern text.
  - `server/skills/logs_exploration/skill.md.text` — "two actions" → three; tells the agent to call
    `get_log_volume_comparison` with no parameters and not to reconstruct the pattern.
  - `server/utils/log_exploration_refinements.ts` — `buildRefinementFilter` now always emits a
    positive clause (`match_all` when there is no other), fixing the bug below.
  - `server/utils/log_exploration_refinements.test.ts` — the old test asserted
    `excluded?.bool?.filter` is undefined, which is now wrong; replaced with a test pinning the
    `match_all` and why it is there.
  - `__tmp__/verify_refinements.js` — new route-level harness, derives the pattern from the data
    rather than hardcoding it. `__tmp__/probe_exclusion*.js` were scratch and are deleted.
- **Environment, per the README:** reseeded `logs-poc-default` once (3685 docs, 32 patterns,
  unchanged shape) to remove confounders, at the user's suggestion. The Kibana dev server also
  reloaded itself when the server-side edit landed, causing a burst of 503s around 17:19.
- Verified, driven in a fresh conversation against the fresh seed:
  - Three visually distinct icons render at `EuiButtonIcon` size; `chartAreaStack` is not blank.
    8 rows, 8 of each button.
  - Request order on click is `POST .../patterns` → `PUT .../attachments/<id>` →
    `POST .../converse/async`. The refinement is persisted **before** the turn starts.
  - The resulting attachment holds exactly one `only-pattern` refinement with `origin: 'user'`,
    `view.type: 'volume-comparison'`, and `result.histogram.current` totalling **720** — exactly the
    row's count in the table. The scope reached the query.
  - `roundRefVersions` is `[[1,2],[3]]`: round 0 stays pinned below the histogram's version and
    still renders the **table**. Decision 3 is now measured, not just read from source.
  - Round 0 shows 0 mute, **0 compare**, 1 investigate and a "Superseded" badge; its chip has no
    remove button. Round 1 has the removable chip.
  - Removing the chip leaves `refinements: []` and a histogram totalling 3685 (unscoped), persisted.
  - `node __tmp__/verify_refinements.js` passes 7/7 on both routes; 720 + 2965 = 3685.
  - `type_check`, `eslint`, `jest` (167 tests) all pass.
- **Bug found, not mine, now fixed: `exclude-pattern` had no effect on the histogram.** LX-8's stated
  purpose was to make muting reach the volume comparison, and it did not. Measured before the fix:
  volume totals were 3685 unfiltered, 360 with `only-pattern`, and **3685 with `exclude-pattern`**,
  while the same refinement worked correctly on the patterns route.
  - Cause, isolated against Elasticsearch 9.6.0-SNAPSHOT directly: a pushed-down filter whose bool
    contains **only** `must_not` is silently ignored when the ES|QL query combines a
    `WHERE @timestamp` range with `STATS ... BY BUCKET(@timestamp, ...)`. Every other shape tested
    honoured it — `STATS` alone, `WHERE` alone with a literal or a param, `WHERE` on a non-time
    field, and `BUCKET` without a `WHERE`. Adding any positive clause restores it.
  - My first hypothesis — a `COUNT(*)` doc-count shortcut — was **wrong**, and the probe disproved
    it before the fix was written.
  - Fix is the one-line `match_all`, which also protects every future query shape. It looks like an
    Elasticsearch bug and is worth reporting upstream; I have not filed anything.
- Deviations from this task file's description, both deliberate:
  1. **The client does not set `view` to `volume-comparison`.** It cannot construct
     `view.baselineEpoch` without duplicating the tool's "window immediately preceding" default, and
     the tool switches the lens anyway. Verified above that it does.
  2. **The compare button is hidden on a superseded render**, alongside mute rather than alongside
     Investigate. Investigate is safe when stale because it only sends a prompt; comparing _writes_
     a refinement first, and `runFetch` no-ops without `fetchView`, so on a read-only render the
     refinement would never be persisted and the turn would run unscoped.
- Unverified: every failure path (see the races below) — none was driven with a forced 500. The chip
  label at narrow widths, light theme, and the agent's behaviour on a second consecutive comparison
  were not exercised. `baselineTotal` is 0 because the seed does not span the 24–48 h baseline, which
  is expected per the state doc, so the two-series histogram was not visually re-checked here.
- **Three races, found by review after the feature worked, none yet fixed:**
  1. **A failed refetch never writes the refinement, but the turn still starts.** Mine.
     `requiresImmediateFetch` sends this action down the path that passes `persistOnFailure: false`;
     only the debounced mute path sets it true. On any 500 the agent charts the whole index while the
     user sees a scope chip. Fix: pass `persistOnFailure: true` for this action.
  2. **A failed write also still starts the turn.** Pre-existing; `persist`'s `.catch` resolves, so
     `flushPendingWrites` cannot signal failure. Affects Investigate and Summarize too, but only
     changes the _meaning_ of this one. Fix touches `startTurn`'s contract — probably its own item.
  3. **Two Compare clicks before the table narrows.** Reachable: the table only shrinks once the
     refetch lands (~400 ms) and nothing disables the row buttons while `isFetching`. Two
     `only-pattern` refinements have different keys, so `addRefinement` will not dedupe them, and
     `buildRefinementFilter` ANDs them into a guaranteed-empty histogram, plus two turns. Fix:
     replace-semantics for `only-pattern` as `applyAgentKqlFilter` already has, or gate on
     `isFetching`.
- Next: fix races 1 and 3 here; raise race 2 and the upstream Elasticsearch report with the
  coordinator. The feature itself is done and verified.

### 2026-09-04 — races 1 and 3 fixed; the duplicate-turn half could not be reproduced

- Changed:
  - `public/.../use_log_exploration_state.ts` — new `changesRefinements` predicate; an immediate
    fetch triggered by `ADD_REFINEMENT` or `REMOVE_REFINEMENT` now passes `persistOnFailure: true`.
    Fixes race 1. This also fixes the same latent bug in `REMOVE_REFINEMENT`, which was never in the
    task: removing a chip whose refetch failed left the removal unwritten.
  - `common/log_exploration.ts` — `addRefinement` now replaces an existing `only-pattern` instead of
    accumulating. Two scopes AND to nothing, since a document belongs to one category.
  - `public/.../log_exploration_attachment.tsx` — `startTurn` guards against re-entry.
  - Tests: three new cases, plus a control asserting a failed **range** change still does not
    persist (it rolls back instead, so persisting it would be wrong).
- Verified:
  - **Negative control on the unit tests.** Disabled both fixes; exactly the three new tests failed
    and nothing else did. Restored, 171 pass.
  - **Race 1 driven in the browser with a forced 500** on the patterns route. Request order became
    `POST patterns (500)` → `PUT attachment` → `POST converse`, the failure callout showed, and the
    stored attachment version 2 carried the `only-pattern` refinement despite its fetch failing.
    The agent's histogram then totalled 720, the scoped count. Before the fix this path would have
    charted 3685.
  - `type_check`, `eslint`, `jest` all pass.
- **Unverified, and I could not make it fail: the duplicate-turn guard.** Four attempts, including
  with the guard disabled as a control, never produced two `converse` calls. Instrumenting the
  window explains why the obvious repros miss rather than proving the race is impossible: the
  clicked button is already detached at 0 ms (React re-renders synchronously), and on this seed the
  refetch lands so fast that the table is down to one row by 50 ms — so a second row is clickable
  for well under 100 ms. The state doc measured 363–473 ms for the same refetch under other
  conditions, so the window is not always that small.
  - I checked whether the framework already prevents it: it does not. `useSubmitMessage` calls
    `sendMessage` unconditionally, with no in-flight gate.
  - So the guard is **kept but unproven**. It is six lines, it cannot regress anything, and the
    failure it prevents (two turns whose messages disagree about which pattern is scoped) is
    user-visible. If the coordinator would rather not carry unverified defensive code, deleting it
    is safe and the singleton fix still makes the _data_ correct if the window is ever hit.
- Race 2 (a failed write still starts the turn) is untouched, as agreed — it changes `startTurn`'s
  contract for Investigate and Summarize too.
- Next: none from this agent. LX-7 is done pending the coordinator's call on race 2, on the guard
  above, and on whether to report the Elasticsearch `must_not` behaviour upstream.
