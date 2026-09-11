# Outcome

## Verdict

Every acceptance criterion above passes, driven against a running instance rather than reasoned from code. The interaction model works. A click inside an attachment renderer changes the view without an agent turn, the change survives the next agent turn, and the agent reads it.

That is the smaller half of the result. The larger half is what Agent Builder had to be bent into doing to get there. This cost five local edits to code owned by other teams, a set of workarounds inside our own code that exist only because of how the framework behaves, and one defect that cannot be fixed from our side at all. The logs feature was the vehicle. What the framework did and did not support is the finding.

The summary for a build decision: this can be made to work inside Agent Builder as it stands, the result is neither elegant nor robust, and one gap blocks shipping. The framework has no supported way to host an interactive visualisation that a user drives and a model reads. We built one by using a versioned content blob as three things at once: the renderer's persisted state, the model's per-round view of that state, and the transcript entry. It holds. It strains at every point where those three jobs disagree.

Agent Builder is also being actively evolved underneath this. The useful way to read the rest of this comment is as input from a consuming team about what the API would need to offer for this to become a supported pattern, not as a list of complaints.

## What passes

| AC                                             | Status                                           |
| ---------------------------------------------- | ------------------------------------------------ |
| Renderer A: pattern table with sparklines      | done                                             |
| Renderer B: baseline-comparison histogram      | done, two clustered bar series                   |
| Both validate payload and fail visibly         | done, zod server-side, error callout client-side |
| Agent selects the right one without being told | done                                             |
| Mute a pattern (instant)                       | done, row gone by the 105 ms sample, no remount  |
| Time range picker (instant)                    | done, refetches, no remount                      |
| Baseline epoch picker (instant)                | done, refetches, no remount                      |
| Investigate a pattern (agent turn)             | done                                             |
| Summarize patterns (agent turn)                | done, relabelled "Summarize top patterns"        |
| Instant vs agent-turn visually distinct        | done, sparkle icon plus tooltips                 |
| Loop state survives turns                      | done                                             |
| Minimal skill                                  | done                                             |

The measurements behind those rows, all taken in the browser or at the route:

- Muting one row at `LIMIT 8`, sampled every 50 ms: the row is gone by 105 ms, one refetch fires at 363 ms, and the table is back to 8 rows at 422 ms with rank 9 promoted in. Three mutes 65 ms apart produce a single refetch at 473 ms. No subtree remount in any of it, checked by stamping a property on the grid DOM node.
- A time range change swaps the table contents within one 60 ms sampling frame. Two changes in quick succession both issue a request and the later one wins. A forced 500 rolls the window back and shows a callout without touching the data.
- Compare-baseline from a row issues the query, then the content write, then the turn, so the scope is persisted before the agent starts. The resulting histogram totals 720 documents, exactly the count shown in the row that was clicked.
- Transcript fidelity holds. With ref versions `[[1,2],[3]]`, round 0 stays pinned below the histogram's version, still renders the pattern table, shows a "Superseded" badge, and has its write buttons disabled while its agent-turn button stays enabled.
- The ES|QL `CATEGORIZE` plus `SPARKLINE` query runs in about 250 ms over 2160 documents.

Six bugs were found while building this. All six passed type-check, lint and unit tests. Three were visible only by driving the running UI.

---

Everything below is the mechanics, for anyone deciding what would have to change before this is buildable.

## Cost 1: local edits to other teams' code

Five files, no PRs. Nothing ships until they are reverted or upstreamed, which makes this the most consequential item in the PoC. In substance they add two capabilities the browser attachment contract does not have, plus two changes that are not additions.

**A content write.** `updateContent` on `AttachmentsService`, mirroring the existing `updateOrigin` http wrapper, plus optional `updateContent` on `GetActionButtonsParams` and `InlineRenderCallbacks`, wired into the inline host component. Optional because six consumer test files hand-construct those params. The public `PUT .../attachments/{attachment_id}` endpoint already existed with no caller anywhere in Kibana and no browser wrapper, which #6064 established. This is a candidate for upstreaming close to as written, with one caveat: upstreaming it unchanged blesses the full-payload PUT as the write shape for attachment content, and that is the thing that does not work under concurrency. See the blocker below.

**A way for a renderer to start an agent turn.** Optional `submitMessage` on the same two interfaces, wired from `useSubmitMessage()`. Nothing else in the contract can do this. `openChat` silently drops `initialMessage` into an already-open conversation and targets a different React root. The shape is right and the semantics need the owning team. `useSubmitMessage` calls `sendMessage` with no in-flight gate, and a handler has no way to signal that the write the turn depends on failed. Both of those became defects on our list.

