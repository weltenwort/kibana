# LX-18 — Write up the learnings and the outcome

**Status:** in progress
**Owner:** unassigned

Read [`README.md`](./README.md) first, for ownership, the progress-log format and the
shared-environment rules. This task writes prose rather than code, but the evidence rules still
apply: every claim traceable, and no number that was not measured.

## Goal

A write-up of what the PoC set out to test, what it showed, and what a real implementation would
still owe. The audience is the people deciding whether to build this properly.

## Sources, in order

Everything needed already exists. Do not re-derive findings by reading the code. The docs are the
record, and re-deriving is how contradictions get introduced.

- [`../poc-logs-exploration-plan.md`](../poc-logs-exploration-plan.md): decisions, the reasoning
  behind them, and the rejected alternatives. The rejected list answers the "why not just do X"
  questions a reader will have.
- [`../poc-logs-exploration-state.md`](../poc-logs-exploration-state.md): the AC table, what was
  built, every measurement, the bug list, the corrections, the defect list, and what was never
  verified.
- [`../poc-logs-exploration-next-steps.md`](../poc-logs-exploration-next-steps.md): what is left.
- [`../issue-agent-chat-renderer-poc.md`](../issue-agent-chat-renderer-poc.md): #6059, the
  authoritative acceptance criteria. Structure the outcome against these rather than against the task
  list.
- [`../issue-attachment-mutation-spike.md`](../issue-attachment-mutation-spike.md): #6064, the
  mutation spike this built on.
- The per-task logs in this directory, for detail the three docs only summarise.

## What must be in it

The subject is what Agent Builder had to be bent into doing. The logs feature is the vehicle; what
the framework did and did not support is the finding. Three categories, kept apart:

**1. Local edits to other teams' code, five files.** The inventory is in the state doc. Nothing ships
until they are reverted or upstreamed, which makes this the most consequential item in the PoC. In
substance they add two capabilities the browser attachment contract lacks: a content write
(`updateContent` on `AttachmentsService`, plus the optional callbacks on `GetActionButtonsParams` and
`InlineRenderCallbacks`), and a way for a renderer to start an agent turn (`submitMessage`, wired
from `useSubmitMessage()`). The other two edits are an allow-list entry and a change to the
content-update route so a write advances the round's ref (`ATTACHMENT_REF_ACTOR.user` and
`addAttachmentsToLastRound`). Say which are candidates for upstreaming as they stand, and which were
expedient.

**2. Workarounds inside our own code, forced by framework behaviour.** These cost the most time and
are invisible in a diff:

- Content writes must not call `invalidateConversation()`. Identity and data freshness are coupled,
  so invalidating rebuilds the subtree (about 712 ms) and transiently resurrects muted rows.
- Superseded renders are write-disabled, because two renders of one attachment never reconcile.
- `isReadonly: true` on the type, discovered late. Without it, `attachments.read` returns the raw
  payload and every rule in `format()` is dead code.
- Anything that has to hold every round lives in `format()`. Skills are not reliably in context for
  button-triggered turns, and `getAgentDescription()` is injected once per conversation.
- A staleness warning inside `format()`, because `attachment_context` is gated on a round's refs, so
  a question-only round carries no attachment metadata at all.
- Every zod bound has to do real work, because `maxContentLength` on `AttachmentTypeDefinition` is
  declared and never enforced.
- `AttachmentHeader` returns `null` when it has no action buttons, taking the title and badges with
  it, so a lens must never register zero.

**3. Gaps recorded and left alone, which is the list for the Agent Builder team.** Ref accumulation,
one entry per click, unbounded. Version chips placed beside the user's prompt under a hardcoded
"Added" label. A missing version rendering as `null` with no diagnostic. Header actions having no
tooltip channel. And the one that blocks shipping: delta writes (LX-3), because full-payload PUTs
cannot express concurrent intent, and two live renders of one attachment were observed losing writes,
with a reproduction.

Frame all three as what would have to exist for this to be a supported pattern rather than a PoC,
not as complaints.

## Style

