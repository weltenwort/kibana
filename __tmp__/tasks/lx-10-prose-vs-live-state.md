# LX-10 — Stop the model's prose from contradicting the live view

**Status:** done — awaiting fold-in
**Owner:** unassigned

Read [`README.md`](./README.md) first — ownership, the progress-log format and the shared-environment
rules. The constraints under "Rules for every item" in
[`../poc-logs-exploration-next-steps.md`](../poc-logs-exploration-next-steps.md) apply here and are
not repeated.

## Goal

The agent's message around an attachment must not state anything the view can change underneath it,
and must not spend its turn repeating what the view already shows.

Three faces of one problem:

1. **Parameters drift.** The prose narrates the time range, and the range picker is an instant action
   — so after one click the prose and the view disagree, permanently, because the transcript is
   immutable and the attachment is not.
2. **Data drifts too.** The prose also describes the rows and counts, and those are refetched on every
   range change, mute and scope. Same staleness, larger surface.
3. **Echoing is not worth a turn.** "Summarize top patterns" mostly reads the table back. If the
   answer is what the user is already looking at, the action is not earning its round trip.

This is the same class of defect as the earlier "view misrepresents its own data", moved from the
payload into the prose.

## Context, verified in the source

- The pickers are instant actions: `source.timeRange` and the `volume-comparison` baseline change
  without an agent turn, so nothing rewrites the surrounding message.
- Every mutable parameter is in the same position: the window, the baseline epoch, the refinement
  list, and the top-N cut once refinements shift it. So is every number the view draws.
- The precedent for fixing this is LX-1's top-N framing: the model was taught what the view is and is
  not, in `format()`, the tool description and the skill — not in the UI. A caption in the view was
  tried there and removed for competing with the agent's own sentence.
- **`format()` is the only per-round channel** — established in LX-9. Skill bodies are not reliably
  in context for button-triggered turns, and `getAgentDescription()` is injected once per
  conversation per type. Anything that must hold every turn goes in `format()`.
- LX-9 is the closest precedent for point 3: the volume action was deliberately given content the
  chart does not show — signed change, percent, busiest bucket per epoch, the bucket that moved most
  — so the answer beats looking at the picture. The pattern-table action never had that treatment.
- **The Summarize prompt is load-bearing and was left unchanged verbatim in LX-9**, because it is the
  half of the AC the model reads. LX-9 changed only the button label. Anything here that touches the
  prompt has to re-drive the AC.

## Settle first

Ask the user and wait for the answer before writing any code.

