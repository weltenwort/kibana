# LX-19 — A script for a demo video

**Status:** ready
**Owner:** unassigned

Read [`README.md`](./README.md) first — ownership, the progress-log format and the shared-environment
rules.

## Goal

A recordable script: what to set up, what to say, what to click, in an order that survives a live
take. The PoC's point is the loop — the user steering, the agent participating, state surviving both.

## Set-up the script must specify

All of this is in the state doc's "Running it"; the traps are what matter here.

- **Reseed first.** `node __tmp__/seed_logs_poc.js`. The seed is anchored to the moment it runs and
  ages out of recent windows — an empty chart mid-recording almost always means stale data, not a
  bug. LX-17's session hit exactly this and had to widen to `now-2d`.
- Kibana `http://localhost:5601` (5602 reaches the same instance through port forwarding).
- **A fresh conversation.** Old ones carry pre-LX-8 payloads and show the invalid-payload callout.
- The seed carries a deliberate burst, added in LX-9, so "Explain this change" has something to
  explain. Pick a window that contains it.

## The loop worth showing, in the order it holds together

Each step below is something that has been driven and measured; the state doc has the numbers.

1. Ask for log patterns. Eight rows, sparklines, the top-N framing in the agent's own sentence.
2. **Mute a noisy pattern** — the row goes in ~100 ms with no subtree remount, and the cut backfills
   from below on the debounced refetch. This is the headline: instant, no model turn.
3. **Shift or zoom the window.** Counts and ranking change; the baseline stays aligned.
4. **Compare a single pattern against a baseline** from its row — one agent turn, the scope carried
   through loop state rather than through the message text.
5. **Back to top patterns** from the header, which drops the scope and returns to the table.
6. **Summarize top patterns** — interpretation, not a read-back, ending in a live table whose mute
   buttons work.
7. Reload the page to show the state survived, or scroll back to show an earlier round still
   rendering its own version of the view.

## Traps to script around, or to show deliberately

- **Two live renders of one attachment lose writes.** After the analysis re-renders the view, the
  older render is still writable and muting in it can clobber. Reproducible. Either avoid going back
  to an earlier render on camera, or show it as the honest known defect it is.
- **A mute supersedes the render it was made in** when that render is not in the last round, so the
  buttons vanish and a second mute needs a fresh render first. This shapes any mute sequence.
- **Muted patterns are sometimes named in asides** — accepted for the PoC, so don't build a beat
  around the agent never mentioning them.
- Model output varies between takes. Anything phrased as "watch it say X" is a hostage; phrase beats
  as what the _view_ does.

## Settle first

Ask the user and wait for the answer before writing.

1. **Length and format** — a two-minute walkthrough, or a longer one with the framework findings?
2. **Narrated or captioned**, and whether you want spoken lines written out or just beats.
3. **Show a defect on purpose?** The clobber and the ref accumulation are honest, and an internal
   audience may value them; an external one will not.

## Done when

Someone who has not worked on this can follow it end to end against a fresh seed and get the same
result. Dry-run it in the browser before calling it done — every step in it has been driven before,
but never in one continuous sequence.

## Progress log

_No entries yet._
