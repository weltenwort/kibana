# LX-16 — Shift and zoom buttons on the time picker

**Status:** done — awaiting fold-in
**Owner:** worker agent (LX-16)

Read [`README.md`](./README.md) first — ownership, the progress-log format and the shared-environment
rules. The constraints under "Rules for every item" in
[`../poc-logs-exploration-next-steps.md`](../poc-logs-exploration-next-steps.md) apply here and are
not repeated.

## Goal

Previous / next / zoom-out controls beside the window picker, as Discover has them.

## Context, verified in the source — and the premise does not hold

The enhancement was framed as "if that is as simple as enabling the feature on the time picker
component". It is not, though it is close:

- **`EuiSuperDatePicker` has no such feature.** `exploration_controls.tsx` uses it directly.
- **The buttons live in a different component.** `@kbn/date-range-picker` exports `DateRangePicker`
  with `showTimeWindowButtons?: boolean | TimeWindowButtonsConfig`, where the config is
  `{ showShiftArrows, showZoomOut, showZoomIn }`, all defaulting true
  (`date_range_picker_time_window_buttons.tsx`). Once on that component, the feature really is one
  prop.
- **The package is usable here**: `visibility: "shared"`, `group: "platform"`, owned by
  `@elastic/appex-sharedux` and `@elastic/eui-team`. Precedent both ways — `unified_search`'s
  `query_bar_top_row.tsx` (the bar Discover uses) gates it behind `DATE_RANGE_PICKER_FEATURE_FLAG`,
  while `security_solution`'s `anomalies_tab.tsx` imports `DateRangePicker` directly with no flag.
- **The contract differs, so it is not a prop-for-prop swap.** `DateRangePicker` takes a single
  `value: string` for the range and requires `settings: DateRangePickerSettings` plus
  `onSettingsChange`; `onChange` yields `{ startDate, endDate, value, isInvalid }`. Our payload holds
  `source.timeRange` as two datemath strings. Mapping between the two is the actual work. Read the
  package's `AGENTS.md` and `README.md` before starting.

## Constraints particular to this

- **Every window change must go through `SET_TIME_RANGE`**, which also shifts `view.baselineEpoch`
  when the caller passes one — that is what keeps the comparison epochs comparable. A shift or zoom
  that bypasses it will silently desynchronise the volume lens.
- A window change is an **immediate** refetch, not the debounced path, and a failed fetch rolls back
  `source.timeRange` and `view`. Nothing here should change that.
- Respect `isReadOnly`: these controls write.

## Settle first

Ask the user and wait for the answer before writing any code.

1. **Swap the component, or add plain buttons beside `EuiSuperDatePicker`?** The swap brings the
   Discover-consistent affordance and everything else that component does; three `EuiButtonIcon`s
   dispatching `SET_TIME_RANGE` are perhaps twenty lines and no new dependency. The PoC's own rule is
   to reuse the shared component rather than reimplement it, but the contract mismatch is real work.
2. **If swapping — behind the feature flag or not?** Both precedents exist in-tree.
3. **Which buttons.** `showZoomIn` defaults on; a PoC that only ever widens or narrows by a factor
   may want fewer controls, not more.

## Files to start from

Not a whitelist — change whatever the task needs. Relative to
`x-pack/solutions/observability/plugins/observability_agent_builder/`:

- `public/attachment_types/log_exploration/exploration_controls.tsx`
- `public/attachment_types/log_exploration/use_log_exploration_state.ts` — only if `SET_TIME_RANGE`
  needs to express a shift rather than an absolute window
- `kibana.jsonc` / `tsconfig.json` if the package dependency is added

Read-only: `src/platform/packages/shared/shared-ux/datetime/kbn-date-range-picker/` —
`date_range_picker.tsx`, `date_range_picker_time_window_buttons.tsx`, `AGENTS.md`.

## Done when

Shifting and zooming changes the window, refetches, and keeps the baseline epoch aligned on the volume
lens — check the comparison after a shift, not just the table. A superseded render does not offer the
controls. Driven in the browser.

## Progress log

### 2026-09-09 — Swapped to `DateRangePicker`; all four window buttons shift and zoom, baseline stays aligned

