# LX-17 — Rename the tools from `get_*` to `explore_*`

**Status:** done — awaiting fold-in
**Owner:** unassigned

Read [`README.md`](./README.md) first — ownership, the progress-log format and the shared-environment
rules. The constraints under "Rules for every item" in
[`../poc-logs-exploration-next-steps.md`](../poc-logs-exploration-next-steps.md) apply here and are
not repeated.

## Goal

`observability.get_log_patterns` → `observability.explore_log_patterns`, and
`observability.get_log_volume_comparison` → `observability.explore_log_volume_comparison`. The tools
do not fetch and return; they move a view the user is steering.

## Context, verified in the source

Every occurrence, so nothing is missed:

- **Tool ids and constants** — `tools/get_log_patterns/tool.ts` (`OBSERVABILITY_GET_LOG_PATTERNS_TOOL_ID`)
  and `tools/get_log_volume_comparison/tool.ts`
  (`OBSERVABILITY_GET_LOG_VOLUME_COMPARISON_TOOL_ID`), re-exported and registered in
  `tools/register_tools.ts`.
- **The allow list** — `agent-builder-server/allow_lists.ts` lines 50–51 carry both ids verbatim.
  `register*` throws without them, so a rename that misses this file fails at startup, not at
  type-check. **This file is one of LX-6's five local edits to other teams' code**; the inventory in
  the state doc must still describe it accurately afterwards.
- **The skill body** names both tools in five places (`skill.md.text` lines 9, 12, 28, 147, 169),
  including the two instructions that tell the agent to call a tool _with no parameters_ after
  compare-baseline and after "Back to top patterns". Those flows break silently if a name goes stale
  — the agent simply will not find the tool.
- **The refetch route** imports the handlers by path:
  `routes/log_exploration/route.ts` → `../../tools/get_log_patterns/handler`.
- **Directory names.** New filenames must be `snake_case`; renaming the directories keeps the file
  names matching the tool ids, at the cost of a wider diff.

## The trap

`@kbn/ai-tools` contains an unrelated `src/tools/log_patterns/get_log_patterns.ts`
(`getSigEventsLogPatternsEsql`), which a repo-wide find-and-replace on `get_log_patterns` will
happily rewrite. Scope every replacement to the observability plugin and the allow list.

## Settle first

Ask the user and wait for the answer before writing any code.

1. **Rename the directories and constants too, or only the tool ids?** Ids alone is a small diff and
   leaves `get_log_patterns/` on disk contradicting `explore_log_patterns` in the API.
2. **Does the skill and prose copy need rewording beyond the names?** "Get" appears in prose as well
   as identifiers, and the rename is a statement about what these tools are for.

## Files to start from

Not a whitelist — change whatever the task needs. Relative to
`x-pack/solutions/observability/plugins/observability_agent_builder/` except where noted:

- `server/tools/get_log_patterns/{tool.ts,handler.ts}`
- `server/tools/get_log_volume_comparison/{tool.ts,handler.ts}`
- `server/tools/register_tools.ts`
- `server/routes/log_exploration/route.ts`
- `server/skills/logs_exploration/skill.md.text`
- `x-pack/platform/packages/shared/agent-builder/agent-builder-server/allow_lists.ts` — **other
  team's code, already a local edit**

## Done when

Both tools register under the new ids, the agent can still call them, and the two no-parameter flows
(compare-baseline, "Back to top patterns") still work end to end — those are the ones a stale name
breaks without an error. Driven in the browser, in a fresh conversation, since an existing one holds
old tool names in its transcript.

## Progress log

### 2026-09-10 — Renamed both tools to `explore_*`, ids through directories; both no-parameter flows driven

- Decided (user): rename reaches **ids, constants, factories, zod schema consts and the two
  directories** — option C of three offered. Ids-only was rejected because `get_log_patterns/` on
  disk would contradict `explore_log_patterns` in the API. The data-fetch functions
  `getLogPatterns` / `getLogVolumeComparison` in `handler.ts` keep their names: they genuinely fetch
  and return, and the refetch route calls them as plain functions, not as the tool.
- Decided (user): **names + light copy**, not names-only and not a full prose pass. Scoped to the
  annotation title and the skill's Tools bullets; the tool `description` blocks and the rest of the
  skill prose, tuned by measurement in LX-10 and LX-16, were left alone.
- Changed: `server/tools/get_log_patterns/` → `explore_log_patterns/` and
  `server/tools/get_log_volume_comparison/` → `explore_log_volume_comparison/` (`git mv`, so the
  rename is visible as a rename).
