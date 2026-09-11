# Logs Exploration PoC — work queue

> Companion files: [`poc-logs-exploration-plan.md`](./poc-logs-exploration-plan.md) (decisions and
> rejected alternatives), [`poc-logs-exploration-state.md`](./poc-logs-exploration-state.md) (what is
> built and verified). Read both before starting any item.

Every acceptance criterion in #6059 passes; the state doc has the evidence and the plan has the
decisions that got there. What is left is queued below.

## Queue

Ready items live in [`tasks/`](./tasks/), one file each, owned by the agent working it. Their status
lives in the task file and is deliberately not repeated here, so the two cannot disagree. Read
[`tasks/README.md`](./tasks/README.md) before starting one — it covers ownership, the progress-log
format and the shared Kibana/Elasticsearch instance.

| ID        | Item                                       | Where                                                                                  |
| --------- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| **LX-11** | A failed write must not start a turn       | [`tasks/lx-11-failed-write-starts-turn.md`](./tasks/lx-11-failed-write-starts-turn.md) |
| **LX-13** | "Focus the window" action on the table     | [`tasks/lx-13-focus-window-action.md`](./tasks/lx-13-focus-window-action.md)           |
| **LX-15** | Filter the pattern table by log level      | [`tasks/lx-15-log-level-filter.md`](./tasks/lx-15-log-level-filter.md)                 |
| **LX-18** | Write up the learnings and the outcome     | [`tasks/lx-18-writeup.md`](./tasks/lx-18-writeup.md)                                   |
| **LX-19** | A script for a demo video                  | [`tasks/lx-19-demo-script.md`](./tasks/lx-19-demo-script.md)                           |
| **LX-3**  | Delta writes for attachment content        | below — deferred, not this PoC                                                         |
| **LX-4**  | Paragraph hoisting in the markdown plugin  | below — deferred, not this PoC                                                         |
| **LX-5**  | Ref collapsing in the content-update route | below — deferred, Agent Builder's call                                                 |
| **LX-6**  | Revert or upstream the five local edits    | below — blocked, do not start                                                          |

LX-1 (top 8 patterns), LX-2 (both histogram series as bars), LX-8 (the journey payload model), LX-7
(compare-baseline from a row), LX-9 (per-lens global actions), LX-10 (prose that no longer restates
the view), LX-12 (read before answering), LX-14 (leaving a scoped comparison), LX-16 (window shift
and zoom) and LX-17 (tools renamed `explore_*`) are done and folded into the plan and state docs;
their task files keep the working logs.