1. **Suppress or attribute.** Either teach the model not to state mutable parameters at all ("over
   the selected window" rather than "over the last 24 hours"), or let it state them and have the view
   carry the authoritative values so a reader can see which is current. The first is cheaper and
   matches the LX-1 precedent; the second is friendlier to someone re-reading a transcript.
2. **How far it extends.** Parameters only, or also the data — counts, row names, bucket values?
   Stopping the model quoting numbers is a much stronger instruction and may fight the AC, which
   requires a _summary_ of the patterns.
3. **What "Summarize top patterns" should produce instead of an echo.** Candidates: what the shape of
   the distribution implies, which patterns look related, what to mute or investigate next. This
   decides whether the fix is prompt-only or needs `format()` to carry something the table does not.
4. **Whether the AC's wording still binds.** #6059 asks for a summary that excludes muted patterns.
   If the action stops listing patterns, decide what re-driving that AC means.

## Files to start from

Not a whitelist — change whatever the task needs. Relative to
`x-pack/solutions/observability/plugins/observability_agent_builder/`:

- `server/attachments/log_exploration.ts` — `format()`, `getAgentDescription()`
- `server/skills/logs_exploration/skill.md.text`
- `server/tools/{get_log_patterns,get_log_volume_comparison}/tool.ts` — descriptions
- `public/attachment_types/log_exploration/exploration_controls.tsx` if the view has to show anything

## Done when

Ask for a view, change the range, and re-read the round: the prose does not assert a window, or
numbers, that are no longer in effect. "Summarize top patterns" says something the table does not
already say. Verified by driving a conversation, since this is a model-behaviour change and only the
browser can show it. Note the caveat from LX-1: one phrasing on one connector is weak evidence — try
at least the obvious adversarial ask ("what window is this?") after a change. If the Summarize prompt
moves, re-drive the AC rather than assuming it survives.

## Progress log

### 2026-09-07 — Deictic prose, point-in-time numbers, and a Summarize that stops echoing

**Decided (user), all four settle-first questions:**

1. **Suppress, with an escape hatch.** The model must not state the window, baseline or filter list
   in prose — but if the user asks outright, it answers with the literal values and says they are as
   of that answer. No new UI: the picker, the baseline selector and the chips already are the
   authoritative labels, and LX-1 already removed a caption for competing with the agent's sentence.
2. **Parameters suppressed; data allowed but framed as point-in-time.** Counts stay quotable, so
   LX-9's "beat the chart" content survives, but must be framed as a reading ("as of this reading").
3. **Keep the list, add interpretation carried by `format()`.** Same shape of fix as LX-9's
   histogram summary.
4. **Change the Summarize prompt and re-drive the AC against the re-interpreted wording** — the AC
   is "a summary that excludes muted patterns"; enumeration with counts is no longer required.

- Changed: `server/attachments/log_exploration.ts` —
  - New `HOW TO WRITE ABOUT THIS VIEW` block in the representation: do not restate the range,
    baseline or filters (including durations dropped mid-sentence); answer literally if asked
    outright, as of that answer; numbers are a reading, not a standing fact; prefer saying what the
    user cannot already see. The literal values stay in the payload — they are for reasoning and for
    the escape hatch, not for quoting.
  - `formatPatternTable()` now emits each row's **share of the cut** and a **`trend`** token, plus a
    `Shape of this cut` block: the cut's own total (with the standing warning not to present it as
    the range's document count), the largest pattern's share, rising/falling/flat counts, and the
    steepest riser and faller. `trend` is `halfOverHalfDelta()` over the row's `sparkline`, which
    `format()` previously discarded entirely — the sparkline is drawn but never stated, so this is
    content the user cannot read off the view.
  - `getAgentDescription()` carries a short version of the same rule, since it and the tool
    description are the only channels present on the round that _emits_ the attachment (the model
    does not necessarily call `attachments.read` before writing that first sentence).
- Changed: `server/tools/get_log_patterns/tool.ts`, `server/tools/get_log_volume_comparison/tool.ts`
  — one paragraph each, same rule, for the emit round.
- Changed: `server/skills/logs_exploration/skill.md.text` — new "Do not restate what the view already
  shows" section, and the **Summarize top patterns** bullet rewritten to ask for meaning (dominance,
  trend, relatedness, next action) rather than a read-back.
- Changed: `public/attachment_types/log_exploration/log_exploration_attachment.tsx` — Summarize
  prompt is now "Summarize what the un-muted log patterns show: which ones dominate the cut, which
  are rising or falling, which look related, and what is worth investigating or muting next. Do not
  include muted patterns, and do not simply list the rows back." Label unchanged ("Summarize top
  patterns"), so no i18n change.
- Changed: `public/attachment_types/log_exploration/README.md` — the `format()` paragraph quoted
  muting wording LX-9 had already replaced; corrected, and the new prose rules noted.
- Changed: `server/attachments/log_exploration.test.ts` — the `- alpha (count: 100)` expectation now
  pins share and trend; four new tests: the cut-shape block over un-muted rows only, steepest
  mover in each direction (including the dropped odd middle bucket), trend omitted for a
  single-bucket sparkline, no shape block when everything is muted, and the prose rules present
  alongside the literal values.

- **Reseeded Elasticsearch, logged as required.** Before: `logs-poc-default` did not exist at all —
  the cluster was empty apart from three system indices dated today, so nothing was destroyed. After:
  `node __tmp__/seed_logs_poc.js` → `indexed=3685 errors=false`, `count=3685 patterns=32`.
  Kibana was already running; I did not restart it (it hot-reloaded the server edits itself).

