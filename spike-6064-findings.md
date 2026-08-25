# Spike results: attachment renderer mutation without a model turn

Closes the investigation for observability-dev#6064. Branch `logs-exploration-poc-attachment-spike-1`, based on `eb5b384d0226`. All code is throwaway and unmerged.

## TL;DR

**Yes, an attachment renderer can mutate its own content and reflect the change without an agent turn — but only if the renderer ignores the attachment data the framework hands it and fetches current content itself.**

The framework deliberately pins each rendered attachment to a specific version, and the public update endpoint does not participate in that mechanism. There is no invalidation bug to fix; invalidation already works. The pinning is by design and a client-side write can never move it.

This unblocks observability-dev#6059. Muting a log pattern does not require a reasoning turn. The cost is contained and lives entirely in `observability_agent_builder`, with one genuine design question (below).

Evidence — one card, one instant, no agent turn between:

```
tool emitted — pinned count 0 (v1 of 1) — live count 3 (v4)
```

## Acceptance criteria

| #   | Criterion                                                                | Result                                                            |
| --- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 1   | Throwaway type renders inline, emitted by a tool not the model           | Done                                                              |
| 2   | Button writes new content via the public update endpoint                 | Done — 200, `new_version` increments                              |
| 3   | Does the inline view reflect the change without an agent turn?           | **Yes, with local work**                                          |
| 4   | Is the write visible to the next agent turn as a new version?            | **Yes**                                                           |
| 5   | Can `renderInlineContent` read the current version, or only the round's? | **Props are pinned; the renderer can still fetch current itself** |
| 6   | Plumbing cost estimate for the real PoC                                  | Below                                                             |
| 7   | Is `maxContentLength` a constraint for a dense payload?                  | **No — it is not enforced at all**                                |

## What was built

| Piece                                  | Path                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| Allow-list entries (attachment + tool) | `x-pack/platform/packages/shared/agent-builder/agent-builder-server/allow_lists.ts` |
| Server attachment type                 | `.../observability_agent_builder/server/attachments/spike_counter.ts`               |
| Tool that emits it                     | `.../observability_agent_builder/server/tools/spike_counter/tool.ts`                |
| Browser UI definition                  | `.../observability_agent_builder/public/attachment_types/spike_counter.tsx`         |

`validate` accepts `{ count, label }`; `format` renders text. The tool handler builds the payload server-side and returns `attachment_ids` so the agent can reference it — the model supplies only a label.

**The allow-list edit must not be PR'd.** It is a local-only unblock, as the issue specifies.

## AC3 / AC5 — the mechanism, in detail

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

This exists for transcript fidelity. If round 0 says _"I found 3 errors"_ and the attachment is later edited to 7, round 0 must still render 3, or the prose contradicts the card beneath it. That is correct and worth preserving.

At render time the browser derives a **cumulative** ref per round — `computeCumulativeRefs` in `round_layout.tsx` scans rounds `0..i` and keeps the highest version seen per attachment. `resolveAttachmentVersion` in `render_attachment_plugin.tsx` then picks, in order:

1. an explicit `version="…"` on the `<render_attachment>` tag
2. **the cumulative ref version**
3. the latest version

Rule 2 fires whenever any ref exists and permanently shadows rule 3.

### Why the update endpoint cannot move the pin

Only the agent-turn pipeline writes refs. The state manager records every touch via `recordAccess`, and `add_round_complete_event.ts` drains it with `getAccessedRefs()` onto the round.

The `PUT /conversations/{id}/attachments/{id}` route builds its own state manager and calls `update()`, which **does** call `recordAccess(id, v2, 'updated')` — a correct `updated@v2` ref is constructed in memory. The route then persists only `attachments: stateManager.getAll()` and never calls `getAccessedRefs()`. The ref is computed and thrown away. Nothing is written to `rounds`.

Observed in a real conversation:

| Round | Stored refs                                   | Cumulative max | Rendered    |
| ----- | --------------------------------------------- | -------------- | ----------- |
| 0     | `[screen-context v1, spike v1 created/agent]` | v1             | v1, count 0 |
| 1     | _no key at all_                               | v1             | v1, count 0 |

…while `versions[]` held v1 through v4.

### Two things this rules out

