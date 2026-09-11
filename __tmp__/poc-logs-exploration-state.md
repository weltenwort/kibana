# Logs Exploration PoC — current state

> Companion files: [`poc-logs-exploration-plan.md`](./poc-logs-exploration-plan.md) (decisions and
> rejected alternatives), [`poc-logs-exploration-next-steps.md`](./poc-logs-exploration-next-steps.md)
> (the work queue).

Branch `logs-exploration-poc`. Everything below is implemented and verified against a running
instance unless marked otherwise.

## Acceptance criteria status

| AC                                                | Status                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| Renderer A: pattern table with per-row sparklines | done                                                                            |
| Renderer B: baseline-comparison histogram         | done — two clustered bar series                                                 |
| Both validate payload and fail visibly            | done — zod server-side, error callout client-side                               |
| Agent selects the right one without being told    | done                                                                            |
| Mute a pattern (instant)                          | done — row gone by the 105 ms sample, no remount                                |
| Time range picker (instant)                       | done — refetches, no remount                                                    |
| Baseline epoch picker (instant)                   | done — refetches, no remount                                                    |
| Investigate a pattern (agent turn)                | done                                                                            |
| Summarize remaining patterns (agent turn)         | done — relabelled "Summarize top patterns"; now interpretation, not enumeration |
| Instant vs agent-turn visually distinct           | done — sparkle icon + tooltips                                                  |
| Loop state survives turns                         | done                                                                            |
| Minimal skill                                     | done                                                                            |

All acceptance criteria are met.

## Local edits to other teams' code

**Not PRs.** Must be reverted or upstreamed properly before anything ships.

