> [!info] Metadata #github-issue #logs #ai-assistant
>
> - github-url:: https://github.com/elastic/observability-dev/issues/6059
> - effort-target::
> - effort-status:: implementing
>
> Vault context: parent effort [[logs-exploration-skill]], spec reading [[vinays-initial-skill-proposal]], surface analysis [[mcp-app-roles-v2]], skill comparison [[differentiation-analysis]]. The seven open decisions live in [[logs-exploration-skill]]; this note holds the detail behind them.
>
> **This file has two halves.** Everything between the title and the "Working notes" divider is the issue body as posted. Everything after the divider is private and has never been posted. Keep the halves separate when editing.

# [Logs Exploration] PoC: interactive renderers for iterative log sifting in Agent Chat

> [!quote] Issue body, in sync with [#6059](https://github.com/elastic/observability-dev/issues/6059) as of 2026-08-27
> GitHub-flavoured markdown only from here to the divider. No wikilinks, no Obsidian-only callout types, no references to anything that exists only in the vault. Edit here, then push the change to GitHub.

## :notebook: Summary

Validate that Kibana's Agent Chat can host the interactive, human-steered log sifting loop described in [the draft spec](https://github.com/orgs/elastic/projects/2562/views/1?pane=issue&itemId=222966594), by building a deliberately small slice of it: two renderers and a set of sifting interactions covering both instant mutations and agent-turn actions.

The draft spec describes an epic rather than a skill. It implies custom UI renderers for two surfaces with parity between them, plus a whole new iterative approach to log analysis whose operations have not been validated as necessary or sufficient for the user journey. This issue carves out the piece that can be answered first and cheapest: does the interaction model work at all, on the surface where we already have a supported extension point?

- :link: research and prior analysis: [observability-dev#6043](https://github.com/elastic/observability-dev/issues/6043), specifically the [comparison against the existing `logs-search` skill](https://github.com/elastic/observability-dev/issues/6043#issuecomment-5295319079) and the [surface capability analysis](https://github.com/elastic/observability-dev/issues/6043#issuecomment-5320302655)
- :white_check_mark: unblocked by: [observability-dev#6064](https://github.com/elastic/observability-dev/issues/6064), which confirmed that a click inside an attachment renderer can change what it displays without triggering an agent turn; see that issue for the full outcome and the recommended implementation path

## :heavy_check_mark: Acceptance criteria

### Renderers (2)

- [ ] **Renderer A: Pattern table with per-row sparklines.** Displays `CATEGORIZE` output: pattern string, count, and a per-row trend sparkline. The tool that produces it runs ES|QL with `CATEGORIZE` and `SPARKLINE` and emits the attachment server-side so the payload never routes through the model
- [ ] **Renderer B: Baseline-overlaid histogram.** Displays log volume for the current time range overlaid against a user-defined prior epoch. Structurally different from A: a time series with a comparison overlay rather than a dense table
- [ ] Both validate their payload against a declared schema, and fail visibly rather than silently when the agent emits something that does not match
- [ ] Both are described to the agent well enough that it selects the appropriate one without the user naming it in the prompt

### Sifting interactions

#### Instant (no model turn)

- [ ] **Mute a pattern.** Per-row action on Renderer A. Removes the pattern from the view without triggering an agent turn. This is the spec's stated primary job and the central test of cheap mutation
- [ ] **Time range picker.** Available on both renderers. Shifting the window rediscovers both views without a model turn
- [ ] **Baseline epoch picker.** On Renderer B. The user selects a prior time window directly from the histogram; the comparison overlay updates instantly

#### Agent-turn actions (starts a conversation turn)

- [ ] **Investigate a pattern.** Per-row action on Renderer A, alongside Mute. Sends a prompt asking the agent to explain why that specific pattern is occurring. The agent's response must reflect the current muted patterns and time range, confirming that accumulated loop state reaches the model
- [ ] **Summarize remaining patterns.** Global action. Asks the agent to describe the un-muted patterns with their current counts. After several mutes, the agent must not mention the muted ones, proving that the attachment's muted state is visible to the model

#### Visual distinction

- [ ] Instant actions and agent-turn actions are visually distinguishable. Convention: agent-turn buttons carry a sparkle/AI icon; instant actions do not. Tooltips provide a secondary signal ("Updates immediately" vs. "Starts a new conversation turn")

### Loop state

- [ ] Muted patterns, active time range, and baseline epoch are stored in an attachment and survive the following agent turn rather than being reset by it. The attachment's `format()` output is what the agent reads on each turn; its content reflects whatever button actions the user has taken since the attachment was created

### Skill

- [ ] A minimal draft skill body that registers the new tools, adds them to the agent's `configuration.tools`, and instructs the agent: when to emit each attachment type, and how to read the loop state from the attachment before responding to Investigate or Summarize actions

### Conclusion

- [ ] A written verdict on whether this is a viable route, with the evidence behind it
- [ ] An analysis of whatever the two renderers and five interactions taught us about the _remaining_ operations in the spec

## :no_entry_sign: Out of scope

- **MCP App parity.** Split into its own PoC.
- **The full sifting operation set.** Four of the spec's six capabilities are deliberately not built here
- **Autonomous root cause.** Explicit non-goal in the spec, and it belongs to `observability.rca` / Nightshift
- **Production quality, persistence, and permissions.** Mute persistence scope, PII in surfaced field values, and non-ECS or JSON-heavy schemas are open in the spec and stay open
- **A finished skill.** This is renderer and interaction validation. Authoring a final skill body is separate work, and probably belongs in the universal skill format

---

---

# Working notes

> [!danger] Private, not posted
> Nothing below this line is on [#6059](https://github.com/elastic/observability-dev/issues/6059). This is thinking-in-progress: candidate options, code reading, and the reasoning behind the leans. Some of it is drafted for eventual posting and marked as such. Wikilinks are fine down here.

## :white_check_mark: Decisions made (2026-08-26)

**Renderers:**

- **A: Pattern table with per-row sparklines.** `CATEGORIZE` + `SPARKLINE` in ES|QL, emitted server-side by the new logs tool. Not sourced from the existing `get_log_groups` (which lacks per-group time buckets); the tool runs its own ES|QL query. Discover's pattern detection is prior art for the implementation.
- **B: Baseline-overlaid histogram.** Current log volume overlaid against a prior epoch. `get_log_change_points` is the existing data source.

**Interactions (instant, no model turn):**

- Mute per row on Renderer A
- Time range picker on both renderers
- Baseline epoch picker on Renderer B

**Interactions (agent-turn):**

- Investigate a pattern (per-row on Renderer A, alongside Mute): agent's response proves muted state and time range reach the model
- Summarize remaining patterns (global): after mutes, agent must not mention the muted ones

**UI distinction:**

- Agent-turn buttons carry a sparkle/AI icon. Instant actions do not. Tooltip as secondary signal.

**Skill:**

- A minimal draft skill body is in scope for the PoC, not a finished skill but enough to register the new tools, add them to `configuration.tools`, and instruct the agent to read loop state from the attachment before responding to Investigate or Summarize. Without this the agent either ignores the new tools or answers without the user's accumulated filter state.

**Mutation implementation:**

- Option B from [[issue-attachment-mutation-spike]]: upstream `agent_builder` change adding `updateContent` alongside `updateOrigin`. Two files in `agent_builder` proper, four total across plugin and package. Local edits only for the PoC. Not a PR. If the PoC becomes a real feature it would be re-implemented as a proper upstream contribution. Note as a dependency in any shipping estimate.
- Option A (renderer self-fetch workaround) was ruled out: `conversationId` is not available in `GetActionButtonsParams` or `InlineRenderCallbacks`, and URL parsing from `window.location.pathname` breaks in the sidebar.

## :white_check_mark: Attachment design decision (2026-08-27)

One attachment for the whole investigation, not one per renderer. The attachment carries a `type` field (`"pattern-table"` or `"histogram"`) and the renderer branches on it. Loop state (muted patterns, time range, baseline epoch) travels with the attachment across type switches so it survives when the agent switches views.

The versioning system handles this correctly. A round pinned to v1 (pattern table) reads v1's data including the `type` field and renders a pattern table. A later round pinned to v4 (histogram) renders a histogram. Transcript fidelity is preserved.

Tool logic: first call uses `attachments.add`. Subsequent calls use `getActive()` to find the existing attachment and `attachments.update` it, carrying forward the current loop state into the new payload. Without this the agent creates a new attachment on every query.

One type id on the allow list, one `getAgentDescription`, one place for the agent to read loop state. The exact state shape is left to the implementer.

## :thinking_face: Candidates considered (superseded)

Listed for context. The decisions above replaced these.

**Renderer candidates:**

| Candidate                                   | What it shows                              | Why it might be a good PoC choice                              | Existing data source                               |
| ------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------- |
| **Pattern table with per-row sparklines** ✓ | `CATEGORIZE` output: pattern, count, trend | The centre of the spec. Dense, tabular, needs inline controls  | New ES                                             | QL tool (own query, not `get_log_groups`) |
| **Baseline-overlaid histogram** ✓           | Current range against a prior epoch        | Exercises comparison; no equivalent in `logs-search`           | `get_log_change_points`                            |
| Pattern × time heatmap                      | Which patterns fire when                   | Visually the furthest from anything text can approximate       | None. Needs per-pattern time buckets               |
| Significant field values list               | First-seen or rate-shifted values          | Cheap to render, but needs `_search` rather than only `_query` | `get_log_groups` via `get_first_seen_per_group.ts` |

**Interaction candidates:**

| Candidate               | Decision                                                    |
| ----------------------- | ----------------------------------------------------------- |
| Mute a pattern ✓        | Chosen. Central test of cheap mutation                      |
| Time range picker ✓     | Chosen. Both renderers, instant                             |
| Baseline epoch picker ✓ | Chosen. Renderer B, instant                                 |
| Investigate a pattern ✓ | Chosen. Per-row agent-turn action proving state propagation |
| Summarize remaining ✓   | Chosen. Global agent-turn action                            |
| Drill into sample lines | Not chosen. Least novel                                     |

## :bulb: Implementation hints

### Rendering path: attachments

The renderer registry was the other option; it is the weaker one for a stateful loop. Attachments are the path. Verified against `agent-builder-browser/attachments/contract.ts` and `markdown_plugins/render_attachment_plugin.tsx`.

- Register server-side with `agentBuilder.attachments.registerType(def)`: `id`, `validate(input)` returning `{ valid, data }`, `format(attachment, ctx)` for what the LLM sees, plus optional `resolve(origin)`, `isStale()`, `getAgentDescription()`, `getTools()`, `isReadonly`, and `maxContentLength` (declared but never enforced anywhere; see spike AC7. Enforce bounds in the type's own `validate` if needed)
- Browser-side `AttachmentUIDefinition` supplies `renderInlineContent`, `renderCanvasContent`, `canvasWidth`, `getHeader`, `onClick`, and `getActionButtons`. `ActionButton` carries `handler: () => void | Promise<void>`, so the non-model click path is the same as the renderer registry's. Both render callbacks expose `registerActionButtons` for adding buttons from inside the renderer
- The agent emits `<render_attachment id="…"/>`. See the emit pattern below for how the payload gets there without the model retyping it
- **`AttachmentStateManager` is why this path can carry loop state.** It offers `add`, `update` (cutting a new version when content changed), soft `delete`/`restore`, `rename`, `updateOrigin`, `getDiff(id, fromVersion, toVersion)`, `getActive`, `getAccessedRefs()`, with every mutation recording an actor from `{ user, agent, system }`. `format()` re-reads current content each turn, so state written between turns is visible to the agent
- Prior art for rich rendering: security's `entity_analytics_dashboard_attachment.tsx` (~23KB), `agent_builder_workflows`' `workflow_yaml_attachment_renderer.tsx`, `agent_builder_dashboards/public/attachment_types/index.tsx`, the Streams significant events attachment (`platform.sig_event`), and `agent_builder_platform`'s `esql_attachment.tsx`. 22 files implement `renderCanvasContent` and 33 implement `getActionButtons`

**Read the dashboards attachment before building.** It is the only place in the codebase that grapples with conversation invalidation after a write (the 40 lines around its `updateOrigin` TODO). Closest template for the plumbing this PoC needs.

### The emit pattern: the tool creates the attachment, the model only passes an ID

**The wrong way, observed in a real trace on 2026-08-21.** Asking Agent Chat for a service topology costs three LLM calls, 154k input tokens, and 2.7k output tokens because the agent has to call a generic `attachments.add` tool and retype the entire 14-connection payload into params so it can then emit `<render_attachment id="…"/>`. The model can truncate, round, or drop rows, and nothing validates that the retyped data matches what the tool returned.

**The right way.** The cases plugin has this factored out in `server/agent_builder/attachments/emit_attachments.ts`:

```ts
// inside the tool handler
const added = await attachments.add({
  type: CASE_ATTACHMENT_TYPE,
  data, // the real query result, server-side
  description: `Case: ${data.title}`,
});
return added.id;
```

Then `injectAttachmentIds` puts the id into the tool result so the agent can place `<render_attachment id="…"/>` without seeing the data. One tool call does the query and the emit.

**Naming trap.** `attachments.add` is two different things: the _builtin tool the model calls_ (wrong path), and the _server-side method on the handler context_ (right path). Same name, different surfaces.

**Why this matters more here than for the service map.** A pattern table with sparklines is the densest payload in the spec. Routing it through the model would be slow, lossy, and unbounded. The PoC needs a new logs tool that emits its own attachment; renderers bolted onto the existing tools are not enough.

### Spike outcome: mutation without a model turn (2026-08-25)

Full findings in [[issue-attachment-mutation-spike]] and the [#6064 comment](https://github.com/elastic/observability-dev/issues/6064).

**Short answer:** Yes. Confirmed working. Two routes; Option B is the one to build.

**The mechanism.** Attachments are pinned per-round by refs. The public update endpoint already builds the correct ref internally but does not persist it to the round, so the framework re-renders with the stale pinned version even though `versions[]` holds the new one. This is not a caching problem. Invalidation fires, the component re-renders, and still shows the old version because the pin holds it there.

**Option B (chosen).** Two halves, both demonstrated working in the spike:

1. Server: persist the ref the route already computes. One method call change in the content-update route, modelled on `routes/internal/sml.ts`.
2. Client: add `updateContent` alongside `updateOrigin` in `AttachmentsService` and expose it on `GetActionButtonsParams`/`InlineRenderCallbacks`.

What the renderer reduces to once Option B is in place:

```ts
getActionButtons: ({ attachment, updateContent }) => [
  {
    label: 'Mute',
    handler: () => updateContent({ ...attachment.data, muted: true }),
  },
];
```

No self-fetch, no URL parsing, no sidebar breakage. Round-trip including invalidation refetch: ~950–980 ms.

For the PoC: local edits to `agent_builder` only (same approach as the allow-list edit). Not a PR.

**Two defects surfaced (need `agent_builder` owner decision, not PoC's to fix):**

- **Ref accumulation (correctness, not cosmetic):** every button click appends a ref entry to the round's stored array permanently. Unbounded for out-of-band edits. Needs collapsing in the update route or merge logic
- **Chip placement (cosmetic):** `actor: user` moves chips beside the user's prompt under a hardcoded "Added" label. Wrong placement and label for button-driven edits

### Gotchas from the spike

- **Tools need explicit exposure.** Registering a tool does not add it to an agent's tool set. It must appear in `configuration.tools` explicitly, or the agent falls back to generic `attachments.add` and retypes the payload. This is what happened in the spike before the tool was added to the agent config
- **Block elements in `renderInlineContent` cause DOM warnings.** `EuiCodeBlock`, `EuiPanel` variants, and any `<pre>`/`<div>` inside `renderInlineContent` trigger React DOM-nesting warnings because inline renders live inside a markdown `<p>`. Design the pattern table renderer to avoid block-level elements at the top level, or put the detailed view in `renderCanvasContent`
- **Read-modify-write, not read-from-props-then-write.** Computing a new value from `props.attachment.data` and writing it means always writing the same value because props reflect the pinned version, not the latest. The handler must read the current attachment version and derive the new value from that

### The allow list is a hard gate

`registerType` throws if the attachment type id is not in `AGENT_BUILDER_BUILTIN_ATTACHMENTS` in `@kbn/agent-builder-server`. For the PoC: local edit only, same as the spike. Not a PR. `observability.service-map` is already on the list, so this team has been through the process once.

`getAgentDescription` is injected into an `ATTACHMENT TYPES` prompt block and should describe the user-visible outcome, not when to render.

### One risk carried either way

Graham's remark about Agent Builder having "grown organically around that non-standard kind of attachment-based framework with tools" most plausibly refers to this system. The consolidation risk sits on the stronger option. Confirm with the `agent_builder` owners; the allow list forces that conversation anyway.

### Constraints that apply either way

- Most of the spec's analytics work runs in pure ES|QL via `POST /_query`, including `CATEGORIZE`, `CHANGE_POINT`, `SPARKLINE`, and `VARIANCE`/`STD_DEV`. `significant_terms` and `significant_text` have no ES|QL equivalent. Picking renderers that only need `_query` keeps the PoC simpler
- Keep the **view model schema** and the **action vocabulary** surface-neutral even though only one surface is being built. The cheap hedge that keeps the second surface possible later, at no cost now

## :pencil: Drafted for posting, not posted yet

### On where these requirements come from

The requirements here are inferred from the draft spec plus the 2026-08-19 agreement rather than supplied. I have written them down so there is something concrete to disagree with, which is faster than another round of clarifying questions. Corrections welcome.

---
