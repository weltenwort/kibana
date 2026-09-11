# Comment 3 of 3 — Verdict, value, and the surrounding work

> **Status: rough structure.** Section headings, intent, and what is still missing. Prose not written
> yet.
>
> **Audience for this comment:** whoever decides whether this gets built. It has to be readable
> without comment 2, so it restates conclusions rather than mechanisms and links back for the
> evidence.
>
> **This is the comment with a real gap in it.** Section 4 needs input from you: I can list the
> efforts the PoC docs mention, but I cannot tell which are live, who owns them now, or what has
> changed. See the checklist at the bottom.

---

## 1. Is it technically feasible

Lead with the answer. Every acceptance criterion passes, driven against a running instance rather
than reasoned from code. Keep the AC table here, since this is the comment that closes the issue's
own conclusion criterion.

Then the qualifier, in one paragraph: it works, and it works by using a versioned content blob as
three things at once, which is the renderer's persisted state, the model's per-round view of that
state, and the transcript entry. It holds. It strains at every point where those three jobs
disagree.

## 2. What stands between this and shipping

Three items, ranked, each one sentence plus a pointer into comment 2.

1. **Delta writes.** Full-payload PUTs cannot express concurrent intent, two live renders of one
   attachment were observed losing writes, and write-disabled-on-stale does not contain the case
   where neither round carries a ref. This is the blocker, and it is an API design question rather
   than a patch.
2. **Five local edits to other teams' code.** Reverted or upstreamed before anything ships. Two are
   plausible upstream contributions close to as written, one is the allow list working as designed,
   and one is expedient and needs the owning team to decide the right shape.
3. **The defects left deliberately unfixed.** Ref accumulation, chip placement, silent `null` on a
   missing version, and no tooltip channel on header actions.

## 3. Is a mutable attachment the right primitive

The conclusion, stated as a judgement rather than a measurement, because that is what it is.

Content from the source draft's "The open question" section, reframed: this can probably be made to
work inside the framework as it exists, it will not be elegant and it will not be robust, and the
framework has no supported way to host an interactive visualisation that a user drives and a model
reads.

Then the part that makes this useful rather than critical: **what we would want the framework to
offer.** Frame explicitly as input from a downstream consuming team, and say that Agent Builder is
being actively evolved, so this is a moment to say what we need rather than a complaint about what
exists. Candidate list, to be pruned when writing:

- Delta or patch semantics for attachment content, so concurrent intent is expressible.
- A re-render with fresh data that does not also change the render identity. Today one version both
  selects the data and forms the render key, so there is no way to ask for one without the other.
- A state store for an interactive view that is not also the transcript record, or sibling access
  between attachments so it can be split by hand. Neither exists: render props carry only the
  attachment being rendered, with no sibling access and no conversation id.
- A per-round channel to the model that does not depend on the round happening to carry a ref, so
  that "change the view, then ask a question" is not the one case that arrives with no context.
- A mounted render being able to discover it has been superseded.
- Enforcement of `maxContentLength`, or its removal.

## 4. The surrounding work

**Needs your input.** I can only name what the PoC docs mention, and I have no way to check what is
current. Candidates below, each with what I know and what I do not. Tell me which to keep, which to
drop, and what is missing.

| Effort                             | What the docs say                                                                                                                                 | What I do not know                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| #6064, the mutation spike          | Done. Answered the blocking question and chose the implementation path this PoC took. Already flagged two of the defects this PoC then hit        | Nothing. This one is safe to reference as history                                   |
| #6043, research and prior analysis | Comparison against the existing `logs-search` skill, and the surface capability analysis                                                          | Whether its conclusions still hold, and whether it is the right thing to link to    |
| The MCP App parity PoC             | Split out of this issue as its own PoC                                                                                                            | Whether it started, who owns it, and what it has found                              |
| `observability.rca` / Nightshift   | Named as the owner of autonomous root cause, an explicit non-goal here                                                                            | Its current state, and whether this journey overlaps or complements it              |
| The draft spec epic                | The source of the six capabilities, four of which were not built here                                                                             | Its current status, and whether the capability list has changed                     |
| Agent Builder's own evolution      | Recorded as a risk: the attachment-based framework is described as having grown organically, and consolidation may land on the path this PoC uses | What is actually planned, and on what timeline. This materially changes the verdict |
| The universal skill format         | Named as where a finished skill body probably belongs                                                                                             | Everything                                                                          |

The point of the section is not a link dump. It is to answer one question: **does anything in flight
change the recommendation?** Agent Builder's own direction is the one that plausibly does, so if you
know what is planned there, that is the thing to tell me.

## 5. Was the journey worth having

The reflection you asked for, kept honest about what the PoC can and cannot support.

**What the evidence does support:**

- Narrowing the view costs no model turn. That was the premise worth spiking, and it held. If muting
  is the most common action in the product, the most common action is also the cheapest one.
- The agent answers about the view the user shaped, not the one it rendered three turns ago. This
  works, with a caveat in the next list.
- Interpretation beats enumeration. The global action started as "Summarize remaining patterns",
  meaning list them with counts, and was better as an interpretation of the current cut. The
  acceptance criterion was re-read and re-driven rather than assumed.
- Extending the journey turned out to be cheap in the places the payload model anticipated. A new way
  to narrow the data is one case and a control.

**What the evidence does not support, and should be said plainly:**

- No user has driven this except us. Everything about whether the journey is the right one is
  untested.
- Whether muting is genuinely the primary job is an assumption inherited from the spec, not something
  this PoC checked.
- Model behaviour is one connector, one seed, and a handful of drives per finding. The strongest
  mitigation measurement is 0 stale answers in 7 rounds against a roughly 20% baseline rate, which
  happens by chance about 1 time in 5.
- Two behavioural defects are open. Muted patterns are still named in conversational asides even
  though `format()` forbids it, and the agent sometimes answers from stale transcript text rather
  than re-reading.

Decide when writing whether this section sits before or after the feasibility verdict. Value first
is the more honest order if the recommendation turns on it, and feasibility first matches the
issue's own acceptance criteria.

## 6. Recommendation

**Not drafted, because it depends on section 4.** The shape of it is one of:

- Build it, once delta writes exist and the five edits are upstreamed.
- Build it, and accept the concurrency defect for an internal or gated release.
- Hold, because Agent Builder's own direction is about to change the ground.
- Take the journey somewhere other than the conversation transcript.

I can draft any of these once you tell me what is in flight.

---

## What I need from you for this comment

1. Which of the efforts in section 4 to keep, and anything missing. Agent Builder's roadmap matters
   most.
2. Whether the recommendation in section 6 is yours to make in this comment or belongs elsewhere.
3. Whether the honest "no user has driven this" framing in section 5 is what you want in a public
   comment, or whether that conversation happens separately.