| File                                                                 | Change                                                                                                                                                                                                   |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent-builder-server/allow_lists.ts`                                | Two tool ids, one skill id, one attachment type id. `register*` throws without them                                                                                                                      |
| `agent_builder/server/routes/attachments.ts`                         | Content PUT passes `ATTACHMENT_REF_ACTOR.user` and calls `addAttachmentsToLastRound` instead of `client.update`, so the round ref advances. Falls back to the old path when a conversation has no rounds |
| `agent-builder-browser/attachments/contract.ts`                      | Optional `updateContent` and `submitMessage` on `GetActionButtonsParams` and `InlineRenderCallbacks`                                                                                                     |
| `agent_builder/public/services/attachments/attachements_service.tsx` | Added `updateContent`                                                                                                                                                                                    |
| `agent_builder/public/.../inline_attachment_with_actions.tsx`        | Wired both capabilities into its two renderer call sites; added a `useSubmitMessage` mock to its test                                                                                                    |

## What was built

**Server** — `x-pack/solutions/observability/plugins/observability_agent_builder/server/`

- `attachments/log_exploration.ts` — attachment type, **`isReadonly: true`** since LX-9 so that
  `attachments.read` returns `format()` instead of the raw payload. `format()` forbids naming muted
  patterns, including them in a summary, count or comparison, or investigating them — while allowing
  the agent to say _how many_ are muted, added after it obeyed the exclusion but named both muted
  patterns in an aside. It states the un-muted count rather than leaving the model to count (it had
  opened with "6 un-muted patterns" above its own correct 8-row table), states the top-N cut before
  listing rows, and forbids totalling the counts into a document count. `formatHistogram()` states
  the signed change and percent, the busiest bucket per epoch and the bucket that moved most.
  `getAgentDescription()` carries the same framing. Since LX-10 it also carries the three prose cases
  (render / prose-only / analyse-then-re-render), a `WHEN TO RE-RENDER THIS VIEW` block that
  interpolates the real `attachment.id` into a ready-made tag, each row's share of the cut, a `trend`
  token from the sparkline, and a `Shape of this cut` block. The un-muted count sentence sits
  **immediately before the row list**, ending in a colon — see the regression below.
- `attachments/emit_log_exploration_attachment.ts` — `getActive()` → merge loop state forward →
  `update()`, else `add()`. Also `injectAttachmentIds` and `resolveRange`.
- `tools/explore_log_patterns/` — `CATEGORIZE` + `SPARKLINE`, `LIMIT MAX_PATTERNS` (8 since LX-1; the
  handler interpolates the constant). Muted patterns are pushed down as a `must_not` DSL filter
  (tokens via `extractCategorizeTokens`, as Discover's patterns profile builds them) so the top-N
  backfills. `tool.ts`'s description says the query is a top-N cut.
- `tools/explore_log_volume_comparison/` — two `BUCKET` queries sharing one computed interval, normalised
  to index-addressed arrays so the epochs overlay on one axis.
- `routes/log_exploration/route.ts` — `POST /internal/observability_agent_builder/log_exploration/`
  `{patterns,volume_comparison}`, zod-validated, `apiPrivileges.readAgentBuilder`. Stateless wrappers
  over the same two handlers, so there is one query implementation, not two.
- `utils/esql.ts` — allow-list validation for index patterns and field names (ES|QL has no parameter
  binding for identifiers), plus `pickBucketInterval`.
- `utils/log_exploration_refinements.ts` — `buildRefinementFilter`, the single kinds-to-DSL
  translation: `exclude-pattern` → `must_not`, `only-pattern` → the identical clause under `filter`,
  `kql` → `query_string`. It always emits a positive clause, `match_all` when there is no other — see
  the Elasticsearch finding below. Both handlers use it; `explore_log_volume_comparison` had no filter
  before.
  `resolveSource` extends `resolveRange`'s precedence to `index` and `messageField` — the latter lost
  its `.default('message')`, which had made "the model said message" and "the model said nothing"
  indistinguishable, the same defect as bug 1.
- `skills/logs_exploration/` — skill body. **Must not be `experimental: true`** or it is filtered out.
  Includes a "The pattern table is a top-N cut" section: which words to use, do not sum the counts,
  the view cannot answer "how many distinct patterns exist", and a pattern appearing after a mute is
  a promotion rather than new data.

**Common** — `common/log_exploration.ts`: shared zod schema — `{ source, refinements[], view, result }`
since LX-8 — imported by both `validate()` and the renderer. `refinements` is a discriminated union
over `exclude-pattern` / `only-pattern` / `kql` carrying `origin`; `view` and `result` are unions on
the same discriminant; `logExplorationRequestSchema = logExplorationDataSchema.omit({ result: true })`
replaces the two hand-written request schemas. `addRefinement` dedupes by `refinementKey` (mute
idempotence is load-bearing) and caps at `MAX_REFINEMENTS`. Every bound is load-bearing since
`maxContentLength` is unenforced — and three were wrong before LX-8 re-derived them: `kqlFilter`
capped at 1024 while the tools accept 4096, `index` likewise, and `messageField` and `generatedAt`
both reusing the 64-char datemath bound. A tool input the schema accepted could have produced an
attachment that failed validation. Found by inspection, never observed.

**Browser** — `public/attachment_types/log_exploration/`

- `use_log_exploration_state.ts` — reducer, single-flight write queue, sequence-numbered aborting
  refetch, `flushPendingWrites`, `PERSIST_FAILED` and `FETCH_FAILED` reverts. Since LX-8 the actions
  are `ADD_REFINEMENT` / `REMOVE_REFINEMENT`, so a new kind needs no new action, and `FETCH_FAILED`
  rolls back `source.timeRange` **and** `view`. Adding an `exclude-pattern` is debounced by
  `MUTE_FETCH_DEBOUNCE_MS = 300` and carries the write; everything else — removal, other kinds,
  window, lens parameter — refetches immediately.
- `fetch_log_exploration_view.ts` — a path lookup on `view.type`; the request body is the payload
  minus `result`.
- `log_exploration_attachment.tsx` — branches on `data.view.type`, computes `isReadOnly`, registers
  the per-lens global action, and on a writable scoped comparison prepends a `SECONDARY`
  "← Back to top patterns" action that removes the `only-pattern` refinement and starts an agent
  turn.
- `exploration_controls.tsx` — the window picker is `@kbn/date-range-picker`'s `DateRangePicker`
  (since LX-16) with all four shift/zoom buttons, plus the refinement chips. `value` is
  `` `${start} to ${end}` ``, `onChange` guards on `isInvalid`, and `settings` is local state.
- `pattern_table.tsx`, `baseline_histogram.tsx`, `sparkline_chart.tsx`
  (copied from Discover, which does not export it). The grid `aria-label` and the all-muted empty
  state name the limit; there is deliberately no top-N caption in the view. The histogram draws both
  epochs as clustered `BarSeries`. Rows carry three actions since LX-7 — mute (`eyeSlash`),
  compare-baseline (`chartAreaStack`) and Investigate (`sparkles`) — in a 108 px trailing column.
- `README.md` — the canonical caveats list.

## Measured behaviour

|                                  | Without invalidation (shipped) | With invalidation (experiment)            |
| -------------------------------- | ------------------------------ | ----------------------------------------- |
| Row disappears                   | ~50 ms                         | ~50 ms (local state)                      |
| Subtree rebuilt                  | never                          | ~712 ms after every click                 |
| Network per click                | one ~16 KB PUT                 | ~16 KB PUT + two ~40 KB conversation GETs |
| Clicking faster than the rebuild | correct                        | rows revert on screen                     |

ES|QL `CATEGORIZE` + `SPARKLINE` query: ~250 ms over 2160 docs.

**Refetch, measured in the browser:** a range change swaps the table contents within one 60 ms
sampling frame (2 h counts `82,61,41` → 24 h counts `720,540,360`), with no subtree remount — a
property stamped on the container DOM node survived every interaction. Two range changes in quick
succession both issue a request and the later one wins. A forced 500 on the route rolls the window
back and shows a callout without touching the data.

**Refetch decisions, and why:**

| Interaction    | Refetches            | Reason                                                                        |
| -------------- | -------------------- | ----------------------------------------------------------------------------- |
| Time range     | yes                  | Every number in the view belongs to the window                                |
| Baseline epoch | yes                  | The baseline series is queried per epoch                                      |
| Unmute         | yes                  | The query excluded the pattern, so its retained count is from an older window |
| Mute           | yes, 300 ms debounce | Only 8 rows are shown, so the row below the cut has to move up                |

Mute was originally the exception — no refetch, to keep it instant. LX-1 reversed that once the table
shrank to 8 rows. The debounced refetch also carries the write, so `flushPendingWrites` fires a
waiting one rather than waiting the timer out, and a failed mute refetch still persists the mute.
The row leaves local state before any I/O, so "instant" still holds.

**Top-N backfill at `LIMIT 8`, driven in the browser** (32-category seed, no reseed):

| Action                        | Observed                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| First render                  | `aria-rowcount` 8                                                                        |
| One mute, sampled every 50 ms | row gone by 105 ms; one patterns request at 363 ms; 8 rows again at 422 ms, rank 9 in    |
| Three mutes ~65 ms apart      | 7 → 6 → 5 instantly, then a **single** refetch at 473 ms restoring 8, ranks 9–11 in      |
| Reload after those four mutes | 4 unmute chips, same backfilled 8 rows — the debounced write landed                      |
| Mute then Summarize           | patterns 141 ms → content PUT 215 ms → converse 1321 ms; the flush fired the fetch early |

No subtree remount in any of these: a property stamped on the grid DOM node survived. At the route,
`logs-poc-default` / `now-24h` returns 8 rows, and muting the top pattern still returns 8 with rank 9
(Kafka consumer lag, 83) promoted.

**Superseded, kept for comparison — the same test at `LIMIT 25`, before LX-1:** muting the top pattern
left 24 rows immediately (no refetch, as designed then); the next range change returned to 25 with
rank 26 promoted. Confirmed at the route
(`promoted: ['…Config reload picked up new upstream endpoint list…']`) and in `aria-rowcount`:
25 → 24 → 25.

**Histogram density at the 48-bucket worst case** (8 h absolute window 09:10 → 17:10 over the seeded
span, baseline 1 hour earlier): chart content 744 px, so ~15.5 px per bucket and ~6 px per clustered
bar. Both epochs read clearly as bars. Note the default 24 h window is a poor test — the seed spans
only 11:09–17:09 on 2 Sep, so the baseline epoch is empty and the series never share a bucket.

**Both views honour refinements — measured at the volume route, not inferred.** Until LX-8 the
histogram had no filter parameter at all: `getLogVolumeComparison` took only `kqlFilter`, so muting
noise never affected the volume chart. Seeded window 14:10–17:10 on 2026-09-02, baseline 11:10–14:10:

| refinements             | current | baseline |
| ----------------------- | ------- | -------- |
| none                    | 1823    | 1830     |
| exclude the top pattern | 1464    | 1470     |
| only that pattern       | 359     | 360      |

1464 + 359 = 1823 and 1470 + 360 = 1830 exactly, so exclude and only are complements over the same
clause. In the browser, removing a mute chip on the histogram raised the y-axis top gridline from 80
to 100 — the bug closing on screen.

**Compare-baseline, driven end to end (LX-7):** clicking the row action issues
`POST …/patterns` → `PUT …/attachments/<id>` → `POST …/converse/async`, so the refinement is
persisted before the turn starts. The resulting attachment holds exactly one `only-pattern`
refinement with `origin: 'user'`, `view.type: 'volume-comparison'`, and `result.histogram.current`
totalling **720** — exactly the row's count in the table. Removing the chip leaves `refinements: []`
and a histogram totalling **3685**; 720 + 2965 = 3685 at the route.

`roundRefVersions` measured `[[1,2],[3]]`: round 0 stays pinned below the histogram's version and
still renders the table, with 0 mute, 0 compare, 1 investigate, a "Superseded" badge and a chip with
no remove button. The version-pinning conclusion was read from framework source in LX-7's planning;
it is now measured.

**Elasticsearch: a bool containing only `must_not` is silently ignored by one ES|QL shape.** Isolated
against Elasticsearch 9.6.0-SNAPSHOT. A pushed-down filter whose bool has only `must_not` has no
effect when the query combines a `WHERE @timestamp` range with `STATS … BY BUCKET(@timestamp, …)`.
Every other shape tested honoured it — `STATS` alone, `WHERE` alone with a literal or a param,
`WHERE` on a non-time field, and `BUCKET` without a `WHERE`. Adding any positive clause restores it,
which is why `buildRefinementFilter` now always emits one. Measured on the volume route before the
fix: **3685** unfiltered, **360** with `only-pattern`, **3685** with `exclude-pattern`. An earlier
hypothesis — a `COUNT(*)` doc-count shortcut — was disproved by the probe before the fix was written.
Not reported upstream; nobody has filed anything.

**Per-lens global actions, driven (LX-9):** the volume lens registers exactly one button, "Explain
this change", and answers from the summary lines alone — totals 1,764 / 1,657, `+107 documents,
+6.5%`, busiest bucket per epoch, moved-most bucket 48 → 146, with no raw bucket enumeration. The
pattern lens registers exactly one, "Summarize top patterns"; an older round in the same conversation
still showed the histogram with its own action, so per-lens registration holds per render and
superseded renders keep their header.

**Summarize AC re-driven after `format()` went live**, not assumed: two mutes → backfill to 8 → the
summary named the 8 un-muted patterns and the muted count, matched `aria-rowcount` 8, included both
promoted patterns with correct counts, named neither muted pattern, and scoped percentages to "the
visible cut". Persisted state cross-checked in the conversation API: `readonly: true`, v2 holding 10
patterns (8 fetched + 2 retained) with 2 `exclude-pattern` refinements.

**Prose no longer drifts from the view (LX-10), driven in the browser.** On a render round the
sentence read "over the selected window" although the user had asked for "the last 24 hours"; moving
the picker to Last 6 hours refetched (top row 720 → 717) and left the prose still correct, because it
asserts nothing the picker can change. Asked outright — "What window is this? And what filters are in
effect?" — the agent called `attachments.read` and answered "As of this reading: Time window:
`now-6h` to `now` … Muted patterns: none", noticing the picker had moved since the request. A
prose-only Summarize named its inputs as decided: "computed from the last 24 hours (`now-24h` to
`now`) with 2 patterns muted". "Explain this change" answered 600 against 426, `+174, +41%`
(174/426 = 40.8%), busiest bucket per epoch, moved-most bucket 34 → 98, with no literal timestamps.
The zero-baseline branch was exercised for the first time — 0 baseline documents, no percentage
stated. A Summarize that recommends actions now ends with a live table: 8 rows, 8 **enabled** mute
buttons, attribution above the tag and nothing below it.

**Stale answers, before and after LX-12 — and the measurement is weak, deliberately stated.** Before:
**1 stale answer in 5** follow-up rounds, each round being ensure-a-writable-render → mute the top row
→ ask a short follow-up. After: **0 in 7**, including the exact sequence that failed and the same
short phrasings ("Biggest?", "And now?", "Top pattern?"). Every round called `attachments.read` and
every answer tracked the cut down as mutes accumulated: 540 → 360 → 180 → 150 → 120 → 90 → 85. **At a
~20 %-per-round failure rate, 7 clean rounds happen about 1 time in 5 by chance**, so this does not
establish the rate is now zero — the direction is right and the mechanism is understood, nothing
more. Both carriers were confirmed present in the model's context rather than assumed: the
`load_skill` result contained the new guard and no longer the false claim, and the `attachments.read`
result ended with `END OF READING. The numbers above were fetched at 2026-09-09T15:58:53.914Z`.

**Leaving a scoped comparison (LX-14), driven twice end to end.** One header click takes a scoped
histogram back to an unscoped pattern table: chip gone, 8 rows, fresh query, the window preserved,
the primary action back to "Summarize top patterns". The agent called
`observability.get_log_patterns` with `params: {}` — no reconstructed pattern, no range — so the
window and any mutes carried forward. (LX-17 has since renamed that tool `explore_log_patterns`; the
id above is what was observed at the time.) Attachment versions across one click, read from the
attachments API:

```
v8  volume-comparison  [only-pattern]
v9  volume-comparison  []               <- the click's own write, exactly one
v10 pattern-table      []               the agent's get_log_patterns
```

Two versions per round trip, the same shape and cost as compare-baseline (which produced v3 + v4).
On the superseded comparison render the button is absent and that render's `Only:` chip has no remove
icon, so write-disabled-on-stale holds for the new control. The header measured 768 px, so labels
show; `AttachmentHeader` switches to icon-only below 560 px.

**Window shift and zoom (LX-16), driven on both lenses.** Previous moved `16:44→18:44Z` to
`14:44→16:44Z`; zoom out took 2 h → 3 h and zoom in 3 h → 1 h 30, both centred. The persisted payload
was read back after each of the four operations: the offset between `source.timeRange` and
`view.baselineEpoch` was **3612484 ms on every one**, and the baseline length tracked the window
(120→120, 180→180, 90→90 minutes) — so the epochs stay comparable through shifts and zooms. On the
pattern table the same control refetched and moved the ranking: counts 270→257, 202→193, 135→129,
45→43, with Kafka overtaking Disk at 30 against 29. On a superseded render all four buttons are
`disabled` while the newer render's stay enabled.

The 3612484 ms is 1 h + 12.5 s, not 1 h exactly. It is not drift introduced by shifting: it was fixed
when a relative `now-2h` window first became absolute, because `shiftBaselineEpoch` resolves `now` at
dispatch time. Every later shift and zoom preserved it exactly.

**The invalidation race, sampled every 20 ms across two mutes 200 ms apart:**

```
t=38    5 rows   mute #1 applied locally
t=257   4 rows   mute #2 applied locally
t=405   5 rows   <- muted row REAPPEARS
t=1393  4 rows   settles once mute #2's write lands
```

A three-click sequence then landed the third click on an already-muted pattern, because the reverted
row returned to position 0 under the pointer. Nothing was lost only because `MUTE_PATTERN` is
idempotent. This is why content writes do not invalidate.

## Bugs found by running it

All six passed type-check, lint and unit tests. The last three were visible only in the browser.

1. **Time-range trap.** `loopState.timeRange ?? { start, end }` made loop state win unconditionally,
   so the first emitted range became permanent and the agent could never widen a window that returned
   nothing — it just saw an empty result and concluded the data was missing. Fixed by `resolveRange`:
   explicit request → user state → default, with `start`/`end` genuinely optional so omission is
   meaningful. Unit test pins the precedence.
2. **Cross-render clobber.** The attachment renders in more than one round, and without invalidation
   those instances never reconcile. Reproduced destroying a mute: muting in an older render PUT a
   full payload derived from its stale base. Fixed by disabling writes on superseded renders — but
   only where a round carries a ref. LX-10 found the case where neither does; see the defect list.
3. **Disappearing header.** The first read-only implementation suppressed _all_ actions including
   Summarize, and `AttachmentHeader` returns `null` with no buttons — deleting the title, icon and the
   "Superseded" badge. Fixed by narrowing read-only to writes only; agent-turn actions are safe on a
   stale render because they only send a prompt and the agent reads live state.

4. **Unmute restored a row with a stale count.** With mute pushed into the query, a refetch drops
   muted patterns from the payload, so the client keeps the previously seen entry to make unmute
   possible at all. Restoring it after a range change put a count from the _old_ window back in a
   table whose other rows belonged to the new one — the same defect the refetch work existed to fix,
   one row smaller. Caught in the browser: unmute after a 3 h → 24 h change showed `540,360,…,255`.
   Fixed by making unmute refetch; the retained entry now only bridges the round trip.
5. **`flushPendingWrites` did not cover refetches.** Once persistence moved behind the fetch, an
   agent turn started right after a range change could read the old window, because the flush only
   awaited the write queue. It now awaits the in-flight fetch first.
6. **The dataset could not exercise the top-N.** Seven categories against `LIMIT 25` meant muting
   could never promote a new pattern, so the backfill looked correct only because nothing was ever
   cut. The seed now produces 32.

Also: `eyeClosed` is not an EUI icon (EUI ships `eye` and `eye_slash`). Invalid icon names fail
silently — no type or lint error.

8. **LX-10's writing rule was read as a reading rule.** "Prefer saying what the user cannot already
   see" appeared unscoped in both `format()` ("Repeating a row, a count or a bar back to them is not
   an answer") and the skill, and neither said "read anyway". Compounding it, the skill still opened
   its state section with a claim false since LX-9: "The attachment's content is in your context … It
   is authoritative." Between them the model had explicit licence to answer without reading, and
   took it. Reproduced: on a question-only round (`attachment_refs: []`, `tools: []`) it answered
   "the live table already has the answer right in front of you … based on my last reading, it's the
   **cache miss for key `session`** pattern at **540 documents**" — while that pattern was muted and
   the live top row was "User authenticated successfully" at 360. A self-inflicted regression, not
   only a framework gap. Fixed by scoping the rule to what the model _writes_, deleting the false
   claim, and adding the staleness warning after the rows.

9. **The un-muted count miscount came back, from moving a sentence.**LX-9 fixed the agent opening
   "6 un-muted patterns" above its own correct 8-row table by stating the count in `format()`. LX-10
   then inserted the top-N and `trend` explanations _between_ that sentence and the row list, so the
   count no longer introduced the rows, and the model went back to computing `MAX_PATTERNS − muted`.
   Fixed by restoring the count to the last position before the rows, ending in a colon, and naming
   the failure outright: muting refills the cut, so that subtraction is wrong. The lesson is about
   position, not wording — a rule in `format()` is only as strong as its adjacency to what it
   governs.

## Corrections to earlier assumptions

- **DOM-nesting warnings are pre-existing framework behaviour, not a cost of this PoC.** The grid is
  inside a `<p>`, but that `<p>` sits _above_ the attachment panel; the framework's own
  `EuiSplitPanel.Outer` is already a `div` inside it. Every attachment type with `renderInlineContent`
  hits this. Two deduplicated warnings, correct layout. The real fix is hoisting block nodes out of
  paragraphs in the markdown plugin.
- **Invalidating is not _incorrect_.** Writes are serialised and the rebuild re-seeds from a server
  that already has every mute, so the data converges. The cost is the visible revert above, plus
  network amplification.
- **Focus loss is not a differentiator** — it happens in both modes, because removing the row destroys
  the focused button.
- **LX-8's exclusion measurement is contradicted and should not be trusted.** It recorded, at the
  volume route, `1823 / 1464 / 359` for none / exclude-top / only-that, presented as proof that
  muting reaches the histogram. LX-7 then measured `3685 / 3685 / 360` on the same route and found
  `exclude-pattern` had no effect at all, for the reason above. Both cannot be right. The pre-fix
  state can no longer be reproduced, so which run was mis-taken is unresolved — treat the exclusion
  numbers as unknown before the `match_all` fix, and the `only-pattern` numbers as consistent across
  both.
- **`format()` never reached the model until LX-9.**Both this doc and the plan asserted the
  attachment's content was in context every round. It was not: `prepareRoundInput` hardcodes
  `attachments: []`, only metadata is injected, and `attachments.read` returns the raw payload unless
  the type sets `isReadonly: true` — which ours did not. Every rule in `format()` was dead code and
  the agent reasoned off raw JSON, observed directly when it quoted `121, 143, 146` and "buckets
  33–36 are 0", values that appear only in the raw series. Any earlier claim in these docs about
  model behaviour being shaped by `format()` predates the fix and was measuring something else.
- **The histogram never reaches 60 buckets.** `MAX_HISTOGRAM_BUCKETS = 60` is the ES|QL `LIMIT`, but
  `pickBucketInterval` is called with `MAX_HISTOGRAM_BUCKETS - 12` and snaps the interval _up_ to a
  round candidate, so the worst case is 48. Measured at the route: 5 h window → 30 buckets, 6 h → 36
  @ 10 min, 8 h → 48 @ 10 min. Anything reasoning about density "at 60 buckets" is reasoning about a
  case that cannot occur.

## Known defects, deliberately not fixed

- **The agent sometimes answers from stale transcript text instead of re-reading the attachment.**
  Reproduced and mitigated in LX-12 — 1 in 5 before, 0 in 7 after, which is too few rounds to call it
  closed. The framework half is unfixed and was deliberately not worked around: a round with no
  `attachment_refs` receives no attachment metadata and no type description, so the moment the
  reminder is most needed — the user changes the view, then asks — is the moment none is sent.
  Nothing filed with Agent Builder; the plan's framework notes are the record.
- **Muted patterns are being named again, in conversational asides.** LX-9 fixed this and it has
  regressed: observed in 3 of LX-12's runs, **both before and after** its change, e.g. "the pattern
  you asked about previously (`GET … api/v1/orders … 200`) has since been **muted** by you".
  `format()` still forbids it. Unrelated to LX-12's mechanism and untouched by it. The Summarize AC
  itself was passing as recently as LX-10's drives, so this is the aside path, not the summary path.
  **Accepted for this PoC** — not queued, not being fixed.
- **Two live renders of one attachment lose writes, and LX-10's re-render makes that routine.**
  Read-only-on-stale does **not** contain this: `resolveAttachmentVersion` falls back to
  `versions.at(-1)` when a round has no ref, so both renders resolve to the latest version,
  `version < versionCount` never fires, and neither render is marked superseded — no badge, all
  buttons enabled. Reproduced deliberately once: muting in the new render left the pattern listed in
  the old one; muting a different row in the old render and reloading showed the new render's mute
  **gone**, its pattern back with no chip. A mounted render cannot discover it has been superseded,
  because props stay frozen and content writes must not invalidate. No cheap guard exists —
  `stale_check.ts` is origin-staleness, not version concurrency, and the content-update route is
  Agent Builder's (LX-6). Accepted for the PoC; the real fix is LX-3's delta writes.
- **A failed write still starts the agent turn.** `persist`'s `.catch` resolves, so
  `flushPendingWrites` cannot signal failure and `startTurn` proceeds. Pre-existing, and it affects
  Investigate and Summarize too — but it changes the _meaning_ of compare-baseline, which submits a
  message whose scope lives in the write that just failed. Fixing it changes `startTurn`'s contract;
  queued as LX-11.
- **Ref accumulation.** One ref entry appended per button click, unbounded. Observed six refs on a
  single round after five mutes. Agent Builder's call.
- **Chip placement.** `actor: user` puts version chips beside the user's prompt under a hardcoded
  "Added" label.
- **The two histogram series share a hue.** Borealis builds the vis ramp in `60`/`30` pairs, so any
  two-series chart taking the default gets `#16C5C0` and `#A6EDEA` — teal at two lightnesses. Kept:
  four explicit overrides were reviewed and none read better. The `60` shades are near-iso-luminant,
  so no pair of them separates on lightness: measured luminance-contrast ratios are teal/pink
  `1.29:1`, teal/grey `1.25:1`, teal/blue `1.20:1`. Mixing a `60` with a `30` is the only on-palette
  way to get lightness separation — teal60/blue30 (`vis0`+`vis3`) measures `1.51:1`. Start there if
  this is revisited.
