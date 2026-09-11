# LX-1 — Show at most 8 patterns, not 25

**Status:** done — awaiting fold-in
**Owner:** unassigned

Read [`README.md`](./README.md) first — ownership, the progress-log format and the shared-environment
rules. The constraints under "Rules for every item" in
[`../poc-logs-exploration-next-steps.md`](../poc-logs-exploration-next-steps.md) apply here and are
not repeated.

## Goal

The pattern table displays a maximum of 8 patterns.

## Context, verified in the source

`MAX_PATTERNS = 25` in `common/log_exploration.ts` is the ES|QL `LIMIT` in
`get_log_patterns/handler.ts:99`, not a display cap — the table renders every row it is given and
there is no pagination anywhere in the plugin. Two couplings:

- `MAX_STORED_PATTERNS = MAX_PATTERNS + MAX_MUTED_PATTERNS` bounds the zod `patterns` array, which
  must also hold the retained entry for every muted pattern. Lowering `MAX_PATTERNS` shrinks that
  budget; confirm the bound still covers the retained set.
- `format()` renders the same list to the model, so the agent would see 8 patterns too. Summarize and
  Investigate then reason over a shorter list.

## Settle first

Ask the user and wait for the answer before writing any code.

Is 8 a query limit or a display cap over a wider query? A display cap keeps the model's view at 25 and
makes mute backfill instant for the first 17 mutes; a query limit makes each refetch cheaper. Not
decided.

## Files to start from

Not a whitelist — change whatever the task needs. Relative to
`x-pack/solutions/observability/plugins/observability_agent_builder/`:

- `common/log_exploration.ts`
- `server/tools/get_log_patterns/handler.ts`
- `server/attachments/log_exploration.ts` (`format()`)
- `public/attachment_types/log_exploration/pattern_table.tsx`
  Added during the work, once the user decided mute should refetch — neither is listed by LX-2, whose
  only file is `baseline_histogram.tsx`, so there is no overlap:

- `public/attachment_types/log_exploration/use_log_exploration_state.ts` and its unit test
- `public/attachment_types/log_exploration/README.md`

Added for the top-N copy pass:

- `server/tools/get_log_patterns/tool.ts` (tool description)
- `server/skills/logs_exploration/skill.md.text`

## Done when

The table shows 8 rows against the 32-category seed, muting still backfills the tail on the next
refetch, and the zod bound is re-derived rather than left at the old arithmetic. Checked in the
browser, not only in code.

## Progress log

### 2026-09-02 — 8 rows as a query limit, and mute now refetches behind a debounce

- Changed: `common/log_exploration.ts` — `MAX_PATTERNS` 25 → 8. `MAX_STORED_PATTERNS` needed no edit:
  it was already `MAX_PATTERNS + MAX_MUTED_PATTERNS`, so it re-derived to 58, which still covers 8
  fetched rows plus the retained entry for up to 50 muted patterns. Comment now says why it is
  derived rather than a literal.
- Changed: `server/tools/get_log_patterns/handler.ts`, `server/attachments/log_exploration.ts`,
  `public/attachment_types/log_exploration/pattern_table.tsx` — no edits needed. The handler already
  interpolated `MAX_PATTERNS` into the `LIMIT`, and `format()` and the table both render whatever
  list they are given, so all three followed the constant.
- Changed: `use_log_exploration_state.ts` — `MUTE_PATTERN` moved out of the persist-only path onto a
  refetch debounced by `MUTE_FETCH_DEBOUNCE_MS = 300`. `flushPendingWrites` now fires a waiting mute
  refetch instead of waiting the timer out, an immediate-fetch action cancels a pending one, and a
  failed mute refetch persists the mute, since its refetch is now the only thing that writes it.
- Changed: `use_log_exploration_state.test.ts` — four hook tests under fake timers: a burst collapses
  to one refetch, flush fires a waiting one, a failed mute refetch still persists, and a range change
  supersedes a pending mute refetch without losing the mute.
- Changed: renderer `README.md` — refetch table now reads "Mute: yes, debounced", with the flush and
  persist-on-failure reasoning; the `LIMIT 25` paragraph rewritten.
- Verified: `node scripts/jest --config <plugin>/jest.config.js log_exploration` (12 passed),
  `node scripts/type_check --project <plugin>/tsconfig.json` (exit 0), `node scripts/eslint --fix` on
  the changed `.ts`/`.tsx` files (clean). ESLint cannot parse the `README.md` in that list; the error
  is the parser, not the file.
- Verified, by curl against the running instance: the patterns route returns 8 rows over
  `logs-poc-default` / `now-24h`, and muting the top pattern still returns 8 with rank 9 (Kafka
  consumer lag, 83) promoted.
- Verified, driven in the browser in my own conversation
  (`49276806-0602-4423-8386-48238dd54c9b`), against the existing 32-category seed — I did not reseed:
  - First render: `aria-rowcount` 8.
  - One mute, sampled every 50 ms: row gone by the 105 ms sample, exactly one request to the patterns
    route at 363 ms, back to 8 rows at 422 ms with rank 9 promoted. A property stamped on the grid
    DOM node survived, so there is still no subtree remount.
  - Three mutes ~65 ms apart: 7 → 6 → 5 rows instantly, then a single refetch at 473 ms restoring 8
    with ranks 9–11 promoted. One query for the burst, not three.
  - Page reload after those four mutes: 4 unmute chips and the same backfilled 8 rows, so the
    debounced refetch's write did land.
  - Mute followed immediately by Summarize: request order was patterns 141 ms → content PUT 215 ms →
    converse 1321 ms. The 141 ms proves the flush fired the fetch rather than waiting out the 300 ms
    timer. The agent then summarized exactly 8 patterns, excluding the pattern muted a moment earlier
    and including the backfilled ones.