- Changed: `public/attachment_types/log_exploration/exploration_controls.tsx` — `EuiSuperDatePicker`
  replaced with `@kbn/date-range-picker`'s `DateRangePicker`; `value` is `` `${start} to ${end}` ``,
  `onChange` guards on `isInvalid` before dispatching the existing `SET_TIME_RANGE` +
  `shiftBaselineEpoch` pair, `settings`/`onSettingsChange` held in local state,
  `showTimeWindowButtons={{ showZoomIn: true }}`, `disabled={isReadOnly}` (mirrors the old
  `isDisabled`, and the package disables the window buttons from the same flag).
- Changed: `tsconfig.json` — added `@kbn/date-range-picker` to `kbn_references`. No `kibana.jsonc`
  change: it is a package, not a plugin.
- Decided (user): swap to the shared component rather than hand-rolling buttons; **no** feature-flag
  gate (the `security_solution` precedent, not the `unified_search` one) — gating would mean
  threading `featureFlags` through `plugin.ts` → `index.tsx` and keeping the `EuiSuperDatePicker`
  branch alive; **all four** buttons, i.e. `showZoomIn: true` on top of the shift arrows and zoom-out
  the package defaults on.
- Corrected: the task file says `showZoomIn` defaults true. It does not —
  `date_range_picker_time_window_buttons.tsx` defaults it to `false`, which is why it is passed
  explicitly.
- Verified: `node scripts/type_check --project <plugin>/tsconfig.json`, `node scripts/eslint` on the
  changed file, `node scripts/jest --config <plugin>/jest.config.js log_exploration` (41 passed).
- Verified in the browser, own conversation `d93c5d27-0061-4a88-b3a2-525d51d62874`, volume-comparison
  lens with the baseline preset on "1 hour earlier":
  - All four buttons render beside the control: previous, zoom out, zoom in, next.
  - Typing `now-2h to now` in the smart input applies and refetches.
  - Previous: window `16:44→18:44Z` → `14:44→16:44Z`, chart re-rendered on the new window.
  - Previous again, zoom out (2h → 3h, centred), zoom in (3h → 1h30, centred). Persisted payload read
    back from `/api/agent_builder/conversations/…` after each: `startOffsetMs` and `endOffsetMs`
    between `source.timeRange` and `view.baselineEpoch` were **3612484 on every one of the four**, and
    the baseline length tracked the window length (120→120, 180→180, 90→90 min). The baseline stays
    the same distance behind and the same length, so the comparison epochs stay comparable.
  - The 3612484 ms (1 h + 12.5 s) is not drift introduced here: it was fixed when the relative
    `now-2h` window first became absolute, and `shiftBaselineEpoch` has always resolved `now` at
    dispatch time. Every subsequent shift and zoom preserved it exactly.
  - Superseded render: after a second round re-rendered the attachment and a write was made from the
    newer render, a reload left the older render with the "Superseded" badge, a dimmed control and all
    four window buttons `disabled`, while the newer render's four stayed enabled.
- Unverified: the `isInvalid` path (typing an unparseable range) was not driven — only the guard is
  in the code. Nothing here was checked below the 560 px icon-only header breakpoint. No unit test was
  added for the picker; the reducer tests that cover `SET_TIME_RANGE` were untouched and still pass.
- Shared environment: **reseeded** `logs-poc-default` at ~18:47Z (`node __tmp__/seed_logs_poc.js`,
  3685 docs / 32 patterns) — the previous seed had aged out of every recent window, so the chart was
  empty. Before: all 3685 docs on 2026-09-07, 09:00–18:00Z. After: 2026-09-09, 12:00–18:5xZ. Also
  started one new conversation; no Kibana restart.
- Overlap for the coordinator: `exploration_controls.tsx` is also listed by LX-15 (log-level filter),
  which adds a control and a chip kind to this same file. The chip block is untouched by this change,
  but the component is now a function body with hooks rather than an expression, so LX-15 will rebase
  onto that shape.
- Next: none — ready for fold-in.

### 2026-09-09 — Confirmed the pattern-table lens gets the same control

- Changed: nothing.
- Verified: `ExplorationControls` is rendered above the lens switch in `log_exploration_attachment.tsx`,
  so both lenses share it — driven, not inferred. Asked the agent for the top patterns in the same
  conversation; the pattern-table render carries the same control and all four buttons. Clicking
  Previous on it moved `Sep 9, 16:52 → 19:07` to `14:37 → 16:52` and the table refetched: counts
  changed (270→257, 202→193, 135→129, 45→43) and the rank order moved, Kafka overtaking Disk at
  30 vs 29.
- Unverified: unchanged from the previous entry.
- Next: none — ready for fold-in.