- **Silent disappearance.** `render_attachment_plugin.tsx` returns `null` with no diagnostic when the
  resolved version is missing from `versions[]`. If an attachment vanishes rather than erroring, check
  the round's `attachment_refs` against stored versions first.
- **Full-payload writes cannot express concurrent intent.** Read-only-on-stale contains it; shipping
  would need delta writes (`{ mute: pattern }`), which is a real API design question.

## Not verified against a running instance

Everything else in this doc was driven in the browser or measured at the route. These were not.

- Unmute after a mute-triggered refetch. The path is unchanged by LX-1, but it was not re-driven.
- The persist-on-failure branch for a failed mute refetch — unit test only, no forced 500 in the
  browser.
- Whether the extra write per mute makes ref accumulation materially worse. Not measured.
- The top-N framing was exercised with one phrasing, on Claude Sonnet 4.6. Not tested across several
  turns, on another connector, or against a direct request for a total document count.
- The histogram in light theme; baseline offsets other than "1 hour earlier" and "24 hours earlier";
  tooltip and legend hover on the two bar series.
- **`only-pattern` has no UI yet**, so its chip has never been rendered — only its DSL and its reducer
  handling are covered. LX-7 emits the first one.
- `applyAgentKqlFilter`'s replace-on-pass — unit-tested, never driven across two agent turns with two
  different filters.