- Verified, driven in the browser in my own conversations (Claude Sonnet 4.6, admin via mock IdP):

  - **Emit round, conversation `8ae9e42a`:** asked for patterns "over the last 24 hours". The
    sentence around the attachment read "over the selected window" — it did not repeat the range the
    user had just named. 8 rows.
  - **Drift test:** changed the picker to Last 6 hours on that same render. The picker read
    "Last 6 hours", counts refetched (720 → 717 on the top row), and the prose above was still
    correct, because it asserts nothing the picker can change.
  - **Adversarial ask** ("What window is this? And what filters are in effect?"): it called
    `attachments.read` and answered "As of this reading: Time window: `now-6h` to `now` … Baseline
    epoch: not set … Muted patterns: none", and noticed the picker had been moved since the request.
    The escape hatch works and is correctly framed.
  - **Summarize AC re-driven against the new prompt**, twice, in two conversations, each after two
    mutes with the table backfilled to 8. Neither muted pattern was named in either answer; the
    second said "the 8 un-muted patterns (2 are muted)", which is the sanctioned form. Both answers
    were interpretation, not enumeration: shares of the cut, signed trends, an explicit "these three
    are facets of the same problem" grouping, and a prioritised what-to-do-next list including a
    mute candidate. Both opened with "as of this reading".
  - **Volume lens:** the emit-round sentence read "the selected window … the chosen baseline epoch"
    with no literals. "Explain this change" answered from the summary points only (600 against 426,
    +174, +41%, busiest bucket per epoch, moved-most bucket 34 → 98) — arithmetic cross-checked,
    174/426 = 40.8% — with no raw bucket enumeration and no literal timestamps.
  - Checks: jest 38 passed, `type_check` exit 0, eslint clean.

