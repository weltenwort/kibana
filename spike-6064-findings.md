## TL;DR

**Yes. A button inside an attachment renderer can change what that attachment displays, with no agent turn and no reasoning latency. But not cleanly on today's `agent_builder`: doing it properly needs a small upstream change there, and without one the renderer has to work around the framework.**

The framework pins each rendered attachment to a specific version, and the public update endpoint does not participate in that mechanism. It computes the ref that would move the pin, then throws it away. So **as the code stands today**, the only way to show current _server-authoritative_ content is for the renderer to bypass the data the framework hands it and fetch the attachment itself. That works, and is demonstrated below. Local component state would also satisfy the literal question of "does the view change on click", since React state survives re-render and the memo key does not change, but it is optimistic rather than authoritative and is lost on reload.

This is not an invalidation bug. Invalidation already fires and the component already re-renders with fresh data, and it still draws the old version, because the pin is what holds it there. (Option B does add an explicit invalidation call, but as a deterministic trigger rather than a fix.)

This unblocks observability-dev#6059. Muting a log pattern does not require a reasoning turn.

There are two viable routes, and **the cheap one is not the one to build**. A workaround inside `observability_agent_builder` works today, with one open design question. A proper fix in `agent_builder` removes that question entirely, removes the need for the renderer to self-fetch at all, and is an omission rather than a new capability: an existing internal route already does the right thing. Both are set out below.

## Acceptance criteria

| #   | Criterion                                                                | Result                                                                                                                               |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Throwaway type renders inline, emitted by a tool not the model           | Done                                                                                                                                 |
| 2   | Button writes new content via the public update endpoint                 | Done. 200, `new_version` increments                                                                                                  |
| 3   | Does the inline view reflect the change without an agent turn?           | **Yes, with local work; cleanly with a small upstream change**                                                                       |
| 4   | Is the write visible to the next agent turn as a new version?            | **Yes**                                                                                                                              |
| 5   | Can `renderInlineContent` read the current version, or only the round's? | **Only the round's via props today. Current is reachable by self-fetching, and props carry it once the ref is persisted (Option B)** |
| 6   | Plumbing cost estimate for the real PoC                                  | Below                                                                                                                                |
| 7   | Is `maxContentLength` a constraint for a dense payload?                  | **No, it is not enforced at all**                                                                                                    |

## What was built

| Piece                                  | Path                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| Allow-list entries (attachment + tool) | `x-pack/platform/packages/shared/agent-builder/agent-builder-server/allow_lists.ts` |
| Server attachment type                 | `.../observability_agent_builder/server/attachments/spike_counter.ts`               |
| Tool that emits it                     | `.../observability_agent_builder/server/tools/spike_counter/tool.ts`                |
| Browser UI definition                  | `.../observability_agent_builder/public/attachment_types/spike_counter.tsx`         |

`validate` accepts `{ count, label }`; `format` renders text. The tool handler builds the payload server-side and returns `attachment_ids` so the agent can reference it. The model supplies only a label.

## AC3 / AC5: the mechanism, in detail

### Attachments are pinned per round by "refs"

An attachment lives once at conversation level with a `versions[]` array. Separately, each round stores pointers describing which version it touched:

```ts
interface AttachmentVersionRef {
  attachment_id: string;
  version: number;
  operation?: 'read' | 'created' | 'updated' | 'deleted' | 'restored';
  actor?: 'user' | 'agent' | 'system';
}
```

This exists for transcript fidelity. If round 0 says _"I found 3 errors"_ and the attachment is later edited to 7, round 0 must still render 3, or the prose contradicts the card beneath it. That behaviour is correct and should be preserved.

At render time the browser derives a **cumulative** ref per round. `computeCumulativeRefs` in `round_layout.tsx` scans rounds `0..i` and keeps the highest version seen per attachment. `resolveAttachmentVersion` in `render_attachment_plugin.tsx` then picks, in order:

1. an explicit `version="…"` on the `<render_attachment>` tag
2. **the cumulative ref version**
3. the latest version

Rule 2 fires whenever any ref exists and permanently shadows rule 3.

### Why the update endpoint cannot move the pin

Only the agent-turn pipeline writes refs. The state manager records every touch via `recordAccess`, and `add_round_complete_event.ts` drains it with `getAccessedRefs()` onto the round.