- The `MAX_REFINEMENTS` cap silently drops the next refinement past the limit. Unit-covered only;
  nobody has muted 60 patterns in a browser.
- The rewritten `format()` output was not read back from a model's context and the Summarize AC was
  not re-driven, though the wording it depends on is unchanged verbatim.
- Whether `messageField` losing its `.default('message')` changes anything for the model. Read from
  the schema, not exercised with a tool call passing a non-default field.
- **The duplicate-turn guard in `startTurn` is unproven.** Two compare clicks before the table
  narrows would produce two turns disagreeing about the scope. Four attempts failed to reproduce it,
  including with the guard disabled as a control. Instrumenting the window explains why the obvious
  repros miss rather than proving it impossible: the clicked button is detached at 0 ms and on this
  seed the refetch lands by ~50 ms, so a second row is clickable for well under 100 ms — against the
  363–473 ms measured for the same refetch under other conditions. `useSubmitMessage` calls
  `sendMessage` with no in-flight gate, so the framework does not prevent it. The guard is six lines
  and cannot regress anything; the singleton `only-pattern` fix keeps the _data_ correct either way.
- Compare-baseline's chip label at narrow widths, in light theme, and the agent's behaviour on a
  second consecutive comparison.
- The "6 un-muted" miscount was observed once and its fix driven once — not repeated across
  connectors or several turns.