LX-11 and LX-13 both touch the action-registration effect in `log_exploration_attachment.tsx`, which
LX-14 just enlarged — sequence them rather than running them together. LX-15 adds a control and a chip
kind to `exploration_controls.tsx`, which LX-16 rewrote into a function body with hooks; expect to
rebase onto that shape. The rules in [Rules for every item](#rules-for-every-item) apply to everything
below and are not repeated per item.

**Two items are parked, deliberately.** Both were raised by LX-7; neither is being followed up. Do
not spend time on them without the user asking.

- Reporting the Elasticsearch `must_not` behaviour upstream. Nothing has been filed; the isolation
  and the query shapes tested are in the state doc if that changes.
- The unproven duplicate-turn guard in `startTurn`. It stays as written — six lines, cannot regress
  anything, never reproduced in four attempts including with the guard disabled as a control.

---

### LX-3 — Delta writes for attachment content

**Deferred.** Beyond this PoC, but the real prerequisite for shipping mutable attachments at all.
Full-payload PUTs cannot express concurrent intent, and two renders of the same attachment clobber
each other. `{ mute: pattern }` semantics would fix it properly. Read-only-on-stale only contains the
case where a round carries a ref — LX-10 found and reproduced the case where neither does, and its
re-render-after-analysis makes two live renders routine rather than incidental. The mechanism and the
sequence are in the state doc's defect list.

---

### LX-4 — Paragraph hoisting in the markdown plugin

**Deferred.** Hoisting block nodes out of paragraphs would clear the DOM-nesting warnings for every
inline attachment renderer, not just this one. See the correction in the state doc — the warnings are
pre-existing framework behaviour, not a cost of this PoC.

---

### LX-5 — Ref collapsing in the content-update route

**Deferred, Agent Builder's call.** One ref entry is appended per button click, unbounded; six refs
observed on a single round after five mutes. Do not fix it here — it is documented for that team,
along with chip placement.

---

### LX-6 — Revert or upstream the five local edits

**Blocked. Do not start.** Upstream PRs for the `agent_builder` edits are out of scope for the PoC.
The inventory of all five files, with what each change does, is in the state doc under "Local edits to
other teams' code". This row exists so the inventory is not forgotten, not so it gets actioned.

---

## Rules for every item

Each was established by measurement. Breaking one silently regresses the PoC. Full detail in the state
doc.

- **Never call `invalidateConversation()` on content writes.** Identity and data freshness are coupled:
  the pinned version both selects the data and forms the render key, so invalidating rebuilds the
  subtree ~712 ms after every click and transiently resurrects muted rows.
- **Derive every write from local reducer state, never `props.attachment.data`.** Props stay frozen
  for the whole loop.
- **Writes are serialised** behind a single in-flight promise, and agent-turn handlers must
  `await flushPendingWrites()` before `submitMessage` — which awaits the in-flight refetch first, and
  since LX-1 also fires a waiting debounced mute refetch rather than letting the timer run out.
- **Persist the window and its data in one write.** Persisting the window before the fetch resolves
  leaves the attachment describing a range whose data belongs to the previous one.
- **A refetch must not silently lose a concurrent edit.** Requests carry a sequence number and abort
  their predecessor, and `FETCH_FAILED` rolls back the window only.
- **Superseded renders are write-disabled** (`version < versionCount`), which also means no refetch;
  agent-turn actions stay enabled. Any new interaction must respect `isReadOnly`.
- **`AttachmentHeader` returns `null`** with no action buttons, taking the title and badges with it.
- **Loop-state precedence is explicit request → user state → default** (`resolveRange`, unit tested).
- **Bound anything new in the zod schema** — `maxContentLength` is unenforced.

## Costs already accepted

Do not re-open these as part of an item.

- **Every refetch cuts an attachment version and appends a ref.** Combined with one per mute, refs
  grow quickly. Logged as an Agent Builder defect (LX-5); more interactions make it worse, not
  different.
- **A retained muted pattern carries a stale count** for the duration of the unmute round trip. It
  exists only so unmute has something to render; the refetch corrects it.
- **A mute is unwritten during its 300 ms debounce window.** The refetch carries the write, so
  `flushPendingWrites` fires a waiting one and a failed mute refetch still persists the mute.
- **Two live renders of one attachment lose writes.** Accepted for the PoC, not contained by
  read-only-on-stale, and made routine by the re-render at the end of an analysis. Mechanism and
  reproduction in the state doc; the fix is LX-3.

## Files

- Renderer: `.../public/attachment_types/log_exploration/` — `use_log_exploration_state.ts` holds the
  reducer, write queue, refetch orchestration and `flushPendingWrites`;
  `fetch_log_exploration_view.ts` picks the route for the current view.
- Query handlers: `.../server/tools/explore_log_patterns/handler.ts`,
  `.../server/tools/explore_log_volume_comparison/handler.ts`.
- Refetch routes: `.../server/routes/log_exploration/route.ts`.
- Route factory and prior art: `.../server/routes/create_observability_agent_builder_server_route.ts`,
  `.../server/routes/ai_insights/route.ts`.
- Loop-state merge: `.../server/attachments/emit_log_exploration_attachment.ts`.

All paths are relative to `x-pack/solutions/observability/plugins/observability_agent_builder/`.

## Verify in the browser, not just in code

All six bugs found so far passed type-check, lint and unit tests. The last three were only visible by
driving the running UI. See the state doc for the environment, the seed script and the checks already
performed.

## Out of scope

Production quality, visual polish, MCP App parity, persistence beyond the conversation, permissions
hardening, canvas rendering, and upstream PRs for the local `agent_builder` edits (LX-6). Do not fix
the ref accumulation or chip placement defects — they are documented for the Agent Builder team.