Plain prose. No em-dashes, no "load-bearing", no "crucially" or "notably", no three-item rhetorical
lists, no sentence that opens by restating the heading. Short sentences, concrete nouns, and the
measurement rather than an adjective about it.

## Settle first

Ask the user and wait for the answer before writing.

1. Where it lives and what shape: a comment on #6059, a markdown file in `__tmp__/`, a slide outline,
   or something else.
2. Audience and length. A team that knows Agent Builder needs a different document from a stakeholder
   deciding whether to fund the work.
3. Whether it names the two questions the PoC never settled: whether this belongs in the transcript
   at all, and whether mutable attachments are the right primitive.

## Done when

Every claim is traceable to the plan, the state doc or a task log, and no number appears that was not
measured. If something reads as a conclusion the evidence does not support, cut it or label it.

## Progress log

### 2026-09-10 — Settled the three questions and drafted the write-up

- Changed: `__tmp__/6059-outcome-comment.md` — new file, the whole deliverable. GFM, drafted as a
  comment on #6059 but **not posted**. Layered: verdict, the AC table with its measurements, then
  the three cost categories, the operations not built, the open question, and the strength of the
  evidence.
- Changed: this file — status `ready` → `in progress`.
- Verified: every number in the draft was traced back to a line in the state doc or the plan before
  it was written. Nothing was re-derived from code. No running instance was touched, nothing was
  reseeded, the Kibana dev server was not restarted.
- Unverified: nothing was driven, because nothing in this task is code. Two judgements in the draft
  are labelled as judgements rather than measurements: which of the five local edits are candidates
  for upstreaming as they stand, and the conclusion about the primitive.
- Decided (all three by the user):
  1. **Shape and location.** Aimed at a comment on #6059, drafted locally in `__tmp__/` as GFM. The
     user posts it; agents do not.
  2. **Audience and length.** Layered, verdict on top and mechanics below, so a funding decision can
     be made from the first two sections and an Agent Builder engineer can read the rest. ~2400
     words.
  3. **The two unsettled questions.** _Whether this belongs in the transcript at all_ is **dropped**:
     it is a premise of the original PoC request from the user's PM, so the write-up does not
     re-open it. _Whether mutable attachments are the right primitive_ is **kept**, and stated as a
     conclusion rather than an open question: it can probably be made to work inside Agent Builder,
     it is neither elegant nor robust, and the framework ideally offers a better way to host an
     interactive visualisation. Framed with the user's point that Agent Builder is a moving target,
     so the whole write-up reads as input from a downstream consumer about what the API would need
     to offer.
  4. **Scope.** Also covers #6059's second conclusion AC (what this taught us about the remaining
     spec operations), not only the three cost categories in this task file.
- Note for the coordinator: the spec's six capabilities are not enumerated in any workspace doc, only
  the superseded candidate tables in `issue-agent-chat-renderer-poc.md`'s private half. So the
  "operations not built" section is built from what generalises out of what _was_ built (the
  refinements model, the lens model, version and ref cost, the top-N framing) plus the two candidates
  the docs do name. It does not claim to enumerate the four unbuilt capabilities.
- Next: user review of `__tmp__/6059-outcome-comment.md`. Flip to `done — awaiting fold-in` once the
  user is happy with it, or revise. Do not post it.

### 2026-09-11 — Split into three comments, as rough structures

- Decided (user): one comment is the wrong shape. Split into three, posted in order:
  1. the user journey, with illustrative diagrams and screenshots;
  2. the implementation and the hurdles that had to be overcome;
  3. the verdict on technical feasibility, a reflection on the value of the journey, and references
     to concurrent efforts.
     Structures first, then each one written interactively.
- Changed: `__tmp__/6059-comment-1-journey.md`, `__tmp__/6059-comment-2-implementation.md`,
  `__tmp__/6059-comment-3-verdict.md` — new, all three are skeletons. Headings, per-section intent,
  source pointers, and draft Mermaid diagrams where a diagram is cheap enough to react to.
  `6059-outcome-comment.md` is kept unchanged as the source draft the three are cut from; comment 2
  inherits most of it.