- `isReadonly: true` was verified not to block the tool emit or the user's writes by reading the
  enforcement sites and by observing writes still landing. The agent's own `attachments.update` on
  this type was never attempted, so the new rejection path is unexercised.
- Attachments created before the flag keep `readonly: false` in storage; `attachment_read` branches
  on the type definition, so they should still get `format()`. Reasoned from source, not driven
  against a pre-flag conversation.
- "Explain this change" was driven on one seed shape (a single burst) — not on a drop, an empty
  baseline, or a scoped (`only-pattern`) comparison.
- `getAgentDescription()` being injected once per conversation is read from `to_langchain_messages`
  (`attachmentTypeInstructionsProvided`), not measured.
- **All of LX-10's prose behaviour is one connector (Claude Sonnet 4.6) and a handful of drives.**
  The count fix was driven once and the miscount before it observed once — one-for-one either way.
  Not driven: a scoped (`only-pattern`) view, a KQL-filtered view, an all-muted table under the new
  prompt, or a single turn that both renders a view and answers a prior question, which the
  three-case rule assumes the model can tell apart.
- The re-render was driven once, after Summarize. Nobody checked the other half of the condition —
  that the model **withholds** it after "Explain this change". The above/below attribution rule was
  never adversarially tested, because the model put the tag last and left no text below it.