- **Waiting for invalidation.** During testing `versionCount` updated 1 → 2 on its own, proving the conversation _was_ refetched and the component _did_ re-render with fresh data — and still drew v1. This is not a caching problem.
- **Piggybacking `updateOrigin`** to force `invalidateConversation()`. Tested; still v1. It buys a re-render the code already gets for free.

### What does work

The renderer fetches the conversation itself and reads `versions.at(-1)`, ignoring `props.attachment.data`. Three clicks advanced v2 → v3 → v4 with the card tracking live, no agent turn. PUT roundtrip ranged **~100–620 ms**.

One non-obvious requirement: **the mutate handler must read-modify-write against current content.** Computing `count + 1` from the pinned props means always writing `1`, so repeated clicks never advance past v2. Pinned props are unsafe as an input to a write.

## AC4 — visibility to the next agent turn

Confirmed by inspection. After the write, the agent called `attachments.read` and received:

```json
{ "attachment_id": "bcf02562-…", "version": 2, "data": { "count": 1, "label": "mutation test" } }
```

It answered _"the current count is 1"_ — correct — while the card directly beneath it displayed `count 0`.

**This is the real risk in the current behaviour.** It is not staleness; it is the agent and the user seeing different values simultaneously. Any feature built on mutable attachments without addressing this will produce contradictions in the transcript.

## AC7 — `maxContentLength`

`AttachmentTypeDefinition.maxContentLength` is declared (`type_definition.ts:81`) and **never read anywhere in the codebase**. `DEFAULT_MAX_CONTENT_LENGTH` does not exist as a constant — it appears only in a doc comment. Every other `maxContentLength` in `agent_builder` is the unrelated LLM HTTP response limit.

So 10k does not constrain a dense pattern table today. But the option is unimplemented API surface, so do not rely on it either — if a bound is wanted, it has to be enforced in the type's own `validate`.

## AC6 — cost estimate

**Shape: "Yes, with local work."** Contained, and entirely inside `observability_agent_builder`.

**Required**

- Self-fetch hook in the renderer — ~40 lines, working today
- Read-modify-write in the mutate handler — not optional, per above
- A way to obtain `conversationId` — **the one genuine design question.** `AttachmentRenderProps` and `GetActionButtonsParams` do not carry it. The spike parses it from `window.location.pathname`, which works in the full app and **breaks in the sidebar**, where the id lives only in React context. If the PoC needs the sidebar, this needs either a context hook or a small contract change upstream.

**Costs accepted**

- One extra conversation GET per render and per write
- Renderers diverging from the transcript-fidelity model the framework intends
- Each mutating renderer re-implementing this independently

**Explicitly not required for the PoC**

The clean fix is server-side: have the update route merge a ref into the last round via `AddAttachmentsToLastRoundRequest` (`conversation/client/types.ts:106`), which already exists for exactly this purpose — its own doc comment describes merging into "the last stored round's `input.attachment_refs`" with semantics that survive concurrent round or attachment writes. That removes the self-fetch, the double round-trip, and the agent/user divergence in one change. Different owner, follow-up — priced here, not built.

## Loose ends worth a follow-up

1. **A round that read v2 recorded no ref.** In round 1 the agent called `attachments.read` and received v2, yet no `read@v2` ref was persisted. Either reads bypass tracking on that path or tracking is cleared before round completion. Not traced — outside the spike's scope, but it matters for any ref-based fix, since the transcript loses the fact that the agent saw v2.

2. **Cumulative refs are lossy.** They are serialised to a `id:version|id:version` string for memoisation stability, which discards `operation` and `actor`. A fix that wanted to treat `updated` refs differently from `created` would have to widen that key first.

3. **Inline attachments render inside a markdown `<p>`.** Any block element in `renderInlineContent` (`EuiCodeBlock`, `EuiPanel` variants that emit `<pre>`/`<div>` at the wrong level) triggers React DOM-nesting warnings. Worth knowing before building a pattern table.

4. **Tools need explicit exposure.** Registering a tool puts it in the registry but does not give it to an agent. `elastic-ai-agent` had `configuration.tools: []`, so the model fell back to generic `attachments.add` and passed the payload itself. The tool had to be added to the agent's configuration before the tool-emitted path could run.