- Changed: `explore_log_patterns/tool.ts` — id `observability.explore_log_patterns`, constant
  `OBSERVABILITY_EXPLORE_LOG_PATTERNS_TOOL_ID`, factory `createExploreLogPatternsTool`, schema
  `exploreLogPatternsSchema`, annotation title `Get Log Patterns` → `Explore Log Patterns`.
- Changed: `explore_log_volume_comparison/tool.ts` — same rename set. Its annotation title was
  already `Compare Log Volume Against A Baseline` and says nothing about getting, so it is unchanged.
- Changed: `server/tools/register_tools.ts` — imports, the two entries in
  `OBSERVABILITY_LOGS_EXPLORATION_TOOL_IDS`, and both factory calls.
- Changed: `server/routes/log_exploration/route.ts` — the two handler import paths follow the
  directory rename. **This file is also listed by no other open task**, but it is PoC-core; flagging
  in case LX-13/LX-15 reach it.
- Changed: `agent-builder-server/allow_lists.ts` (other team's code, already a local edit) — both
  entries now `explore_*`. The LX-6 inventory in the state doc describes this row as "Two tool ids,
  one skill id, one attachment type id" without naming them, so it **remains accurate** and needs no
  correction.
- Changed: `server/skills/logs_exploration/skill.md.text` — all five id references, plus the two
  Tools bullets reworded from fetch-and-return framing ("returns the largest ones", "charts log
  volume") to view-steering ("opens the view on", "switches the view to").
- Verified: the `@kbn/ai-tools` decoy is untouched. A repo-wide `git grep` for
  `get_log_patterns|get_log_volume_comparison|GET_LOG_PATTERNS|GET_LOG_VOLUME_COMPARISON|createGetLog*`
  returns exactly three hits, all in `kbn-ai-tools/src/tools/log_patterns/` around
  `getSigEventsLogPatternsEsql`, which is unrelated. Every replacement was written by hand, scoped to
  the plugin and the allow list; no repo-wide find-and-replace was run.
- Verified: `node scripts/type_check --project` on both the plugin and `agent-builder-server` — exit 0. `node scripts/eslint --fix` on the five changed paths — no errors. `node scripts/jest --config
<plugin>/jest.config.js` — 21 suites, 186 tests, all passing. Per this PoC's own evidence, none of
  that is sufficient, hence the browser run below.
- Verified: `GET /api/agent_builder/tools` on the running dev server lists
  `observability.explore_log_patterns` and `observability.explore_log_volume_comparison`, and no
  `get_*` variants. Registration not throwing is itself the allow-list check passing — `register*`
  throws on an id the allow list does not carry, so a missed entry there would have removed both
  tools rather than failing type-check.
- Verified: driven in the browser, **fresh conversation**
  `853b0af1-58f0-4bbf-896e-437b81acbc03`, Claude Sonnet 4.6, both no-parameter flows. Read back from
  the conversation API through the page so it inherited the browser's auth:
  - "top log patterns … last 2 days" → `observability.explore_log_patterns
{"index":"logs-poc-default","start":"now-2d","end":"now"}`, 8-row table rendered.
  - **Compare-baseline** from the top row → `observability.explore_log_volume_comparison {}` —
    genuinely no parameters, scope carried forward. Chart rendered and described as that one
    pattern's volume, not the index's.
  - **Back to top patterns** → `observability.explore_log_patterns {}` — again no parameters. Full
    8-row unscoped table returned, and the superseded render correctly dropped to Investigate-only.
    These are the two flows a stale name breaks silently, and both resolved the tool.
- Unverified: no `get_*` id survives anywhere, but **any conversation created before this change
  holds the old ids in its transcript** — not re-driven, by design, since the task calls for a fresh
  conversation. The other flows (Investigate, Summarize top patterns, Explain this change, mute,
  window shift/zoom, the refetch route) were not re-driven; they were only exposed to the directory
  rename and the import-path change, both of which type-check, not to an id change. The seed was
  **not** reseeded — it dates from 2026-09-09 and its newest document is ~22 h old, so a `now-2d`
  window was used instead of the default `now-1h`, which is empty. Nothing else in the shared
  environment was touched and the dev server was not restarted by hand; it picked the changes up via
  watch.
- Next: none — ready for fold-in. Nothing was committed; there is no branch or commit convention
  recorded for this PoC, so the working tree is left dirty for the coordinator.