The `PUT /conversations/{id}/attachments/{id}` route builds its own state manager and calls `update()`, which **does** call `recordAccess(id, v2, 'updated')`, so a correct `updated@v2` ref is constructed in memory. The route then persists only `attachments: stateManager.getAll()` and never calls `getAccessedRefs()`. The ref is computed and thrown away. Nothing is written to `rounds`.

Observed in a real conversation:

| Round | Stored refs                                   | Cumulative max | Rendered    |
| ----- | --------------------------------------------- | -------------- | ----------- |
| 0     | `[screen-context v1, spike v1 created/agent]` | v1             | v1, count 0 |
| 1     | _no key at all_                               | v1             | v1, count 0 |

All while `versions[]` held v1 through v4.

### What this rules out

- **Waiting for invalidation.** `versionCount` updates on its own, so the conversation is refetched and the component re-renders with fresh data, and still draws v1. This is not a caching problem.
- **Piggybacking `updateOrigin`** to force `invalidateConversation()`. Still v1. It buys a re-render the code already gets for free.

### What does work

The renderer fetches the conversation itself and reads `versions.at(-1)`, ignoring `props.attachment.data`. Three clicks advanced v2 → v3 → v4 with the card tracking live, no agent turn. PUT roundtrip ranged **~100–620 ms**.

One requirement that is easy to miss: **the mutate handler must read-modify-write against current content.** Computing `count + 1` from the pinned props means always writing `1`, so repeated clicks never advance past v2. Pinned props are unsafe as an input to a write.

## AC4: visibility to the next agent turn

Confirmed by inspection. After the write, the agent called `attachments.read` and received:

```json
{ "attachment_id": "bcf02562-…", "version": 2, "data": { "count": 1, "label": "mutation test" } }
```

It answered _"the current count is 1"_, which is correct, while the card directly beneath it displayed `count 0`.

**This is the main risk in the current behaviour.** It is not staleness. The agent and the user see different values at the same time. Any feature built on mutable attachments without addressing this will produce contradictions in the transcript.

## AC7: `maxContentLength`

`AttachmentTypeDefinition.maxContentLength` is declared (`type_definition.ts:81`) and **never read anywhere in the codebase**. `DEFAULT_MAX_CONTENT_LENGTH` does not exist as a constant. It appears only in a doc comment. Every other `maxContentLength` in `agent_builder` is the unrelated LLM HTTP response limit.

So 10k does not constrain a dense pattern table today. But the option is unimplemented API surface, so do not rely on it either. If a bound is wanted, it has to be enforced in the type's own `validate`.

## AC6: cost estimate

Two routes. Option B is recommended despite being the "upstream" one, because it solves more without being meaningfully harder.

|                         | Option A                         | Option B                   |
| ----------------------- | -------------------------------- | -------------------------- |
| Current content via     | Renderer self-fetch              | Props                      |
| Click latency           | ~100–620 ms                      | ~950–980 ms                |
| `conversationId`        | URL parse, breaks in the sidebar | Supplied by the framework  |
| Agent/user divergence   | Remains                          | Fixed for the newest round |
| Scope                   | One plugin, no upstream change   | `agent_builder`, 4 files   |
| Reusable by other types | No, each renderer repeats it     | Yes                        |
| Open defects            | None                             | Ref growth, chip labelling |

### Option A: workaround in `observability_agent_builder`

**Shape: "Yes, with local work."** Proven working in this spike.

**Required**

- Self-fetch hook in the renderer, ~40 lines
- Read-modify-write in the mutate handler. Not optional: computing from pinned props always writes the same value, so clicks stop advancing after the first
- A way to obtain `conversationId`. **This is the one real design question.** `AttachmentRenderProps` and `GetActionButtonsParams` do not carry it. The spike parses it from `window.location.pathname`, which works in the full app and **breaks in the sidebar**, where the id lives only in React context.

**Costs accepted**

- One extra conversation GET per render and per write
- Renderers diverging from the transcript-fidelity model the framework intends
- The agent/user divergence in AC4 remains unfixed: the card is patched, but the round's ref still says v1
- Each mutating renderer re-implementing this independently

### Option B: fix it properly in `agent_builder` (recommended)

