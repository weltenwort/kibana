# Spike results: attachment renderer mutation without a model turn

Closes the investigation for observability-dev#6064. Branch `logs-exploration-poc-attachment-spike-1`, based on `eb5b384d0226`. All code is throwaway and unmerged.

## TL;DR

**Yes. A button inside an attachment renderer can change what that attachment displays, with no agent turn and no reasoning latency. But not cleanly on today's `agent_builder`: doing it properly needs a small upstream change there, and without one the renderer has to work around the framework.**

The framework pins each rendered attachment to a specific version, and the public update endpoint does not participate in that mechanism. It computes the ref that would move the pin, then throws it away. So **as the code stands today**, the only way to show current content is for the renderer to bypass the data the framework hands it and fetch the attachment itself. That works, and is demonstrated below.

This is not an invalidation bug. Invalidation already fires and the component already re-renders with fresh data, and it still draws the old version, because the pin is what holds it there. (Option B does add an explicit invalidation call, but as a deterministic trigger rather than a fix.)

This unblocks observability-dev#6059. Muting a log pattern does not require a reasoning turn.

There are two viable routes, and **the cheap one is not the one to build**. A workaround inside `observability_agent_builder` works today (~40 lines, one open design question). A proper fix in `agent_builder` is roughly the same size, removes the design question entirely, removes the need for the renderer to self-fetch at all, and is an omission rather than a new capability: an existing internal route already does the right thing. Both are priced below.

Evidence, one card, one instant, no agent turn between:

```
tool emitted — pinned count 0 (v1 of 1) — live count 3 (v4)
```

## Acceptance criteria

| #   | Criterion                                                                | Result                                                            |
| --- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 1   | Throwaway type renders inline, emitted by a tool not the model           | Done                                                              |
| 2   | Button writes new content via the public update endpoint                 | Done. 200, `new_version` increments                               |
| 3   | Does the inline view reflect the change without an agent turn?           | **Yes, with local work**                                          |
| 4   | Is the write visible to the next agent turn as a new version?            | **Yes**                                                           |
| 5   | Can `renderInlineContent` read the current version, or only the round's? | **Props are pinned; the renderer can still fetch current itself** |
| 6   | Plumbing cost estimate for the real PoC                                  | Below                                                             |
| 7   | Is `maxContentLength` a constraint for a dense payload?                  | **No, it is not enforced at all**                                 |

## What was built

| Piece                                  | Path                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| Allow-list entries (attachment + tool) | `x-pack/platform/packages/shared/agent-builder/agent-builder-server/allow_lists.ts` |
| Server attachment type                 | `.../observability_agent_builder/server/attachments/spike_counter.ts`               |
| Tool that emits it                     | `.../observability_agent_builder/server/tools/spike_counter/tool.ts`                |
| Browser UI definition                  | `.../observability_agent_builder/public/attachment_types/spike_counter.tsx`         |

`validate` accepts `{ count, label }`; `format` renders text. The tool handler builds the payload server-side and returns `attachment_ids` so the agent can reference it. The model supplies only a label.

**The allow-list edit must not be PR'd.** It is a local-only unblock, as the issue specifies.

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

- **Waiting for invalidation.** During testing `versionCount` updated 1 → 2 on its own, proving the conversation _was_ refetched and the component _did_ re-render with fresh data, and it still drew v1. This is not a caching problem.
- **Piggybacking `updateOrigin`** to force `invalidateConversation()`. Tested; still v1. It buys a re-render the code already gets for free.

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

Two routes. Option B is recommended despite being the "upstream" one, because it is no larger than the workaround and solves more.

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

| Part                                   | Scope                             |
| -------------------------------------- | --------------------------------- |
| Route swap + actor                     | ~6 lines, `routes/attachments.ts` |
| `updateContent` on the browser service | ~10 lines                         |
| Callback wiring                        | ~15 lines, 2 files                |
| Contract additions                     | 2 optional fields                 |

**Semantics to agree on.** Refs merge into the **last** round, so a card in the newest round updates in place while a card rendered several rounds ago stays pinned. That is the transcript-fidelity design working as intended, and it is right for the mute-a-pattern flow where the card is the one the agent just produced. The edge case to decide deliberately: muting from an older card that a user has scrolled back to will not visibly change that card. Accepting this initially seems reasonable; the alternatives are to also write a ref to the round containing the render tag, or to show a "newer version available" affordance.

### Recommendation

Build Option B. It is comparable in size to the workaround, removes the `conversationId` design question, fixes the agent/user divergence rather than hiding it, and benefits every future mutable attachment type. It needs `agent_builder` team ownership, which is the only reason it was not done here.

## Follow-ups

1. **A round that read v2 recorded no ref.** In round 1 the agent called `attachments.read` and received v2, yet no `read@v2` ref was persisted. Either reads bypass tracking on that path or tracking is cleared before round completion. Not traced, since it is outside the spike's scope, but it matters for any ref-based fix because the transcript loses the fact that the agent saw v2.

2. **Cumulative refs are lossy on the client.** They are serialised to a `id:version|id:version` string for memoisation stability, which discards `operation` and `actor`. This does not undermine the actor fix in Option B, since the stored ref keeps its actor and `round_attachment_references.tsx` filters on it for the "Added" list. But it does mean a fix that wanted version _resolution_ to treat `updated` refs differently from `created` would have to widen that key first.

3. **Inline attachments render inside a markdown `<p>`.** Any block element in `renderInlineContent` (`EuiCodeBlock`, `EuiPanel` variants that emit `<pre>`/`<div>` at the wrong level) triggers React DOM-nesting warnings. Something to know before building a pattern table.

4. **Tools need explicit exposure.** Registering a tool puts it in the registry but does not give it to an agent. `elastic-ai-agent` had `configuration.tools: []`, so the model fell back to generic `attachments.add` and passed the payload itself. The tool had to be added to the agent's configuration before the tool-emitted path could run.
