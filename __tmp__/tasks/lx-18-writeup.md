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