- Whether a re-render inside an analysis round appends a ref. If it does, ref growth (LX-5) is one
  more per analysis.
- The share and trend arithmetic is unit-tested, but no rendered sparkline was cross-checked against
  the trend the model quoted.
- The drift test and the adversarial "what window is this?" ask were not re-driven after the rule
  became conditional, though both live in the unchanged `IN EVERY CASE` section.
- How often the two-live-renders clobber happens accidentally — it was reproduced deliberately, once.
- **LX-12's after-measurement is 0 stale in 7 rounds against a ~20 % baseline rate** — about a 1-in-5
  chance of happening anyway. One connector, one seed, one conversation shape per phase, pattern-table
  lens only; the volume lens gets the same trailing block by construction and is unit-tested, but no
  stale repro was attempted on it.
- The **first** read in a conversation is still uncovered by `format()` — with no read there is no
  warning. Only the skill and the standing system-prompt rule apply.
- Compaction drops the staleness warning with the round it belongs to. Not driven in a conversation
  long enough to compact.
- Icon-only header mode below 560 px — reasoned from `COMPACT_WIDTH_THRESHOLD`, never driven, so
  nobody has seen the two header icons side by side.
- "Back to top patterns" with a `kql` or `exclude-pattern` refinement present alongside the scope.
  The removal is keyed, so it should leave them; not driven. Its read-only path was observed only as
  button absence, not by clicking through a stale render.