Both halves were implemented and verified. The card advanced on each click with no agent turn:

```
option b count 0 (rendered v1 of 1)
option b count 1 (rendered v2 of 2)
option b count 2 (rendered v3 of 3)
option b count 3 (rendered v4 of 4)
```

The renderer reads `props.attachment.data` only. No self-fetch and no URL parsing. Round trip including the invalidation refetch was **~950–980 ms**, against ~100–620 ms for the bare PUT in Option A, so the correctness comes at the cost of one refetch.

It is still read-modify-write, and that matters. The handler spreads current data and increments it (`{ ...attachment.data, count: count + 1 }`). What Option B removes is the explicit GET, not the pattern. The update endpoint takes no expected-version precondition, so two clients clicking at the same time can both read v4 and both write v5, and one edit is silently lost. For a mute toggle, where the write is idempotent and sets an absolute value rather than deriving one, this does not bite. For anything that increments or appends, it does, and the endpoint would need a version precondition.

Two halves. Neither requires the renderer to fetch anything.

**Half 1, server: stop discarding the ref that is already computed.**

`stateManager.update()` already calls `recordAccess(id, v2, 'updated')`. The route just never persists it. `POST /internal/…/sml` (`routes/internal/sml.ts:117`) is an existing out-of-band route (no agent turn) that does this correctly:

```ts
// today, in the content-update route: persists content, drops the ref
await client.update({
  id: conversationId,
  attachments: stateManager.getAll(),
});

// instead: exactly what sml.ts already does
await client.addAttachmentsToLastRound({
  id: conversationId,
  refs: stateManager.getAccessedRefs(),
  attachments: {
    snapshot: conversation.attachments ?? [],
    produced: stateManager.getAll(),
  },
});
```

`addAttachmentsToLastRound` merges into the last round's `input.attachment_refs` with reconciliation that survives concurrent writes. One correctness detail: `update()` defaults the actor to `system`, so a button click should pass `ATTACHMENT_REF_ACTOR.user` for the transcript to attribute the edit correctly.

**Half 2, client: a content twin of `updateOrigin`.**

The invalidation plumbing exists already; it is only wired for origin. `AttachmentsService` gains the missing verb, and `inline_attachment_with_actions.tsx` wraps it identically to `updateOrigin`:

```ts
const updateContent = useCallback(
  async (data: unknown) => {
    const result = await attachmentsService.updateContent(conversationId, attachment.id, data);
    conversationActions.invalidateConversation();
    return result;
  },
  [attachmentsService, conversationId, attachment.id, conversationActions]
);
```

Then expose it on `GetActionButtonsParams` / `InlineRenderCallbacks` alongside `updateOrigin`.

**What the renderer reduces to.** The self-fetch hook, listener set, URL regex and read-modify-write all disappear:

```ts
getActionButtons: ({ attachment, updateContent }) => [
  {
    label: 'Mute',
    type: ActionButtonType.PRIMARY,
    handler: () => updateContent({ ...attachment.data, muted: true }),
  },
];
```

**This also removes the `conversationId` problem.** `inline_attachment_with_actions.tsx` already receives `conversationId` as a prop and already closes over it for `updateOrigin`. An equivalent `updateContent` closes over it the same way, so the renderer never sees it. No URL parsing, and the sidebar case stops being a problem.

**Semantics to agree on.** Refs merge into the **last** round, so a card in the newest round updates in place while a card rendered several rounds ago stays pinned. That is the transcript-fidelity design working as intended, and it is right for the mute-a-pattern flow where the card is the one the agent just produced. The edge case to decide deliberately: muting from an older card that a user has scrolled back to will not visibly change that card. Accepting this initially seems reasonable; the alternatives are to also write a ref to the round containing the render tag, or to show a "newer version available" affordance.

**Two defects this surfaced, both consequences of setting `actor: user`.** Neither affects version resolution, which stays correct because `computeCumulativeRefs` takes the max. One is cosmetic, one is not. Both need an owner decision.

After four versions the round held:

```json
[
  { "attachment_id": "d4f8983f…", "version": 1, "operation": "created", "actor": "system" },
  { "attachment_id": "d4f8983f…", "version": 2, "operation": "updated", "actor": "user" },
  { "attachment_id": "d4f8983f…", "version": 3, "operation": "updated", "actor": "user" },
  { "attachment_id": "d4f8983f…", "version": 4, "operation": "updated", "actor": "user" }
]
```