**The allow-list entry** (two tool ids, one skill id, one attachment type id) is the gate working as designed. `registerType` throws without it. It is not a change to upstream, it is a conversation to have with the Agent Builder team before any of this is real.

**The content-update route change is expedient.** The route computes the correct ref and never persists it to the round, so the framework re-renders the stale pinned version even though `versions[]` already holds the new one. We changed it to pass `ATTACHMENT_REF_ACTOR.user` and call `addAttachmentsToLastRound`, with a fallback to the old path for a conversation that has no rounds. That makes writes visible, and it also produces the two defects #6064 already flagged: one ref appended per click, unbounded, and version chips placed beside the user's prompt under a hardcoded "Added" label. The correct version of this change collapses refs and attributes button-driven edits properly. That is a design call for the Agent Builder team.

## Cost 2: workarounds inside our own code

These took the most time and are invisible in a diff. Each is forced by a framework behaviour and has nothing to do with logs.

**Content writes must not invalidate the conversation.** Identity is coupled to data freshness: the pinned version both selects the data and forms the render key. Invalidating rebuilds the subtree about 712 ms after every click and transiently resurrects muted rows. Sampled every 20 ms across two mutes 200 ms apart, a muted row reappeared at t=405 and only settled at t=1393. A three-click sequence then landed its third click on an already-muted pattern, because the reverted row came back to position 0 under the pointer. Nothing was lost only because the mute action is idempotent. There is no configuration that gives a plain re-render with fresh data.

**Superseded renders have to be write-disabled.** The attachment renders in more than one round, and without invalidation those instances never reconcile. Muting in an older render PUT a full payload derived from its stale base and destroyed a newer mute. Disabling writes where `version < versionCount` contains the case where a round carries a ref, and only that case.

**`isReadonly: true` on the type, discovered late.** `prepareRoundInput` hardcodes `attachments: []`, so what reaches the model each round is attachment metadata plus a note telling it to call `attachment_read`. That read returns the raw payload unless the type declares itself read-only. Ours did not. Every rule in `format()` was dead code for most of this PoC, and the agent was reasoning off raw JSON: it quoted `121, 143, 146` and "buckets 33 to 36 are 0", values that appear only in the raw series. Any claim about model behaviour made before that fix was measuring something else.

**Anything that must hold on every round lives in `format()`.** Skill bodies are not reliably in context for button-triggered turns; an "Explain this change" round showed no `load_skill` call at all. `getAgentDescription()` is injected once per conversation per type. `format()`, reached through `attachments.read`, is the only per-round channel there is.

**A staleness warning inside `format()`.** The `attachment_context` block is gated on a round having refs, and the metadata fallback sits inside that branch, so a question-only round carries neither attachment metadata nor type description. A content PUT attaches its ref to the last completed round, which means changing the view and then asking a question produces exactly that round. The moment a reminder is most needed is the moment none is sent. `format()` now ends by stamping when its numbers were fetched, so staleness is checkable rather than asserted. It has to be checkable because previous rounds' tool results stay in context, which makes an earlier reading the strongest stale source in the transcript.

**Every zod bound has to do real work.** `maxContentLength` on `AttachmentTypeDefinition` is declared and never enforced. Three of ours were wrong before they were re-derived, in the direction where a tool input the schema accepted could produce an attachment that then failed validation.

**A lens must never register zero action buttons.** `AttachmentHeader` returns `null` when it has none, taking the title, icon and badges with it. Our first read-only implementation suppressed all actions and so deleted the header, including the "Superseded" badge that explained why the buttons were gone.

## Cost 3: gaps recorded and left alone

This is the list for the Agent Builder team. None of it was worked around.

- **Delta writes. This is the one that blocks shipping.** Full-payload PUTs cannot express concurrent intent. Read-only-on-stale does not contain it, because `resolveAttachmentVersion` falls back to `versions.at(-1)` when a round has no ref, so two renders both resolve to the latest version and neither is marked superseded. Reproduced deliberately: muting in the new render left the pattern listed in the old one, and muting a different row in the old render then reloading showed the new render's mute gone, with its pattern back and no chip. A mounted render cannot discover it has been superseded, because props stay frozen and content writes must not invalidate. `{ mute: pattern }` semantics would fix it properly, and that is a real API design question rather than a patch.
- **Ref accumulation.** One ref entry appended per button click, unbounded. Six refs observed on a single round after five mutes.
- **Chip placement.** `actor: user` puts version chips beside the user's prompt under a hardcoded "Added" label, which is the wrong place and the wrong word for a button-driven edit.
- **A missing version renders as `null` with no diagnostic.** If an attachment silently disappears rather than erroring, the round's `attachment_refs` against the stored versions is the first thing to check, and nothing in the UI says so.
- **Header actions have no tooltip channel.** `ActionButton` exposes a tooltip only through `disabledReason`. Our convention is that agent-turn buttons carry a tooltip; header actions cannot, and below 560 px they collapse to bare icons where two sparkles would be indistinguishable.
- **A failed write still starts the agent turn.** `persist`'s `.catch` resolves, so the flush cannot signal failure. It matters most for compare-baseline, which submits a message whose scope lives in the write that just failed.