- Unverified: unmute after a mute-triggered refetch was not re-driven — its path is unchanged, but I
  did not exercise it. The persist-on-failure branch for a failed mute refetch is covered by a unit
  test only; I did not force a 500 on the route in the browser. Whether the extra write per mute
  makes ref accumulation (LX-5) materially worse was not measured.
- Also: the shared Kibana dev server hot-reloaded these edits on its own (HMR banner); I did not
  restart it and did not reseed Elasticsearch.
- Decided (by the user): **8 is a query limit, not a display cap** — `MAX_PATTERNS = 8` and the ES|QL
  `LIMIT` follows it, so the user's view and `format()` stay in sync.
- Decided (by the user): **mute now refetches**, which reverses the "Mute refetch" row in the plan's
  confirmed-decisions table and the "Mute does not backfill the top-N until the next refetch" entry
  under accepted costs. Reason: at 8 rows the gap left by a mute is too visible to defer. The
  "instant" claim survives because the row is still removed from local state before any I/O.
- Decided (by the user): **debounce the mute refetch and let it carry the write** (300 ms trailing),
  rather than persisting the mute separately and refetching on top. The existing abort plus sequence
  number already made rapid mutes converge correctly, so the debounce buys fewer queries and fewer
  attachment versions, not correctness. Its cost is that a mute is unwritten during the window, which
  is why `flushPendingWrites` fires it and why a failed refetch still persists.
- Next: none — ready for fold-in. The plan's mute-refetch decision and the accepted cost about
  backfill both need rewriting, and the state doc's refetch table, its `LIMIT 25` backfill evidence
  and the "Mute ~50 ms, no remount" AC row are now superseded by the numbers above.

### 2026-09-02 — Say everywhere that 8 is a top-N cut, not the number of patterns that exist

Follow-up asked for by the user after the entry above: neither the user nor the model should read the
table as "there are 8 patterns in these logs".

- Changed: `pattern_table.tsx` — caption above the grid, "Top {limit} patterns by document count. The
  logs almost certainly contain more — muting one promotes the next largest into the table." The grid
  `aria-label` and the all-muted empty state now name the limit too. All three interpolate
  `MAX_PATTERNS` rather than hardcoding 8.
- Changed: `server/attachments/log_exploration.ts` — `format()` states the cut before listing rows,
  and forbids two specific failure modes: implying the logs contain only these, and totalling the
  counts as a document count. "Patterns currently in the cut, which are the ONLY ones you may
  discuss" keeps the muting constraint that makes the Summarize AC pass.
  `getAgentDescription()` gained the same framing.
- Changed: `server/tools/get_log_patterns/tool.ts` — description says it renders the largest
  `MAX_PATTERNS` and that the query is a top-N cut.
- Changed: `skill.md.text` — new "The pattern table is a top-N cut" section: which words to use, do
  not sum the counts into a document total, say the view cannot answer "how many distinct patterns
  exist", and a pattern appearing after a mute is a promotion rather than new data. The Summarize
  action now says to make the top-N framing explicit.
- Verified: type check exit 0, eslint clean on the changed `.ts`/`.tsx`, jest 12 passed,
  `node scripts/i18n_check --fix` verified all 285 namespaces and left no diff.
- Verified in the browser: the caption renders as "Top 8 patterns by document count …" and the grid
  `aria-label` is "Top 8 log patterns by document count". In a fresh conversation, asked the
  deliberately loaded question "How many distinct log patterns are there …?", the agent answered
  "the top 8 patterns by document count — this is a cut of the largest patterns, not the complete set"
  and offered the volume comparison for totals, instead of answering "8".
- Unverified: only that one phrasing was exercised against the model, on Claude Sonnet 4.6. I did not
  test whether it holds after several turns, on a different connector, or when the user asks for a
  total document count directly.
- Decided (by the user): the top-N framing belongs in the skill and the UI copy, not just the schema.
- Next: none — ready for fold-in. On top of the previous entry, the state doc's `format()` note ("names
  muted patterns explicitly") now understates what `format()` asserts.

### 2026-09-02 — Removed the caption above the grid

Corrects the previous entry's first bullet: the caption it describes no longer exists.

- Changed: `pattern_table.tsx` — dropped the "Top {limit} patterns by document count…" caption and the
  `topNCaption` message. The user read it as confusing next to the agent's own sentence above the
  view, which already says the same thing. The grid `aria-label` ("Top 8 log patterns by document
  count") and the all-muted empty state keep the framing; neither competes with the surrounding copy.
- Verified: type check exit 0, eslint clean, `node scripts/i18n_check` reports no fixes needed. In the
  browser after a reload, zero elements matching the caption text, `aria-label` still "Top 8 log
  patterns by document count", 8 rows.
- Unverified: nothing new — the model-facing copy is unchanged by this entry.
- Decided (by the user): no top-N caption in the view. The agent's message around the attachment
  carries that job, and the copy in `format()`, the tool description and the skill is what keeps it
  saying so.
- Next: none — ready for fold-in.