- Verified: nothing new. No claim was added that is not already traceable to the plan or the state
  doc, and no new number was introduced.
- Unverified: the Mermaid diagrams have not been rendered anywhere, let alone in GitHub's renderer
  against both themes. The `classDef` colours in comment 1 in particular are guesses.
- Two gaps that need the user, both recorded in the files themselves:
  - **Screenshots do not exist.** Comment 1 lists nine slots with what must be visible in each, and
    the open questions on theme, width (the header collapses to icon-only below 560 px) and whether
    to crop to the attachment or keep the transcript.
  - **Concurrent efforts cannot be written from the docs.** Comment 3 section 4 lists the seven the
    PoC docs mention, each with what is known and what is not. Agent Builder's own roadmap is the
    one that could change the recommendation, and nothing in this workspace records it.
- Next: pick a comment and write it. Comment 1 is blocked on the screenshots unless the prose is
  written around empty slots; comment 2 is unblocked and is mostly already drafted in
  `6059-outcome-comment.md`; comment 3 is blocked on the concurrent-efforts answers.

### 2026-09-11 — Comment 1 written

- Changed: `__tmp__/6059-comment-1-journey.md` — skeleton replaced with the full prose draft.
  Seven-step walkthrough, the two kinds of button, what the agent sees, two Mermaid diagrams, and
  what the journey does not do yet. Screenshot table kept as it was. A "Notes on this draft" section
  at the bottom records the four judgement calls; it is not for posting.
- Decided (agent, flagging for the user rather than settling it): **steps 4 and 5 are agent turns,
  not instant actions**, and the draft says so. Compare-baseline persists the scope and then submits
  a message, and "Back to top patterns" does the same. Writing them as instant would have been the
  easier story and would not survive a reader clicking through it.
- Verified: every number traced to the state doc before it was written. Muting promoting Kafka
  consumer lag at 83; 105 / 363 / 422 ms; three mutes 65 ms apart producing one re-query; the
  16:44–18:44Z shift and the 2 h → 3 h → 1 h 30 zooms; 270 → 257 / 202 → 193 / 135 → 129 / 45 → 43
  with Kafka overtaking Disk at 30 against 29; the 3612484 ms offset across four operations with
  baseline lengths 120 / 180 / 90; the 720-document histogram matching the clicked row; the
  540 → 85 follow-up sequence; the "As of this reading" quote; 600 against 426, +174, +41%.
- Unverified: **neither Mermaid diagram has been rendered anywhere**, let alone in GitHub against
  both themes. The floating `KEY` node in the first is the most likely thing to render badly.
- Still open on this comment: **the nine screenshots do not exist.** The slots and what must be
  visible in each are in the file, along with the theme, width and cropping questions. Asked the
  user whether I should drive the browser and capture them.
- Next: the screenshot decision, then comment 2 (unblocked) or comment 3 (needs the
  concurrent-efforts answers).

### 2026-09-11 — Screenshot session (in progress)

- **RESEED, before:** about to run `node __tmp__/seed_logs_poc.js` at the user's explicit request, to
  capture the nine screenshots for comment 1. This rewrites the `logs-poc-default` data stream and
  will move counts and category ranks under anyone else mid-run. ES and Kibana both answered 200
  before starting.
- **RESEED, after:** `indexed=3685 errors=false`, `count=3685 patterns=32`. Route harness
  `node __tmp__/verify_refinements.js` passed all seven assertions against the new seed (unfiltered
  3685, `only-pattern` 720, `exclude-pattern` 2965, backfill to 8, `only` leaves exactly one row).
  Counts and ranks have moved for anyone who was mid-measurement.
- Driven in the browser, one fresh conversation, sidebar collapsed, dark theme, attachment width
  768 px. Eleven screenshots captured. **They are on the local machine in `/tmp/lx18-shots/`, not in
  the repo:** the integrated browser does not share a filesystem with the remote workspace, so
  Playwright cannot write into `__tmp__/`. An empty `__tmp__/shots/` directory was created before
  that was discovered and can be deleted.
