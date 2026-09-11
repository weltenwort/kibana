# LX-2 — Draw both histogram series as bars

**Status:** done — awaiting fold-in
**Owner:** unassigned

Read [`README.md`](./README.md) first — ownership, the progress-log format and the shared-environment
rules. The constraints under "Rules for every item" in
[`../poc-logs-exploration-next-steps.md`](../poc-logs-exploration-next-steps.md) apply here and are
not repeated.

## Goal

The baseline comparison histogram uses bars for both series.

## Context, verified in the source

`baseline_histogram.tsx` draws Current as a `BarSeries` and Baseline as a `LineSeries`. Change the
latter to `BarSeries`.

## Settle first

Ask the user and wait for the answer before writing any code.

Clustered or stacked. `@elastic/charts` clusters bar series sharing a `groupId` by default, and the
histogram runs to `MAX_HISTOGRAM_BUCKETS = 60` buckets, so clustered bars will be thin. Stacking is
wrong here — the two series are the same measure in different epochs, not parts of a whole. Nobody
has looked at this in the browser.

## Files to start from

Not a whitelist — change whatever the task needs. Relative to
`x-pack/solutions/observability/plugins/observability_agent_builder/`:

- `public/attachment_types/log_exploration/baseline_histogram.tsx`

## Done when

Both epochs read as bars at 60 buckets without the series becoming unreadable, checked in the browser
and not only in code.

## Progress log

### 2026-09-02 — Baseline drawn as clustered bars; overlay is impossible in @elastic/charts 72

- Changed: `public/attachment_types/log_exploration/baseline_histogram.tsx` — Baseline `LineSeries` →
  `BarSeries`, and dropped the now-unused `LineSeries` import. Nothing else; no props added.
- Decided (user): try the overlay first. On reading the library source that turned out to be
  impossible, so the user was asked again and chose **clustered**, with the readability of 60 buckets
  to be checked in the browser rather than assumed.
- Decided (evidence, `@elastic/charts@72.0.1`): two `BarSeries` **cannot** be overlaid.
  `getBarIndexKey` keys on `groupId + specId + splitAccessors + yAccessor`, so two bar specs always
  occupy different cluster slots — a separate `groupId` only splits the y-scale, it does not stop
  clustering. `renderBars` then offsets each bar by `xScale.bandwidth * orderIndex` and clamps its
  width to `widthRatio * bandwidth` with `widthRatio` clamped to `[0,1]`; `widthPixel` is clamped to
  the same maximum. A bar can never leave its own slot, so no prop combination produces an overlay.
  A step-curve `AreaSeries` behind the bars was offered as the only real alternative and declined.
- **Correction to this task's premise: the histogram never reaches 60 buckets.**
  `MAX_HISTOGRAM_BUCKETS = 60` is the ES|QL `LIMIT`, but `pickBucketInterval` is called with
  `MAX_HISTOGRAM_BUCKETS - 12` and snaps the interval _up_ to a round candidate, so the worst case is 48. Measured at the route: 6 h window → 36 buckets @ 10 min; 8 h window → 48 buckets @ 10 min; 5 h
  → 30. Anything reasoning about "60 buckets" is reasoning about a case that cannot occur.
- Verified: `node scripts/type_check --project <plugin>/tsconfig.json`, `node scripts/eslint --fix`
  on the changed file, and `node scripts/jest --config <plugin>/jest.config.js` (19 suites, 157
  tests) all pass. Then driven in the browser in a **new** conversation, no reseed: asked for a 24 h
  volume comparison, and both series render as bars.
- Verified (readability, the actual question): the default 24 h window is a poor test — the seed only
  spans 11:09–17:09 on 2 Sep, so the baseline epoch is empty and the two series never share a
  bucket. Set an absolute range over the seeded window instead. At the **48-bucket worst case** (8 h,
  09:10 → 17:10, baseline 1 hour earlier) the chart content measures 744 px, i.e. ~15.5 px per bucket
  and ~6 px per clustered bar. Both epochs read clearly as bars; they do not become unreadable. The
  "thin at 60 buckets" concern in this task does not materialise, partly because 60 buckets is not
  reachable.
- Observed, not changed: the two series are now only distinguished by colour, and Borealis assigns
  them adjacent teals — `#16C5C0` (Current) and `#A6EDEA` (Baseline), read off the legend swatches in
  the DOM. As a line-vs-bar pair the shape carried the distinction; as two bar series the hue and
  lightness difference is all that is left. Legible side by side, but weaker than before. Left alone
  as out of scope for this task — flagging it for the coordinator rather than widening the change.
- Unverified: light theme. Baseline offsets other than "1 hour earlier" and "24 hours earlier". Any
  behaviour at 60 buckets, which the above shows cannot be produced. Tooltip and legend hover on the
  two bar series.
- Note for overlap: this touched only `baseline_histogram.tsx`, which no other open task lists.
- Note: the agent's prose called the current series a "solid line", but that phrasing is the model's
  own — grepped `attachments/log_exploration.ts` and the skill text, and neither describes either
  series as a line, so nothing server-side needs updating.