- **Corrected mid-task, then re-driven.** The first Summarize answer ended "80 events in six hours",
  a duration restated in passing — the same defect in a smaller shape. Added an explicit clause to
  `format()` and the skill naming that failure ("not '80 events in six hours', not 'over the past
  day'"), and re-drove in a fresh conversation: the second answer used "across the selected window"
  and quoted no duration.

- Unverified:

  - One connector (Claude Sonnet 4.6). Two Summarize drives, one drift test, one adversarial ask.
    LX-1's caveat stands: this is weak evidence for a model-behaviour change.
  - "Explain this change" described "a single 5-minute window", i.e. the bucket interval. That is
    derived from the range and so is mutable, but it is a property of the reading rather than a
    parameter the user sets, and it was inside an "as of this reading" answer. Left alone, not
    chased.
  - The pre-tool narration ("Now I'll fetch the top log patterns … over the last 24 hours") still
    quotes the user's own requested range. It describes what was asked for, not what the view shows,
    and it precedes the attachment. Not addressed.
  - The share/trend arithmetic is unit-tested, but I did not cross-check a rendered sparkline against
    the trend number the model quoted.
  - Not driven: a scoped (`only-pattern`) view, a KQL-filtered view, or an all-muted table with the
    new prompt.

- **Overlap warning for the coordinator:** this touched `format()` in
  `server/attachments/log_exploration.ts` and the action prompt in
  `log_exploration_attachment.tsx` — both also listed by LX-11.
- Next: none — ready for fold-in. The plan needs the four decisions above recorded, and #6059's
  Summarize AC re-recorded in its re-interpreted form (a summary that excludes muted patterns, no
  longer an enumeration with counts).

### 2026-09-07 — The rule is conditional on whether the message renders the view

Corrects settle-first answer 1 in the entry above: suppression is no longer unconditional.

- **Decided (user):** naming the parameters and refinements an answer was computed from is **fine in
  a reply that does not render a dynamic lens**. The defect only exists when a live view sits beside
  the sentence; with nothing beside the text that can move, attribution is a readable record rather
  than a claim waiting to go stale. So the rule now branches on the shape of the round:
  - a message containing `<render_attachment ... />` — suppress, deictic phrasing only;
  - a prose-only reply — **name** the range, baseline and filters it was computed from.
  - Unchanged from the previous entry: answer literally when asked outright, and frame quoted
    numbers as a reading taken at that moment.
- Changed: `server/attachments/log_exploration.ts` — the `HOW TO WRITE ABOUT THIS VIEW` block split
  into `IF THIS MESSAGE RENDERS THE VIEW` / `IF THIS MESSAGE DOES NOT RENDER THE VIEW` / `EITHER
WAY`. `getAgentDescription()` carries the same branch.
- Changed: `server/skills/logs_exploration/skill.md.text` — the "Do not restate what the view already
  shows" section rewritten around the same branch.
- Changed: both tool descriptions — each now ends with the prose-only carve-out.
- Changed: `public/attachment_types/log_exploration/README.md` — records that the rules are
  conditional on the shape of the round.
- Changed: `server/attachments/log_exploration.test.ts` — the prose-rules test now pins both
  branches; renamed to `suppresses the parameters only in a message that renders the view`.

- **Regression found by driving, then fixed.** The first Summarize after two mutes opened "the 6
  un-muted patterns (2 are muted)" while correctly discussing 8 — it had computed `MAX_PATTERNS − 2`
  instead of using the count `format()` states. That is exactly the miscount LX-9 fixed, re-opened by
  my previous entry: I had inserted the top-N and `trend` sentences _between_ the count sentence and
  the row list, so the count no longer introduced the rows.

  - Changed: `formatPatternTable()` — the `trend` explanation moved above the count, the count
    sentence restored to the last position before the rows (ending in a colon), and the observed
    failure named outright: "do NOT compute it as 8 minus the number of muted patterns; muting
    refills the cut, so that subtraction is wrong". Pinned by a new assertion.

- Verified, driven in the browser, fresh page and fresh conversations after the previous one froze:

  - **Render round, pattern table:** "Here are the top log patterns in `logs-poc-default` over the
    selected window" — still no literal range, with the picker showing Last 24 hours beneath it.
  - **Render round, volume lens:** "the log volume comparison against the chosen baseline", "The
    chart overlays the selected window against the chosen baseline epoch" — no literals.
  - **Prose-only, Summarize:** "Here's what the cut shows, computed from the last 24 hours
    (`now-24h` to `now`) with 2 patterns muted". Attribution present, as decided. Neither muted
    pattern named; all 8 un-muted patterns discussed, no wrong un-muted count; shares and trends
    used throughout, plus two related-pattern clusters and a prioritised action table.
  - **Prose-only, Explain this change:** "as of this reading, computed from the current range
    (`now-24h` to `now`) against the baseline epoch (`2026-09-05T17:26:58.247Z` to `now-24h`)". Both
    attribution and the point-in-time framing in one sentence.
  - The zero-baseline branch was exercised for the first time here (the 24-hours-earlier baseline
    predates the seed): it reported 0 baseline documents, refused to state a percentage, and
    described the current range on its own.
  - Checks: jest 38 passed, `type_check` exit 0, eslint clean.

- Unverified:
  - The count fix was driven once, in one conversation, after the change. The miscount before it was
    also observed once. One-for-one is weak evidence either way.
  - Still one connector (Claude Sonnet 4.6). Still not driven: a scoped (`only-pattern`) view, a
    KQL-filtered view, or an all-muted table under the new prompt.
  - Whether the render/prose-only branch holds when a single turn does both — renders a view _and_
    answers a prior question in the same message — was not exercised. The instruction assumes the
    model can tell which case it is in.
  - I did not re-drive the drift test or the adversarial "what window is this?" ask after this
    change; both are in the `EITHER WAY` section, which was not restructured.
- Next: none — ready for fold-in. Fold answer 1 as the conditional rule above, not the unconditional
  suppression recorded in the previous entry.

### 2026-09-07 — Re-render the view under an analysis; a third prose case; a clobber accepted

Refines the previous entry again: the rule now has three cases, not two.

- **Decided (user):** an analysis should **re-render the view at the end**, so "mute the cart-cleanup
  pattern, investigate the database replica one" is one click away instead of a scroll away.
- **Decided (user):** only **when the reply recommends something the view can perform**. Stated as
  that condition rather than as a lens name, so it survives a new lens. In practice it is the pattern
  table; re-rendering after "Explain this change" would show the histogram whose only action is the
  button that just ran.
- **Decided (user):** the attribution rule becomes positional. In a reply that both analyses an
  earlier result and re-renders the view, name the parameters **above** the `<render_attachment />`
  tag and never below it. My one addition, which the user accepted implicitly by the framing: pair
  the position with past-tense "computed from …", because position only works as a proxy for what the
  sentence is about — text above reads as a record of the analysis, text below as a description of
  the live view.
- Changed: `server/attachments/log_exploration.ts` — the block is now three cases (`A MESSAGE THAT
ONLY RENDERS THE VIEW` / `A PROSE-ONLY REPLY` / `A REPLY THAT ANALYSES AN EARLIER RESULT AND THEN
RE-RENDERS THE VIEW`) plus `IN EVERY CASE`, and a new `WHEN TO RE-RENDER THIS VIEW` block that
  **interpolates `attachment.id` into a ready-made `<render_attachment id="…" />` tag** so the model
  cannot invent or mistype an id. `getAgentDescription()` carries the condensed form.
- Changed: `server/skills/logs_exploration/skill.md.text` — third case documented, new "Re-render the
  view when your answer is actionable in it" section, and the Summarize bullet now ends with it.
- Changed: both tool descriptions — "may name the range and filters it was computed from, but only
  above a re-render of the view, never below one".
- Changed: `server/attachments/log_exploration.test.ts` — the fixture now has an id; three tests pin
  the three cases, the above/below rule, and that the interpolated tag carries the real id.

- Verified, driven in the browser, fresh conversation:

  - Summarize now ends with a live table: 8 rows, 8 **enabled** Mute buttons, inside the analysis
    round. Attribution appears above it — "Computed from `now-24h` to `now` against
    `logs-poc-default`, with 2 patterns muted, as of this reading" — and nothing but the view follows.
  - Checks: jest 40 passed, `type_check` exit 0, eslint clean.

- **Defect found by driving, and deliberately accepted.** Two live renders of one attachment lose
  writes:
  - After muting in the new render, the older render still listed the muted pattern, and **both
    stayed writable** — no "Superseded" badge, all buttons enabled.
  - Muting a different row in the older render and reloading: the newer render's mute was **gone**,
    its pattern back in the table with no chip. Full sequence recorded above.
  - Cause is structural. `resolveAttachmentVersion` falls back to `versions.at(-1)` when a round has
    no ref, so both renders resolve to the latest version and `version < versionCount` never fires.
    A mounted render cannot discover it has been superseded either, because props stay frozen for the
    loop and content writes must not call `invalidateConversation()`.
  - I checked for a cheap guard and found none: `stale_check.ts` is origin-staleness, not version
    concurrency, and the content-update route is Agent Builder's (LX-6 puts edits there out of scope).
  - I offered revert / a plugin-local "newest render owns the writes" registry / accept.
    **Decided (user): accept for the PoC and log it against LX-3**, which already exists because
    full-payload PUTs cannot express concurrent intent.
- Changed: `public/attachment_types/log_exploration/README.md` — new subsection "Two live renders of
  one attachment lose writes" with the mechanism, the measurement and the pointer to LX-3, so the
  next reader does not assume read-only-on-stale contains it.

- Unverified:
  - The re-render was driven once, after Summarize only. I did not check that the model correctly
    **withholds** it after "Explain this change", which is the other half of the condition.
  - The above/below rule was not adversarially tested — the model put the tag last, so there was no
    text below it to get wrong.
  - Whether a re-render inside an analysis round appends a ref (LX-5) was not measured; if it does,
    ref growth is now one more per analysis.
  - The clobber was reproduced once, deliberately. I did not measure how often it happens
    accidentally, e.g. whether a user naturally returns to the older render.
- **For the coordinator:** this belongs under "Costs already accepted" as a new, sharper entry —
  LX-3 is no longer only about concurrent renders in principle; the re-render makes that path
  routine. LX-3's own note ("two renders of the same attachment were observed clobbering each
  other") now has a reproducible sequence attached.
- Next: none — ready for fold-in.