One finding is Elasticsearch's rather than Agent Builder's, and nothing has been filed for it either. A pushed-down filter whose bool contains only `must_not` is silently ignored when the query combines a `WHERE @timestamp` range with `STATS ... BY BUCKET(@timestamp, ...)`. Isolated against 9.6.0-SNAPSHOT: 3685 documents unfiltered, 3685 with the exclusion that should have removed a pattern, 360 with the equivalent positive clause. Every other query shape tested honoured it. Adding any positive clause restores the behaviour, which is what our filter builder now does unconditionally.

## What this says about the operations not built

The two renderers and five interactions scoped here grew during the PoC. The lenses stayed at two and the interactions on them did not: compare-baseline from a row, leaving a scope to get back to the table, window shift and zoom, a per-lens global action, and removable refinement chips were all added after the ACs were met. How that growth behaved is the best evidence available for the operations that were left out.

**A new way to narrow the data is cheap.** Bespoke `mutedPatterns` and `kqlFilter` fields were replaced by one `refinements[]` union with one translation into DSL, one chip row and one merge rule. Adding a kind now costs a case in that translation and a control. Before that model existed, the volume comparison had no filter parameter at all, so muting noise in the table never affected the histogram, and nobody noticed.

**A new lens is more expensive but bounded.** The view and its result are discriminated unions on one key, so a third renderer is a new view type, a new result branch, a route, and exactly one primary header action. The accepted cost is that switching lenses discards the other lens's cached result, so switching back re-queries.

**Two of the candidate operations need something this PoC did not exercise.** A pattern-by-time heatmap needs per-pattern time buckets across a grid, which is a different query shape from either tool here. A significant-field-values view cannot be done in ES|QL at all, because `significant_terms` and `significant_text` have no ES|QL equivalent, so it needs `_search` and therefore a second data path.

**Every operation costs versions and refs.** One "Back to top patterns" click produced two attachment versions, and every refetch cuts a version and appends a ref. Ref accumulation is unbounded, so more operations makes that defect worse rather than different. More interactive operations also makes two live renders of one attachment routine rather than incidental, which is the case that loses writes.

**Model-facing framing does not come free with the data.** The pattern table is a top-N cut at `LIMIT 8`. Getting the agent to say so, and to stop totalling the counts into a document count, took wording in `format()`, in the tool description and in the skill. It also turned out to depend on position: moving the un-muted count sentence away from the row list it introduces brought back a miscount that had already been fixed once. Any view that shows a subset of something will need the same care, and it is a text problem rather than a rendering problem.

## The open question

Whether a mutable attachment is the right primitive for this is not settled, and the PoC did not try to settle it.

An attachment is a versioned, actor-attributed content blob written by full-payload PUT. This PoC uses one as the renderer's persisted state, as the model's per-round view of that state, and as the transcript entry, simultaneously. The strain appears in the same places each time. Identity is coupled to freshness, so there is no plain re-render with fresh data. Writes are full-payload, so two live renders overwrite each other. `format()` reaches the model only if the type declares itself read-only. Every refetch cuts a version and a ref. Splitting the loop state into a second attachment is the conceptually right shape and the contract cannot express it, because render props carry only the attachment being rendered, with no sibling access and no conversation id.

The conclusion is a judgement, not a measurement. This can probably be made to work inside the framework as it exists. It will not be elegant and it will not be robust. Delta writes would fix the worst of it. A supported way to host an interactive visualisation, with a state store that is not also the transcript record, would fix considerably more.

## How strong the evidence is

Every acceptance criterion was driven in a browser, not inferred. The model behaviour is thinner than that: one connector (Claude Sonnet 4.6), one seed, and a handful of drives per finding. The measurement for the stale-answer mitigation is 0 stale answers in 7 rounds against a roughly 20% baseline failure rate, which would happen by chance about 1 time in 5, so it shows the direction and the mechanism rather than a rate. One earlier refinement measurement is contradicted by a later one, both cannot be right, and the pre-fix state can no longer be reproduced, so those numbers are recorded as unknown rather than quietly dropped.

Two defects are open and behavioural rather than mechanical. Muted patterns are still named in conversational asides, even though `format()` forbids it and the summary path itself obeys the rule. And the agent sometimes answers from stale transcript text instead of re-reading the attachment, whose framework half is the ref-less round described above and was deliberately not worked around.