- Next: none — ready for fold-in.

### 2026-09-03 — Explicit contrasting series colours; the same-hue pair was structural

Re-opened at the user's request after the entry above reported the two teals and left them alone.
This **replaces the "Observed, not changed" claim** in that entry: the colours are now changed.

- Changed: `baseline_histogram.tsx` — both series take an explicit `color`. Current
  `euiTheme.colors.vis.euiColorVis0` (`#16C5C0`, teal), Baseline
  `euiTheme.colors.vis.euiColorVisGrey1` (`#8E9FBC`, blue-grey). Added the `useEuiTheme` import and
  one comment naming the palette behaviour below.
- Root cause, read in `@elastic/eui-theme-borealis`: **the default palette cannot produce two
  contrasting colours for the first two series.** `_colors_vis_light.js` builds the vis ramp in
  same-hue pairs — `vis0`/`vis1` are `teal60`/`teal30`, `vis2`/`vis3` are `blue60`/`blue30`,
  `vis4`/`vis5` `pink60`/`pink30`, `vis6`/`vis7` danger, `vis8`/`vis9` warning. Any two-series chart
  taking the default assignment gets one hue at two lightnesses. The previous entry called this an
  unlucky assignment; it is structural, and it will hit every other two-series chart in this PoC.
- Decided: grey for the baseline rather than a second saturated hue. It separates on saturation as
  well as hue, so it survives greyscale and colour-vision deficiency, where teal-vs-pink would not;
  it matches the reference-vs-actual convention used elsewhere in Observability; and it avoids the
  `danger`/`warning` ends of the ramp, which would imply the baseline is itself a problem.
  `colorVisDark` spreads `colorVisLight` and overrides only the `Text` variants, so both hexes are
  identical in light and dark mode — one choice covers both.
- Verified: eslint, `type_check`, and jest (19 suites, 157 tests) all pass. In the browser, the
  legend swatches now read `#16C5C0` and `#8E9FBC` from the DOM. At a 1 h range (12 buckets, wide
  bars) the two series are unmistakable.
- Verified at max density by sampling the chart canvas with `getImageData`, because a compressed
  screenshot at ~6 px per bar looked washed out and could not settle it: at the 48-bucket worst case
  the canvas holds 19073 px of `22,197,192` and 14835 px of `142,159,188`, against ~600 px of
  antialiased edge blend in total. Both series render at full saturation; the washed-out look was a
  JPEG artifact, not the chart.
- Unverified: light mode was not driven. The hexes are mode-independent per the source above, and
  both are mid-tone, but nobody has looked at it on a white background. Switching the theme is a
  shared-environment change, so it was not done.
- Next: none — ready for fold-in.

### 2026-09-03 — Colours reverted to the default palette; the greyscale claim above was wrong

The colour work in the entry above **was reverted at the user's request** after reviewing four
candidates in the browser: none looked better than the default. The shipped diff for LX-2 is once
again only `LineSeries` → `BarSeries` plus the dropped import — confirmed with `git diff`, which
shows exactly those two hunks and no residue from the experiments. `useEuiTheme`, both `color`
props and the palette comment are all gone; the series are back to `#16C5C0` and `#A6EDEA`, read
off the legend swatches in the DOM.

- **Correction, and it invalidates a claim recorded as fact above.** The previous entry justified
  the grey with "it separates on saturation as well as hue, so it survives greyscale". The greyscale
  half is false, and I asserted it instead of measuring it. Greyscale discards saturation and keeps
  only luminance, and the measured luminance-contrast ratios are: teal/pink `1.29:1`, teal/grey
  `1.25:1`, teal/blue `1.20:1`. All three collapse to near-identical greys. The grey was no better
  than the alternatives on that axis.
- Measured, and worth keeping even though the change is reverted: the Borealis `60` shades are
  near-iso-luminant, so **no pair of them separates on lightness**. Mixing a `60` with a `30` is the
  only on-palette way to get lightness separation — teal60/blue30 (`vis0`+`vis3`) measures `1.51:1`.
  Anyone revisiting two-series colour here should start from that, not from two `60` shades.
- Still true from the entry above, and the useful part of it: the same-hue pairing is **structural**,
  not an unlucky assignment. The vis ramp is built in `60`/`30` pairs per hue, so any two-series
  chart taking the default gets one hue at two lightnesses. That applies to every other two-series
  chart in this PoC. It is now a known, accepted cost here rather than a defect to fix.
- Decided (user): keep the default palette. The two teals are legible enough at the densities this
  view actually reaches, and none of teal/grey, teal/pink, teal/blue or teal/pale-blue was an
  improvement worth an explicit override.
- Verified after the revert: eslint, `type_check`, and jest (19 suites, 157 tests) all pass, and the
  legend reads `#16C5C0` / `#A6EDEA` in the running UI.
- Next: none — ready for fold-in.