- Verified, all observed live rather than taken from the docs:
  - The agent chose `explore_log_patterns` unprompted, rendered 8 rows, `aria-rowcount` 8, grid label
    "Top 8 log patterns by document count".
  - Mute backfills: muting "User authenticated successfully" pulled "Kafka consumer lag" into the
    cut; a second mute pulled in Disk usage and kept the count at 8.
  - One zoom out took the window to `Sep 11, 15:33 → 17:03`, moved the orders endpoint from 108 to
    147 and past the database-timeout pattern at 136, and swapped Disk usage out for Retry budget
    exhausted at 17.
  - Compare-baseline sent a message with **no pattern text**; the agent called `attachments.read` to
    discover the scope, then queried. Histogram current 136 against baseline 13, matching the clicked
    row's 136 exactly.
  - "Back to top patterns" dropped the `Only:` chip, kept both mutes and the window, and the agent
    called `explore_log_patterns` with nothing reconstructed.
  - "Explain this change": 136 vs 13, +123 (+946%), busiest bucket 36 at 14:03 UTC, moved-most bucket
    also 14:03 up 35, no raw bucket values, plus a scoping disclaimer and "As of this reading".
  - "Biggest?" after muting the 147-document row answered 136 at 30% of the cut, having called
    `attachments.read` first. It did not repeat the 147.
  - Summarize: named its inputs and the muted count, 55% of the 450 documents in the cut for the top
    two, 0 rising and 0 flat, no muted pattern named, recommended a mute, and **re-rendered the live
    table** with all eight mute buttons enabled.
  - Superseded renders: four "Superseded" badges, window picker and all four shift/zoom buttons
    `disabled`, chips with no remove cross, zero mute buttons, Investigate and Summarize still
    enabled.
  - Incidental corroboration of two documented framework items: the attachment panel's parent is a
    `<p>` (the DOM-nesting warning), and the version chip renders under a hardcoded "Added" label
    below the round.
- Changed: `__tmp__/6059-comment-1-journey.md` — steps 2, 3, 4, 6 and 7 rewritten so every number
  comes from this session and matches the screenshots. Replaced the "screenshots to capture" table
  with a captured-file table and a note on which shots actually belong in the comment.
- Unverified: the two timings in the mute sequence diagram (105 ms, 422 ms) were **not** re-measured
  in this session; they remain earlier measurements. The 3612484 ms baseline offset, the "what window
  is this?" exchange and the 154k-token trace are also earlier, and the prose now says so. Neither
  Mermaid diagram has been rendered in GitHub.
- Next: user picks which shots go in, then comment 2 (unblocked, and now has live evidence for the
  superseded and chip-placement points) or comment 3 (still needs the concurrent-efforts answers).

### 2026-09-11 — Images placed, measurements removed from comment 1

- The user copied the eleven screenshots from the local `/tmp/lx18-shots/` into `__tmp__/shots/`, so
  they are now in the repo and the relative paths resolve.
- Changed: `__tmp__/6059-comment-1-journey.md` — ten images embedded inline at the steps they
  illustrate, replacing the `[SHOT n]` markers and the slot table. The slot table is gone; a short
  provenance note replaces it.
- Decided (user): **remove specific measurements from this comment.** This reverses part of the
  previous entry, which had just reconciled every number against the capture session. Removed:
  document counts, the window timestamps, the ratio and percentage in the comparison, the share of
  the cut, the two timings in the mute sequence diagram, the 3612484 ms baseline offset, the 560 px
  header threshold, the 154k-token trace, and the one-in-five / zero-in-seven stale-answer rates. In
  each case the behaviour the number was evidence for is still stated, and the screenshots carry the
  actual values.
- Kept deliberately, and flagged in the draft notes: the table being a **top-8 cut**, and there being
  **two views**. Both describe the shape of the feature rather than an observation, and both are
  visible in every screenshot.
- Verified: grepped the file for digit-plus-unit patterns and for long numbers. The only remaining
  numerals are the issue reference `#6064` and the capture date in the provenance note.