- The window picker's `isInvalid` path — typing an unparseable range. The guard is in the code, never
  driven. No unit test covers the picker itself; the `SET_TIME_RANGE` reducer tests are untouched.

## Running it

- Kibana `http://localhost:5601`, Elasticsearch `http://localhost:9200` (`elastic:changeme`). Port
  forwarding also exposes the same Kibana on 5602 — if a log or screenshot says 5602, it is the same
  instance. Use 5601.
- Reseed: `node __tmp__/seed_logs_poc.js` — 3685 docs, **32 distinct categories**, into the
  `logs-poc-default` data stream. The `logs-*` template mandates data streams, so bulk uses `create`
  ops. Timestamps carry a deliberate burst since LX-9: an even spread made current and baseline
  totals match to within rounding, so "Explain this change" had nothing to explain and a correct
  implementation was indistinguishable from a broken one. The tail beyond the tool's `LIMIT` is
  deliberate: with only the original 7 patterns, muting can never promote a new one and the refetch
  backfill is untestable. Counts descend strictly, so the top-N cut and the pattern promoted by a
  mute are both predictable. **The seed is anchored to the moment you run it** — it ages out of
  recent windows, so an empty chart usually means reseed, not a bug.
- Checks: `node scripts/type_check --project <plugin>/tsconfig.json`, `node scripts/eslint --fix`,
  `node scripts/jest --config <plugin>/jest.config.js`.
