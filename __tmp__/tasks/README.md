# Task files — how to work one and report back

One file per ready task. Read this before touching anything.

Required reading for any task: [`../poc-logs-exploration-next-steps.md`](../poc-logs-exploration-next-steps.md)
(the queue, and the rules that apply to every item), [`../poc-logs-exploration-plan.md`](../poc-logs-exploration-plan.md)
(decisions and rejected alternatives — do not re-litigate them), and
[`../poc-logs-exploration-state.md`](../poc-logs-exploration-state.md) (what is built, what was
measured, how to run it).

## Who owns what

| Thing                                             | Owner                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| `poc-logs-exploration-{plan,state,next-steps}.md` | the coordinator — **agents never edit these**                              |
| `tasks/lx-N-*.md`                                 | the one agent working LX-N                                                 |
| Another agent's task file                         | nobody but that agent — do not edit, do not read into your own log as fact |
| Product code                                      | shared — log what you change                                               |

The **Files** section in a task is a starting point, not a whitelist. Change whatever the task
actually needs. Two live tasks editing one source file is the only real hazard: if you touch a file
another open task also lists, say so in your progress log so the coordinator can spot the overlap.

## Status

The **Status** line at the top of your task file is the single source of truth. The queue table in
next-steps deliberately does not repeat it, so the two cannot disagree.

`ready` → `in progress` → `done — awaiting fold-in`, or `blocked` at any point. Set it when the state
actually changes, not in advance.

When you reach `done — awaiting fold-in`, stop editing anything. The coordinator folds the outcome
into the state and plan docs and removes the item from the queue.

## Progress log

Append to the bottom of your own task file. Newest entry last. One entry per working session, or per
material finding.

```
### <YYYY-MM-DD> — <one-line summary>

- Changed: <file, and what changed — one line each>
- Verified: <how. The command you ran, or what you drove in the browser and what you observed>
- Unverified: <anything that passed static checks but was not exercised against a running instance>
- Decided: <choice and why, if you settled an open question>
- Next: <the immediate next action, or "none — ready for fold-in">
```

Rules for entries:

- **Append, never rewrite.** A correction is a new entry that names the claim it replaces. The
  history of what was believed and when is the point.
- **Never record a measurement you did not observe.** Label estimates as estimates. Three of the six
  bugs in this PoC passed type-check, lint and unit tests and were only found in the browser, so
  "verified" means you drove it, not that it compiled.
- **Say when something is unverified.** An empty `Unverified:` line is a claim in itself.
- **Leave `Next:` accurate before you stop**, including mid-task. Someone else may pick this up.

## Settle-first questions

Each task has a **Settle first** section. **Ask the user and wait for an answer.** Do not assume, do
not pick the reversible option and carry on, do not defer the question until after the
implementation — the answer changes what you build, not just how.

Ask before you write code. Put the options and their consequences in the question, in one message, so
it can be answered in one. Then record the answer in your progress log under `Decided:`, attributed
to the user, so the coordinator can fold it into the plan as a decision.

If the user is unavailable, stop at `blocked` and say what you are waiting on. A blocked task with a
clear question is worth more than a finished task built on a guess.

## The shared environment

Everyone works against one Kibana (`localhost:5601`) and one Elasticsearch (`localhost:9200`,
`elastic:changeme`). This is where concurrent agents actually collide.

- **Reseeding is destructive to other people's measurements.** `node __tmp__/seed_logs_poc.js`
  rewrites the `logs-poc-default` data stream; counts and category ranks change underneath anyone
  mid-run. Do not reseed unless your task needs it. If you must, log a line before and after.
- **Do not restart the Kibana dev server** without logging it. A restart mid-measurement looks like a
  bug to whoever is measuring.
- **Start your own conversation.** Attachment versions and muted patterns are per-conversation; a
  second driver's mutes in a shared conversation will read as your defect.
- **One branch, `logs-exploration-poc`. Do not commit.** The user commits, task by task, after
  reviewing the working tree. Leave your changes uncommitted and say so in your log.

## Checks

`node scripts/type_check --project <plugin>/tsconfig.json`, `node scripts/eslint --fix`,
`node scripts/jest --config <plugin>/jest.config.js`. Passing all three is necessary and, on this
PoC's evidence, not sufficient.