- Unverified: the Mermaid diagrams still have not been rendered in GitHub, and the inline image
  paths are repo-relative, so they will need swapping for uploaded attachments when the comment is
  posted.
- Note for whoever writes comments 2 and 3: **the measurements now live only there.** Comment 1 no
  longer carries any of the evidence, so the numbers from the capture session are recorded in the
  previous progress-log entry and nowhere else in the drafts.
- Next: comment 2, which is unblocked and already mostly drafted in `6059-outcome-comment.md`, and
  now has `09-superseded-render.png` plus live corroboration of the `<p>` nesting and the "Added"
  chip label. Comment 3 still needs the concurrent-efforts answers.

### 2026-09-11 — Fixed the broken Summarize screenshot

- The user spotted that `07-summarize.png` was wrong. It was: captured with a full-element screenshot
  of a round taller than the viewport, which Playwright renders by scrolling and stitching. The
  conversation's fixed message box and the Kibana header repainted at each scroll step, so the frame
  had empty bands top and bottom, the Kibana search bar bled into the middle, the answer began
  mid-sentence, and the re-rendered live table at the end was painted over by the message box. That
  table is the entire point of the shot.
- Tried first and abandoned: hiding the fixed and sticky elements, then re-taking the element shot.
  Hiding `nav` reflowed the page and Playwright never reached a stable element, so the capture timed
  out. Visibility was restored.
- Fixed by splitting the answer into two viewport-clipped captures, both taken above the message
  box's fixed region:
  - `07-summarize.png` re-taken — prompt, the `attachments.read` call, "Computed from the selected
    window … 3 patterns muted", then dominance, trends and relatedness.
  - `07c-summarize-live-table.png` new — the closing recommendation followed by the re-rendered live
    table with all eight rows, sparklines and three enabled actions per row.
- Changed: `__tmp__/6059-comment-1-journey.md` — step 7 now carries both images with a sentence
  between them, so the re-render reads as the consequence of the recommendation rather than as
  decoration. Added a line to the screenshot note explaining why that answer is two images.
- **Action needed from the user:** both files are on the local machine in `/tmp/lx18-shots/` again,
  not in the repo. `07-summarize.png` (overwritten) and `07c-summarize-live-table.png` (new) need
  copying into `__tmp__/shots/`, same as last time.
- Lesson for any further captures: element screenshots of anything taller than the viewport are
  unreliable on this page. Scroll, then clip to the region between the sticky header and the fixed
  message box.
- Next: unchanged. Comment 2, or comment 3 once the concurrent-efforts questions are answered.

### 2026-09-11 — Unslop pass over comment 1

- Ran the `unslop` rewrite flow over `__tmp__/6059-comment-1-journey.md`. All four scanners were
  already clean on the source (0 banned phrases, no structure flags, no silhouette flags), so every
  finding came from reading rather than from tooling.
- Changed: four sentences, 1.1% of the document.
  - Step 4: "the agent is asked, so the agent is asked about a view … rather than being asked to
    rebuild one" — three uses of "asked" in one sentence.
  - Step 6: "the agent answers … and will point out that the picker has moved" asserted a general
    behaviour on the strength of one observation. Back to past tense, which is what was seen.
  - "What the agent sees": "so it can work out that a reading has gone stale rather than having to be
    told that it might have" — the trailing ellipsis was opaque. Now "check whether … rather than
    simply being warned that it might be".
  - Draft notes: "harder to follow than the images" compared the wrong two things.
- Verified: diff shows only those four hunks. All 22 quoted strings byte-identical between original
  and rewrite. Post-rewrite scanners unchanged and clean; readability grade 12.9, no staccato.
- **`validate_preservation.py` reports 36/38 and fails, and the failure is a false positive.** Its
  quote extractor pairs the closing `"` of one short phrase with the opening `"` of a much later one,
  producing two multi-paragraph pseudo-quotes that happen to straddle two of the edits. Confirmed by
  extracting and diffing the real quoted strings, which are identical. Worth knowing before anyone
  trusts that script on a document with many short quoted UI labels.
