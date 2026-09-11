> [!info] Metadata #github-issue #logs #ai-assistant
>
> - github-url:: https://github.com/elastic/observability-dev/issues/6064
> - effort-target::
> - effort-status:: done
>
> Vault context: parent effort [[logs-exploration-skill]], this resolves decision **1b**. Sibling issue [[issue-agent-chat-renderer-poc]] ([#6059](https://github.com/elastic/observability-dev/issues/6059)) is blocked on the answer. Background in [[mcp-app-roles-v2]].
>
> **This file has two halves.** Everything between the title and the "Working notes" divider is the issue body as posted. Everything after the divider is private. Keep the halves separate when editing.

# [Logs Exploration] Spike: attachment renderer mutation without model turn

> [!quote] Issue body, in sync with [#6064](https://github.com/elastic/observability-dev/issues/6064) as of 2026-08-21
> Posted 2026-08-21, assigned to Felix, labelled `Team:obs-signals-logs`. The body went up unchanged; only the title was shortened from the draft's question form. GitHub-flavoured markdown only from here to the divider. No wikilinks, no Obsidian-only callout types, no references to anything that exists only in the vault.

## :notebook: Summary

A timeboxed spike to answer one question: **can a click inside an attachment renderer change what that attachment displays, without triggering an agent turn?**

This blocks [observability-dev#6059](https://github.com/elastic/observability-dev/issues/6059). That PoC's premise is a human-steered log sifting loop where the primary action is muting a noisy log pattern. Muting is deterministic, so if it costs a reasoning turn then the most common interaction in the product is also its slowest. Everything else in the PoC can be scoped around, this cannot.

Code written here is **throwaway**. The deliverable is a written answer plus a cost estimate, not a mergeable feature.

**Timebox: 1 day.** If it is not answered by then, that is itself the answer and the estimate goes up accordingly.

## :mag: What is already known

Established by reading the code, so the spike does not need to rediscover it:

- **Attachments can carry state across turns.** A tool handler receives the full `AttachmentStateManager` via `ToolHandlerContext.attachments`, documented as letting tools "create, read, update, and delete attachments that persist across conversation rounds." `update` cuts a new version, records an actor, and `format()` re-reads current content each turn. **So state surviving an agent turn is not in question and is not what this spike tests.**
- **There is a public update endpoint with no caller.** `PUT /api/agent_builder/conversations/{conversation_id}/attachments/{attachment_id}`, API version `2023-10-31`, body `{ data: unknown, description?: string }`, described as "Update an attachment content. Creates a new version if content changed." Marked `stability: 'experimental'`, `since: '9.2.0'`. Its response type `UpdateAttachmentResponse` appears only in its own declaration, the route that serves it, and an OpenAPI example. Nothing in Kibana calls it.
- **The browser has no wrapper for it.** The public attachments contract exposes only `addAttachmentType` and `getAttachmentUiDefinition`. The internal `AttachmentsService` adds `hasAttachmentType`, `updateOrigin`, and `checkStale`. Renderer callbacks give `registerActionButtons`, `updateOrigin`, `closeCanvas`, `setPreviewState`, `openCanvas`, `openSidebarConversation`. None of them write content.
- **Invalidation after a write is a known rough edge.** `agent_builder_dashboards` carries a TODO that the plugin-contract `updateAttachmentOrigin` "doesn't [invalidate the conversation] atm", and deliberately captures the callback-provided `updateOrigin` because that one "keeps the rendered attachment in sync without a full refetch." That is for _origin_. For _content_ there is no sync-aware path.
- **No attachment renderer in Kibana mutates its own content.** Every one is read-mostly.

So the endpoint exists, the button mechanism exists, and the two have never been connected. The unknown is what happens to the rendered view after the write.

## :hammer: What to build

A minimal attachment type that does nothing useful except be mutable from a button.

1. **Register a throwaway type.** Add a type id such as `observability.spike_counter` to `AGENT_BUILDER_BUILTIN_ATTACHMENTS`. **Local edit only, do not open a PR against that package.** `registerType` throws if the id is absent, so this is unavoidable, and the list exists to force Agent Builder team review for real types.
2. **Server-side definition.** An `AttachmentTypeDefinition` with `id`, `validate` accepting `{ count: number, label: string }`, and `format` rendering it as text. Register it from the observability agent builder plugin's setup.
3. **Emit it from a tool.** Follow the cases pattern: the handler calls `attachments.add({ type, data, description })` and the tool result carries `attachment_ids` so the agent can reference it. Do not have the model pass the payload.
4. **Browser-side definition.** An `AttachmentUIDefinition` with `renderInlineContent` showing `count` and `label`, plus `getActionButtons` returning one button labelled "Increment".
5. **Wire the handler to the write.** The button handler calls `PUT /api/agent_builder/conversations/{conversation_id}/attachments/{attachment_id}` through `core.http` with `version: '2023-10-31'` and a body of `{ data: { count: count + 1, label } }`.
6. **Observe.** Click it. Does the inline view show the incremented count, and if so how, and how fast?

## :heavy_check_mark: Acceptance criteria

- [ ] A working throwaway attachment type that renders inline and is emitted by a tool rather than by the model passing data
- [ ] A button whose handler writes new content through the public update endpoint
- [ ] A recorded answer to: **does the inline view reflect the change without an agent turn?** One of:
  - **Yes, automatically.** The framework invalidates and re-renders. Note what triggers it.
  - **Yes, with local work.** Describe what had to be added, for example local React state mirroring the write, or a manual query invalidation modelled on the `agent_builder_dashboards` `updateOrigin` workaround.
  - **No.** Describe what blocks it and what a fix in `agent_builder` would involve.
- [ ] Whether the write is visible to the **next agent turn** as a new version, confirmed by inspecting the conversation
- [ ] Whether a `renderInlineContent` renderer can read the current version at all, or only the version present when the round was rendered
- [ ] An estimate of the plumbing cost for the real PoC, in the same shape as the three outcomes above
- [ ] A note on whether `maxContentLength` (default 10k chars, per type) is a constraint for a dense payload such as a log pattern table

## :no_entry_sign: Out of scope

- Anything logs-specific. No `get_log_groups`, no pattern table, no real query. The point is the mechanism
- Any mergeable code. The allow-list entry, the type, and the renderer are all disposable
- The renderer registry path. Already ruled out for stateful views: its payloads live in conversation workspace files whose only route is an `access: 'internal'` GET, so there is no write path at any price
- Fixing the invalidation gap in `agent_builder`. Measuring it is in scope, fixing it is a follow-up with a different owner
- Visual design. An unstyled number and a button are sufficient

## :books: Reference

Files worth reading before starting:

| What                                                           | Path                                                                                                                                                                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server-side type contract                                      | `x-pack/platform/packages/shared/agent-builder/agent-builder-server/attachments/type_definition.ts`                                                                                               |
| Browser-side UI contract                                       | `x-pack/platform/packages/shared/agent-builder/agent-builder-browser/attachments/contract.ts`                                                                                                     |
| Allow list and its gate                                        | `x-pack/platform/packages/shared/agent-builder/agent-builder-server/allow_lists.ts`, enforced in `x-pack/platform/plugins/shared/agent_builder/server/services/attachments/attachment_service.ts` |
| Update route                                                   | `x-pack/platform/plugins/shared/agent_builder/server/routes/attachments.ts`                                                                                                                       |
| Tool handler context                                           | `x-pack/platform/packages/shared/agent-builder/agent-builder-server/tools/handler.ts`                                                                                                             |
| Emit-from-tool pattern                                         | `x-pack/platform/plugins/shared/cases/server/agent_builder/attachments/emit_attachments.ts`                                                                                                       |
| Closest prior art, including the invalidation workaround       | `x-pack/platform/plugins/shared/agent_builder_dashboards/public/attachment_types/index.tsx`                                                                                                       |
| Existing observability registration                            | `x-pack/solutions/observability/plugins/observability_agent_builder/server/attachments/register_attachments.ts` and `public/attachment_types/index.ts`                                            |
| The `<render_attachment>` directive                            | `x-pack/platform/plugins/shared/agent_builder/public/application/components/conversations/conversation_rounds/round_response/markdown_plugins/render_attachment_plugin.tsx`                       |
| Browser attachments service, for what exists and what does not | `x-pack/platform/plugins/shared/agent_builder/public/services/attachments/attachements_service.tsx` (filename typo is upstream)                                                                   |

---

---

# Working notes

> [!danger] Private, not posted
> Nothing below this line belongs in the issue.

## Why a separate issue

Three reasons. It gives the blocking question its own visible artefact rather than burying it in #6059's placeholders. It is small and self-contained enough to hand to an agent or another team member without the surrounding context. And if the answer is bad, the issue is the record of why the PoC's estimate changed, which is worth having in writing given how this effort has been scoped and rescoped.

## Details deliberately left out of the body

- **The update route requires only `readAgentBuilder` privileges**, not a write privilege. Possibly deliberate, since attachments are conversation-scoped and the conversation is already the user's own, but it looks odd next to a content write. Worth raising with the `agent_builder` owners rather than in a spike issue.
- **The allow list forces a conversation with the Agent Builder team** for any real type, so the PoC has that dependency regardless of how the spike goes. Kept out of the body because it is a PoC-level concern, not a spike task. Tracked in the parent effort.
- **Graham's "grown organically around that non-standard kind of attachment-based framework with tools"** remark most plausibly refers to this system, so the consolidation risk sits on the path this spike is validating. Not a reason to avoid the spike, but it belongs in the PoC's risk section rather than here.

## If the answer is "no"

The fallback is not to abandon state, it is to make the mute a tool call. `attachments.update` from a handler keeps the versioned, actor-attributed, agent-visible state and gives up only the latency claim. The honest framing then becomes "the loop works, one interaction costs a model turn", which is a much smaller retreat than it sounds and is still a meaningfully better result than the MCP App's prose-prompt model.

Worth deciding in advance that this is acceptable, so the spike's outcome does not turn into a debate about whether the PoC is viable.

## Sequencing

The emit-from-tool work item in the parent effort overlaps with step 3 here. Doing this spike first gets that pattern established on a trivial payload before it has to work on a pattern table, so the order is: spike, then the real logs tool, then renderers.

---