- Route-level refinement harness: `node __tmp__/verify_refinements.js` — exercises both routes and
  derives the pattern from the data rather than hardcoding it.
- To force a two-render conversation for read-only testing, ask the agent to run the same tool twice
  in separate turns.
- **A mute supersedes the render it was made in** whenever that render is not in the last round: the
  PUT advances the version and `addAttachmentsToLastRound` puts the ref on the last round, so the
  older render trips `version < versionCount` and loses its write buttons. Consistent with
  read-only-on-stale, but it makes a second mute impossible without asking for a re-render first —
  worth knowing before driving mute sequences by hand.

## Verification performed

Emit pattern (tool result carries only `attachment_ids`); mute latency and absence of remount; ref
persistence and survival across reload; Summarize excluding five muted patterns; Investigate honouring
the time range; type switch preserving attachment id and muted count; baseline picker as an instant
action; transcript fidelity on earlier rounds; read-only render showing 0 mute buttons, 7 investigate
buttons and a "Superseded" badge while the current render shows all controls.

Refetch, in the browser against the seeded instance unless noted: both routes by curl, including mute
pushdown; range change swapping table contents; range change surviving a page reload; two rapid range
changes settling on the later one; no subtree remount across any of it; forced 500 rolling the window
back with a callout; mute → range change → unmute leaving every row on the same window; top-N
backfill against 32 categories; baseline epoch change re-querying only the baseline; a range change
on the histogram shifting the baseline with it and recomputing the bucket interval; and an agent turn
immediately after a range change reading the new window (the agent saw an empty 30-minute window and
widened it, which also re-confirms `resolveRange`).