- Unverified: nothing new was driven. No screenshot, number or claim changed.
- Next: unchanged. Comment 2, or comment 3 once the concurrent-efforts questions are answered.

### 2026-09-11 — Reviewed comment 1 against the issue itself

- Checked the live issue: `gh issue view 6059 --repo elastic/observability-dev` reports **state open,
  zero comments**, label `Team:obs-signals-logs`, title still "[Logs Exploration] PoC: interactive
  renderers for iterative log sifting in Agent Chat". So this will be the first comment on the
  thread, read straight after the acceptance-criteria checklist.
- Changed: `__tmp__/6059-comment-1-journey.md`.
  - New opening saying what the three comments are and that the verdict is in the third.
  - Anchored the two views to the criteria's own names, "Renderer A" and "Renderer B", once each.
  - **Named the deviation from the "Baseline-overlaid histogram" criterion.** The criterion says
    overlaid, the build clusters. The draft had said "clustered bar series" with no acknowledgement,
    which reads as a silent miss to anyone ticking the list.
  - Added the baseline picker to step 4. "Baseline epoch picker" is its own criterion; the draft only
    said the baseline moves with the window, which is a different claim.
  - Added what Investigate does. Also a named criterion, mentioned twice as a button and never
    explained.
  - "comment 2" / "comment 3" → "the next comment" / "the third comment", since nothing links until
    they are posted.
  - Moved the internal screenshot notes below an explicit "Working notes below this line" heading, so
    the postable region is unambiguous.
- Left for the user, recorded in the draft's notes: whether to drop two images for length, whether to
  reconcile the issue title's "sifting" with the PoC's "exploration" naming, and whether "the cut"
  needs a gloss.
- Unverified: nothing driven. No screenshot, number or claim changed.
- Next: unchanged. Comment 2, or comment 3 once the concurrent-efforts questions are answered.

### 2026-09-11 — Comment 2 written

- Changed: `__tmp__/6059-comment-2-implementation.md` — skeleton replaced with the full draft, about
  2,400 words. Shape of the build with an architecture diagram, the payload model, seven hurdles
  ordered by cost, what the tests did not catch, and what is left in the working tree.
- Embedded `./shots/09-superseded-render.png` in hurdle 3, which is where it belongs: it is the
  visual proof that write-disabled-on-stale works, sitting immediately above the explanation of the
  case it does **not** contain.
- Decided (agent, recorded in the draft's working notes, all three were open questions in the
  skeleton):
  1. **Kept the architecture diagram and the payload-model section.** Neither is in
     `6059-outcome-comment.md`. The diagram covers the emit-server-side arrangement, which is the
     part most likely to be copied by another team.
  2. **Kept the sharp-edges list in full** rather than collapsing it. Seven items, each a cheap fix
     for the Agent Builder team, and this is the only place they are written down.
  3. **Ref accumulation lives here** as a measured framework defect (hurdle 6). The argument about
     whether the primitive is right stays in comment 3, which cross-references rather than repeats.
- Carried forward from comment 1's review: forward references are worded "the previous comment" and
  "the third comment", never numbered, since nothing links until the comments are posted. Working
  notes sit below an explicit "Not part of the comment" heading.
- Verified: banned-phrase scan 0 violations after one fix ("the real fix is" flagged as throat
  clearing, rewritten as a direct statement). Structure and silhouette scans both report no flags.
  The only em-dash is in the file's own title line, same as comment 1; the two ellipses are inside
  code spans and are literal.
- Unverified: the Mermaid architecture diagram has not been rendered anywhere, in GitHub or
  otherwise. Every measurement in the comment is quoted from the state doc rather than re-driven in
  this session.
- Two open questions for the user, in the draft's working notes: whether the Elasticsearch `must_not`
  finding should become its own issue against Elasticsearch with this comment reduced to a pointer,
  and whether 2,400 words is too long.
- Next: comment 3. Still blocked on the concurrent-efforts answers, which is the one thing in these
  drafts I cannot source from the workspace.