**1. Refs accumulate on every write. This one is not cosmetic.** `mergeAttachmentRefs` keys on `id:version:actor`, keeping an audit entry per touch rather than collapsing per attachment. Two separate consequences follow, and they need separating:

- **Persisted growth (the real problem).** The round's ref array grows by one entry per click, permanently, inside the conversation saved object. During an agent turn this is bounded and is a useful audit trail. Once users edit out of band it is unbounded and user-driven. A session that mutes a few dozen patterns writes a few dozen refs into a single round, and every subsequent conversation read and write carries them. This has storage and read-path cost and should be treated as a correctness issue, not a display one.
- **Duplicate chips (cosmetic).** `round_attachment_references.tsx` renders one chip per ref, so the list showed three duplicate "Spike counter" chips.

Fixing the display alone leaves the growth in place, so these want deciding independently. Collapsing inside the update route does not fix the growth either, because the merge runs against refs already stored on the round. Three places to intervene:

- de-duplicate by `attachment_id` at merge time, which fixes both but changes shared semantics the agent path also relies on
- de-duplicate at display time in `round_attachment_references.tsx`, which already has the right shape (`seenGroupIds` collapses refs sharing a `group_id`, it is simply keyed on the wrong field) but fixes only the chips
- give successive versions a shared `group_id`, which reuses the existing collapse path unchanged and again fixes only the chips

**2. Chips render against the user's prompt, under a header that says "Added". Cosmetic.** Placement is decided purely by `actor`, not by which message renders the attachment. The same `round.input.attachment_refs` array feeds two `RoundAttachmentReferences` instances: `round_input.tsx` filters `[user]`, `round_layout.tsx` filters `[agent, system]`. Setting `actor: user` therefore moves the chips beside the prompt, and the header is hardcoded to `labels.added` with no branch on operation, so `updated` refs appear under "Added".

This is a pre-existing mismatch rather than something Option B breaks. Until now `user` refs only ever came from genuine pre-send attachments, where "Added" beside the prompt is accurate. An out-of-band edit is the first thing to violate that assumption. The options are to label by operation, or to accept that `actor` doubles as a layout hint and record button-driven edits as `system` instead, which costs the attribution the actor change was meant to buy.

### Recommendation

Build Option B. It removes the `conversationId` design question, and benefits every future mutable attachment type. It fixes the agent/user divergence for the newest round, which is where the mute-a-pattern interaction happens; a card several rounds back stays pinned by design, so a user scrolled up to an old card can still read a different value than the agent does.

Two open items before it ships: the unbounded ref growth described above, which is a correctness concern rather than a cosmetic one, and the chip labelling and placement, which is cosmetic. Both need `agent_builder` team ownership, which is the only reason they were not resolved here.

## Follow-ups

1. **A round that read v2 recorded no ref.** In round 1 the agent called `attachments.read` and received v2, yet no `read@v2` ref was persisted. Either reads bypass tracking on that path or tracking is cleared before round completion. Not traced, since it is outside the spike's scope, but it matters for any ref-based fix because the transcript loses the fact that the agent saw v2.

2. **Cumulative refs are lossy on the client.** They are serialised to a `id:version|id:version` string for memoisation stability, which discards `operation` and `actor`. This does not undermine the actor fix in Option B, since the stored ref keeps its actor and `round_attachment_references.tsx` filters on it for the "Added" list. But it does mean a fix that wanted version _resolution_ to treat `updated` refs differently from `created` would have to widen that key first.

3. **Inline attachments render inside a markdown `<p>`.** Any block element in `renderInlineContent` (`EuiCodeBlock`, `EuiPanel` variants that emit `<pre>`/`<div>` at the wrong level) triggers React DOM-nesting warnings. Something to know before building a pattern table.

4. **Tools need explicit exposure.** Registering a tool puts it in the registry but does not give it to an agent. `elastic-ai-agent` had `configuration.tools: []`, so the model fell back to generic `attachments.add` and passed the payload itself. The tool had to be added to the agent's configuration before the tool-emitted path could run.
