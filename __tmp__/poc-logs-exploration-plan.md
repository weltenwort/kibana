# Logs Exploration PoC — plan and decisions

> Companion files: [`poc-logs-exploration-state.md`](./poc-logs-exploration-state.md) (what is built
> and verified), [`poc-logs-exploration-next-steps.md`](./poc-logs-exploration-next-steps.md) (the
> remaining gap). Source issues: [`issue-agent-chat-renderer-poc.md`](./issue-agent-chat-renderer-poc.md)
> (#6059, the authoritative AC) and [`issue-attachment-mutation-spike.md`](./issue-attachment-mutation-spike.md)
> (#6064, the mutation spike).

## Goal

Validate that Kibana's Agent Chat can host an interactive, human-steered log exploration loop: two
ES|QL tools that emit **one** mutable attachment server-side, a renderer that branches on the
attachment's `type` field, and loop state (muted patterns, time range, baseline epoch) that survives
agent turns.

Naming: "logs exploration" throughout. Never "sifting" (an earlier working title). The tools are
`observability.explore_log_patterns` and `observability.explore_log_volume_comparison` — renamed from
`get_*` in LX-17, because they steer a view the user is driving rather than fetching and returning.
The handler functions kept `getLogPatterns` / `getLogVolumeComparison`: those genuinely do fetch and
return, and the refetch route calls them as plain functions.

## Confirmed decisions

Do not re-litigate these. Each was either settled up front or established by measurement.

| Topic                        | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rendering path               | Attachment system, not the renderer registry — the registry has no write path                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Client mutation              | Option B from the spike: `updateContent` on `AttachmentsService` + persist refs in the content-update route. Local edits, no PRs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Agent-turn trigger           | Optional `submitMessage` added to the browser attachment contract, wired from `useSubmitMessage()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Invalidation                 | Content writes do **not** call `invalidateConversation()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Renderer state               | `useReducer` seeded lazily from `props.attachment.data`; no Redux                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Stale renders                | Superseded renders (`version < versionCount`) disable **writes**, keep agent-turn actions — except an agent-turn action that writes first. Compare-baseline persists a refinement before submitting and `runFetch` no-ops without `fetchView`, so it is hidden alongside mute rather than alongside Investigate                                                                                                                                                                                                                                                                                                                                 |
| Canvas                       | Not implemented. No `renderCanvasContent`, so `openCanvas` is never offered and `canvas_flyout.tsx` stays untouched                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Render surface               | Inline only; DOM-nesting warnings accepted (they are pre-existing framework behaviour — see state doc)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Histogram data               | Own ES\|QL `BUCKET` queries. Not `get_log_change_points`, whose `auto_date_histogram` gives misaligned grids and omits `timeSeries` for non-changepoint types                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Tool exposure                | A new allow-listed skill whose `getRegistryTools()` lists the two tool ids. No `configuration.tools` edit needed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Button convention            | Agent-turn buttons carry a sparkle icon and a "Starts a new conversation turn" tooltip; instant actions do not. **Header actions are the exception on both counts**: `ActionButton` exposes a tooltip only through `disabledReason`, so no header action has one, and below `COMPACT_WIDTH_THRESHOLD` (560 px) they collapse to bare icons — where two sparkles would be indistinguishable. "Back to top patterns" uses `sortLeft`, Kibana's established back affordance                                                                                                                                                                        |
| Instant refetch              | Internal HTTP routes on the observability plugin, wrapping the existing tool handlers, called from the renderer. Not an agent turn — the AC calls these instant                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Mute pushdown                | `must_not` DSL filter over `extractCategorizeTokens` output, so the top-N backfills                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Mute refetch                 | Mute **does** refetch, on a 300 ms trailing debounce that also carries the write. Changed in LX-1: at 8 rows the gap a mute leaves is too visible to defer to the next interaction. The earlier decision was that mute alone never refetched, to protect the "instant" claim — that claim survives because the row still leaves local state before any I/O                                                                                                                                                                                                                                                                                      |
| Pattern table size           | Top 8, enforced as the ES\|QL `LIMIT` rather than a display cap over a wider query, so the user's view and `format()` cannot disagree                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Top-N framing                | The "these are the largest N, not all of them" framing lives in `format()`, the tool description and the skill — model-facing copy — plus the grid `aria-label`. No caption in the view: it competed with the agent's own sentence above the attachment                                                                                                                                                                                                                                                                                                                                                                                         |
| Histogram shape              | Both epochs as `BarSeries`, clustered. Overlaying them is impossible in `@elastic/charts` — see rejected alternatives                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Payload model                | Built in LX-8. A journey is a subject, progressively refined, viewed through a lens, plus a cache: `{ source, refinements[], view, result }`. Mute, pattern scope and `kqlFilter` are one `Refinement` union with one `buildRefinementFilter`, one chip row and one merge rule. The stored shape broke; old conversations show the invalid-payload callout                                                                                                                                                                                                                                                                                      |
| `result` shape               | A discriminated union keyed to `view.type`, so a `volume-comparison` view cannot carry `patterns` and "the response is exactly `result`" is enforced by the type system. Cost: a lens switch discards the other lens's cache, so switching back re-queries                                                                                                                                                                                                                                                                                                                                                                                      |
| `kql` refinement             | Ships as a removable chip with no input to create one — the agent still sets it, the view shows and removes it. Rejected: a KQL input (its own task) and type-only, which leaves the agent's filter invisible                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Refinement origin            | `origin: 'user' \| 'agent'` is stored but not shown, so the chip row stays compact                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| View id                      | `histogram` → `volume-comparison`, taken while the stored shape was breaking anyway                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Refinement filter shape      | `buildRefinementFilter` always emits a positive clause, `match_all` when there is no other. A bool containing only `must_not` is silently ignored by one ES\|QL query shape — measurements in the state doc. The `match_all` also protects future shapes                                                                                                                                                                                                                                                                                                                                                                                        |
| `only-pattern` arity         | Singleton: `addRefinement` replaces an existing one rather than accumulating. Two scopes AND to nothing, since a document belongs to one category                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Compare-baseline prompt      | The message carries no pattern text; the scope reaches the tool through the refinement persisted first, and the skill tells the agent to call the tool with no parameters and not to reconstruct the pattern. The client does not set the lens either — it cannot build `view.baselineEpoch` without duplicating the tool's default, and the tool switches it                                                                                                                                                                                                                                                                                   |
| Global action                | One **primary** per lens, chosen on `data.view.type`, never zero — `AttachmentHeader` collapses without one. Pattern table: "Summarize top patterns" (relabelled from "remaining", which reads as "the ones you haven't shown me"; the prompt is unchanged verbatim because the AC depends on it). Volume comparison: "Explain this change", answered from the attachment's own summary lines. A lens may also register a `SECONDARY` action, which `AttachmentActions` renders as an `EuiButtonEmpty` left of the primary                                                                                                                      |
| Leaving a scope              | "Back to top patterns" on a scoped comparison removes the `only-pattern` refinement and starts an **agent turn** that renders the table. No client-side lens switch: the client never sets `view`, the tool does, so no state exists where `view` and `result` disagree. Rejected: switching the lens client-side and deciding what renders while the table's data is in flight. Label says "top patterns", not "all patterns" — the top-N framing rule applies to UI copy too                                                                                                                                                                  |
| Chip cross                   | Keeps one meaning on both lenses: remove the refinement, stay where you are. On the volume lens that leaves a legitimate unscoped total-volume comparison. Rejected: overloading it to also switch lenses                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Window picker                | `@kbn/date-range-picker`'s `DateRangePicker`, not `EuiSuperDatePicker`, because the shift and zoom buttons only exist there. Ungated — the `security_solution` precedent, not `unified_search`'s `DATE_RANGE_PICKER_FEATURE_FLAG`, which would mean threading `featureFlags` through the plugin and keeping the old branch alive. All four buttons, so `showZoomIn: true` on top of the package defaults. Rejected: hand-rolled `EuiButtonIcon`s beside the old picker                                                                                                                                                                          |
| Attachment readability       | `isReadonly: true` on the type, so `attachments.read` returns `format()` rather than the raw payload. Without it every rule in `format()` is dead code. Safe because `readonly` is enforced only in the agent's builtin add/update tools — the tool emit path and the user's writes are unaffected                                                                                                                                                                                                                                                                                                                                              |
| Prose about the view         | Three cases, branching on the shape of the round. A message that **renders** the view: deictic only — "the selected window", never the literal range, baseline or filter list. A **prose-only** reply: name what it was computed from, in the past tense. A reply that **analyses and then re-renders**: attribution above the `<render_attachment />` tag, never below it. In every case, answer literally if asked outright, and frame quoted numbers as a reading taken then. An earlier form of this decision suppressed the parameters unconditionally; it was replaced once it was clear the defect needs a live view beside the sentence |
| Re-rendering the view        | An analysis ends by re-rendering the view **when the reply recommends something the view can perform** — stated as that condition rather than a lens name, so it survives a new lens. In practice the pattern table; re-rendering after "Explain this change" would show a histogram whose only action is the button that just ran. `format()` interpolates `attachment.id` into a ready-made tag so the model cannot invent one                                                                                                                                                                                                                |
| Summarize's job              | Interpretation, not enumeration: dominance, trend, relatedness, what to mute or investigate next. #6059's AC is re-read as "a summary that excludes muted patterns" — listing every row with its count is no longer required. The prompt changed, so the AC was re-driven rather than assumed                                                                                                                                                                                                                                                                                                                                                   |
| Interpretation content       | `format()` carries what the view cannot show: each row's share of the cut, a `trend` token from `halfOverHalfDelta()` over the sparkline `format()` previously discarded, and a `Shape of this cut` block — the cut's own total, the largest pattern's share, rising/falling/flat counts, steepest riser and faller                                                                                                                                                                                                                                                                                                                             |
| Staleness warning            | `format()` ends, after the rows, with a block stamping `result.generatedAt` and telling the model to compare it against the `[Sent: …]` timestamp on the message it is answering — so staleness is **checkable**, not merely asserted. Carriers are the skill body and `format()` only; not `getAgentDescription()` and not `description`, both absent from the rounds that matter                                                                                                                                                                                                                                                              |
| "Say what the view does not" | Scoped to what the model **writes**, never to whether it reads. Stated unscoped in LX-10, it was read as licence to answer without reading — see the state doc                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Framework gaps               | Recorded, not worked around. The ref-less-round behaviour is Agent Builder's; it is mitigated in our own text only, with no sixth entry added to LX-6's local-edits inventory                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## Framework mechanics worth knowing

Established by reading source and confirmed against a running instance.

- **The default agent has `configuration.tools: []`** and `enable_elastic_capabilities: true`. That
  flag grants every registered built-in skill, and `loadSkillTools` dynamically attaches whatever
  `getRegistryTools()` returns when the agent calls `load_skill`. This is how all existing
  observability tools already reach the agent.
- **Skills marked `experimental: true` are filtered out** of the agent's built-in skill list, so the
  tools never arrive. This is why `observability.rca` is invisible by default.
- **Round pins are not static.** `computeCumulativeRefs` returns the _highest_ ref version seen up to
  a round, and the content-update route appends a ref on every write. `resolveAttachmentVersion`
  consults refs before falling back to `versions.at(-1)`.
- **Identity is coupled to data freshness.** The same version selects the data _and_ forms the
  `AttachmentRenderErrorBoundary` key (`id:version`). A ref that does not advance keeps the key stable
  but renders stale content; a ref that advances refreshes content but always moves the key. There is
  no configuration giving a plain re-render with fresh data.
- **Streaming remounts the subtree.** `render_attachment_plugin.tsx` renders a skeleton whenever
  `isStreaming`, so every agent turn tears down and rebuilds the renderer.
- **`AttachmentHeader` returns `null`** when it has no action buttons and no close button, taking the
  title, icon and badges with it.
- **`maxContentLength`** on `AttachmentTypeDefinition` is declared but never enforced.
- **Nothing lets a renderer start an agent turn.** `GetActionButtonsParams`, `InlineRenderCallbacks`
  and `CanvasRenderCallbacks` expose no send-message capability; `openChat` silently drops
  `initialMessage` into an already-open conversation and targets a different React root.
- **`format()` only reaches the model if the type sets `isReadonly: true`.** `prepareRoundInput`
  hardcodes `attachments: []`, so the `representation.value` path in `to_langchain_messages` is dead.
  What is injected 每 round is `attachment_context` — metadata only (id, type, operation, actor,
  version, estimated_tokens, description) plus a note telling the model to call
  `attachment_read(attachment_id)`. That read returns the **raw payload** unless the type is
  `isReadonly`, in which case it returns `format()`'s representation. Discovered in LX-9, after
  months of this PoC assuming otherwise.
- **Skill bodies are not reliably in context for button-triggered turns** — an "Explain this change"
  round showed no `load_skill` call. `getAgentDescription()` is injected once per conversation per
  type. `format()`, through `attachments.read`, is the only per-round channel, so anything that must
  hold every turn belongs there and not in the skill.
- **A standing "read first" rule already exists.** `attachmentToolsInstructions()` is static,
  unconditional and in the system prompt every round, ending _"Always read an attachment before
  referencing its content in your response."_ Adding another restatement of that rule is not a fix
  for a model that reads it and declines anyway.
- **A round with no `attachment_refs` gets nothing.** `prepareRoundInput` gates the whole
  `inputAttachments` block on `if (input.attachment_refs)`, and the `formatAttachmentsMetadata`
  fallback sits _inside_ that branch — it covers a missing `attachment_context`, not missing refs.
  There is no fallback to `attachmentStateManager.getActive()`, and `getAgentDescription()` is gated
  on refs too. So a question-only round carries neither metadata nor type description; confirmed
  live, `refs: []` → `attachment_context: false`. Because a content PUT attaches its ref to the last
  _completed_ round, changing the view and then asking a question produces exactly this round — the
  moment a reminder is most needed is the moment none is sent.
- **Previous rounds' tool results stay in context.** `convertPreviousRounds` replays tool-call steps
  as `ToolMessage`s, and `ignoreSteps` is never set `true` by any caller. So whatever `format()`
  emits persists on later rounds inside the message whose numbers are going stale — the only carrier
  that ages with its own data. It also makes an earlier reading the strongest stale source in the
  transcript: the tools' own results carry no pattern data, only `{patternCount, refinementCount,
timeRange, attachment_ids}`. Compaction is the exception: older rounds are replaced by a summary,
  taking the reading and any warning in it together.

## Phases as executed

**Phase 0 — framework enablement** (local edits to other teams' code, no PRs)

1. Three allow-list entries: two tool ids, one skill id, one attachment type id.
2. Content-update route passes `ATTACHMENT_REF_ACTOR.user` and calls `addAttachmentsToLastRound`, so
   the round ref advances with the version.
3. Optional `updateContent` and `submitMessage` on `GetActionButtonsParams` and
   `InlineRenderCallbacks` — optional because six consumer test files hand-construct these.
4. `AttachmentsService.updateContent`, mirroring the existing `updateOrigin` http wrapper.
5. Wire both into the inline host component only.

**Phase 1 — server**: shared zod schema in `common/`, attachment type whose `format()` states loop
state explicitly, two ES|QL tools, an emit helper that merges loop state forward, a skill.

**Phase 2 — browser**: `useReducer` state hook, pattern table with sparklines, baseline histogram,
shared controls, global action, README.

**Phase 3 — refetch**: two internal routes wrapping `getLogPatterns` and `getLogVolumeComparison`, so
tool and route share one query implementation. Stateless — the renderer already holds every parameter
and writes the new window and its data back in a single `updateContent` call.

## Rejected alternatives

Recorded so they are not re-proposed.

**Split loop state into a second attachment.** Conceptually right — immutable tool output separated
from mutable user state — but the contract cannot express it. `AttachmentRenderProps` carries only
the attachment being rendered; there is no sibling access and no `conversationId` (the same gap that
killed the spike's Option A). It also only defers the problem, since the view must still re-render on
mute, so state ends up in local React anyway.

**Render the attachment "unversioned" to stabilise the key.** `versionData` is optional and
`getAttachmentPreviewKey` falls back to `'latest'`, which suggests a mode that does not exist:
`render_attachment_plugin.tsx` always populates a concrete version inline and returns `null` when it
cannot resolve one. The optionality exists for pre-send pills. Forcing it would mean rendering the
latest version in every round, breaking transcript fidelity.

**Change the error-boundary key to `attachment.id`.** One word, removes the remount, but changes
shared behaviour for every attachment type and stops the boundary resetting on a new version.

**Store state in `description`**, which mutates in place without cutting a version. Abuses a
user-facing field.

**Redux for the renderer.** The server owns this state and re-derives the model's view of it every
turn, so a
client store is a second source of truth. No store lifetime matches the subtree: created inside it
dies on remount, module-scoped it leaks across conversations. It also does not solve read-modify-write,
which is about _where you read_.

**Canvas instead of inline.** Canvas is immune to the version-keyed remount, but only because
`CanvasProvider.openCanvas` stores a snapshot that nothing re-derives — stale by construction, not by
design. It lands in the same place as inline-without-invalidation while costing extra wiring in
another team's plugin and moving the loop out of the transcript. The one real argument for it is
width.

**A flat `patternFilter` field for LX-7's scope.** The obvious minimal change, rejected as polluting
loop state: `mutedPatterns` and `kqlFilter` are already the same kind of thing — accumulated
predicates — with bespoke fields, bespoke affordances and bespoke server translation. Another one
makes every future narrowing cost a new field everywhere.

**Grouping the payload into per-view `patternTable` / `histogram` subobjects.** Proposed as the fix
for spill-over between the two tools' merges, then rejected: the taxonomy is keyed on _which renderer
drew the data_, so a third tool needs a third bucket, every tool's merge has to learn about it, and
anything meaningful to two views has no home. It walls off spill-over instead of removing its cause.
The refinements model does the latter, because refinements narrow the subject and every lens over
that subject honours them.

**Modelling journey history inside the payload.** The attachment version chain already is the
journey: every write cuts a version, refs pin rounds to positions, and the transcript replays them.
Modelling steps inside the payload would duplicate the framework and grow the largest thing we PUT.
The payload describes the current position only.

**Explicit colours for the two histogram series.** Tried and reverted. The Borealis vis ramp is built
in `60`/`30` pairs per hue, so the first two series are always one hue at two lightnesses — structural,
not an unlucky assignment, and it applies to every two-series chart in this PoC. Four overrides were
reviewed in the browser (teal/grey, teal/pink, teal/blue, teal/pale-blue) and none beat the default
pair at the densities this view reaches. A grey baseline was argued for on the grounds that it
"survives greyscale"; that was asserted, then measured and found false — see the state doc for the
luminance ratios.

**Overlaying the two histogram bar series.** Tried first, at the user's request; impossible in
`@elastic/charts@72.0.1`, established by reading the library. `getBarIndexKey` keys on
`groupId + specId + splitAccessors + yAccessor`, so two bar specs always occupy different cluster
slots — giving them separate `groupId`s only splits the y-scale, it does not stop clustering.
`renderBars` then offsets each bar by `xScale.bandwidth * orderIndex` and clamps its width to
`widthRatio * bandwidth`, with both `widthRatio` and `widthPixel` clamped to that maximum, so a bar
can never leave its own slot. No prop combination produces an overlay. A step-curve `AreaSeries`
behind the bars was the only alternative and was declined.

**ES|QL `NOT MATCH` for mute exclusion.** The shape originally sketched from Discover's patterns
drill-down, inverted. ES|QL restricts full-text functions under `NOT`, and a DSL `must_not` filter
also avoids interpolating user-supplied pattern strings into a query.

**Invalidating content writes.** Measured, not assumed — see the state doc for numbers.
