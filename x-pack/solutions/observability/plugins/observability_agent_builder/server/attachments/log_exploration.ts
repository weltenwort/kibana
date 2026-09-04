/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import dedent from 'dedent';
import type { AttachmentTypeDefinition } from '@kbn/agent-builder-server/attachments';
import type {
  LogExplorationData,
  LogExplorationRefinement,
  LogExplorationResult,
} from '../../common/log_exploration';
import {
  excludedPatterns,
  logExplorationDataSchema,
  MAX_PATTERNS,
} from '../../common/log_exploration';
import { OBSERVABILITY_LOG_EXPLORATION_ATTACHMENT_TYPE_ID } from '../../common';

const formatPatternTable = (
  result: Extract<LogExplorationResult, { type: 'pattern-table' }>,
  excluded: string[]
): string => {
  const isExcluded = new Set(excluded);
  const remaining = result.patterns.filter((p) => !isExcluded.has(p.pattern));

  const rows = remaining.length
    ? remaining.map((p) => `- ${p.pattern} (count: ${p.count})`).join('\n')
    : '(none remaining — every pattern in the current cut has been muted)';

  return (
    dedent(`
    View: log pattern table
    This is the TOP ${MAX_PATTERNS} patterns by document count, not every pattern in the logs. The
    query is a top-N cut, so more patterns almost certainly exist below it. Never say or imply that
    the logs contain only these, and never total these counts and present the result as the total
    document count. Muting a pattern promotes the next largest one into the cut.
    The ${remaining.length} patterns below are the ONLY ones you may discuss. Use that number as the
    count of un-muted patterns rather than counting or subtracting yourself:
  `) + `\n${rows}`
  );
};

const total = (values: number[]): number => values.reduce((sum, value) => sum + value, 0);

const signed = (value: number): string => (value > 0 ? `+${value}` : `${value}`);

/** Index of the largest value, or -1 for an empty series. */
const peakIndex = (values: number[]): number =>
  values.reduce((best, value, index) => (best === -1 || value > values[best] ? index : best), -1);

/** Index of the biggest current-vs-baseline swing, by absolute size. The series are index-aligned. */
const movedMostIndex = (current: number[], baseline: number[]): number => {
  const length = Math.max(current.length, baseline.length);
  return Array.from({ length }, (_, index) => index).reduce(
    (best, index) =>
      best === -1 ||
      Math.abs((current[index] ?? 0) - (baseline[index] ?? 0)) >
        Math.abs((current[best] ?? 0) - (baseline[best] ?? 0))
        ? index
        : best,
    -1
  );
};

const bucketTime = (startMs: number, intervalMs: number, index: number): string =>
  new Date(startMs + index * intervalMs).toISOString();

/**
 * The model never receives the series, only these summary points, so the chart's shape has to be
 * stated for it — otherwise the only honest answer it can give about a volume change is the two
 * totals, which the user is already looking at.
 */
const formatHistogramShape = (
  result: Extract<LogExplorationResult, { type: 'volume-comparison' }>
): string => {
  const { current, baseline, intervalMs, startMs, baselineStartMs } = result.histogram;
  const currentPeak = peakIndex(current);
  const baselinePeak = peakIndex(baseline);
  const moved = movedMostIndex(current, baseline);

  const lines: string[] = [];

  if (currentPeak !== -1) {
    lines.push(
      `Busiest bucket in the current range: ${bucketTime(startMs, intervalMs, currentPeak)} (${
        current[currentPeak]
      } documents)`
    );
  }
  if (baselinePeak !== -1) {
    lines.push(
      `Busiest bucket in the baseline epoch: ${bucketTime(
        baselineStartMs,
        intervalMs,
        baselinePeak
      )} (${baseline[baselinePeak]} documents)`
    );
  }
  if (moved !== -1) {
    lines.push(
      `Bucket that moved most against the baseline: ${bucketTime(startMs, intervalMs, moved)}, ` +
        `${current[moved] ?? 0} now against ${baseline[moved] ?? 0} at the same offset in the ` +
        `baseline (${signed((current[moved] ?? 0) - (baseline[moved] ?? 0))})`
    );
  }

  return lines.join('\n');
};

const formatHistogram = (
  result: Extract<LogExplorationResult, { type: 'volume-comparison' }>
): string => {
  const { current, baseline, intervalMs } = result.histogram;
  const currentTotal = total(current);
  const baselineTotal = total(baseline);
  const change = currentTotal - baselineTotal;
  const percent =
    baselineTotal === 0
      ? '(no baseline documents to compare against)'
      : `${signed(Math.round((change / baselineTotal) * 1000) / 10)}%`;

  return (
    dedent(`
    View: log volume histogram, current range overlaid on the baseline epoch
    Bucket interval: ${intervalMs}ms across ${current.length} buckets
    Total documents in current range: ${currentTotal}
    Total documents in baseline epoch: ${baselineTotal}
    Change against the baseline: ${signed(change)} documents, ${percent}
  `) +
    `\n${formatHistogramShape(result)}\n` +
    dedent(`
    These points are computed from the full bucket series and are enough to describe the change.
    Do not assert a trend, a spike or a shape beyond what they state.
  `)
  );
};

const formatView = (data: LogExplorationData): string => {
  // The lens and its cache are written together, so they only disagree if a payload was hand-edited.
  if (data.view.type === 'pattern-table' && data.result.type === 'pattern-table') {
    return formatPatternTable(data.result, excludedPatterns(data.refinements));
  }
  if (data.view.type === 'volume-comparison' && data.result.type === 'volume-comparison') {
    return formatHistogram(data.result);
  }
  return `View: ${data.view.type} (no data)`;
};

/**
 * Refinements are stored uniformly but described one kind at a time. The exclusion wording in
 * particular is what stops the model reaching for a muted pattern when asked to summarize, so it
 * stays a hand-written sentence rather than a generic list of narrowings.
 */
const formatRefinements = (refinements: LogExplorationRefinement[]): string => {
  const excluded = excludedPatterns(refinements);
  const sections = [
    `MUTED PATTERNS (${excluded.length}) — the user dismissed these as noise. Never name them in an\n` +
      `answer, never include them in a summary, count or comparison, and never investigate them. You\n` +
      `may say how many are muted. They are listed here only so you can recognise and avoid them:\n` +
      (excluded.length ? excluded.map((pattern) => `- ${pattern}`).join('\n') : '(none)'),
  ];

  for (const refinement of refinements) {
    if (refinement.kind === 'only-pattern') {
      sections.push(
        `SCOPED TO ONE PATTERN — every number below counts only logs matching "${refinement.pattern}". Say so when you describe them.`
      );
    }
    if (refinement.kind === 'kql') {
      sections.push(`KQL filter applied to every view here: ${refinement.query}`);
    }
  }

  return sections.join('\n\n');
};

export function createLogExplorationAttachmentType(): AttachmentTypeDefinition<
  typeof OBSERVABILITY_LOG_EXPLORATION_ATTACHMENT_TYPE_ID,
  LogExplorationData
> {
  return {
    id: OBSERVABILITY_LOG_EXPLORATION_ATTACHMENT_TYPE_ID,
    // `attachment_read` is the only path that puts content in the model's context, and it returns
    // the raw payload unless the type is readonly — in which case it returns `format()` below.
    // Without this the muted-pattern and top-N framing never reach the model at all. The framework
    // enforces `readonly` only in the agent's own add/update tools, not in the state manager or the
    // content route, so the tool emit and the user's writes are unaffected.
    isReadonly: true,
    validate: (input) => {
      const parsed = logExplorationDataSchema.safeParse(input);
      if (parsed.success) {
        return { valid: true, data: parsed.data };
      }
      return { valid: false, error: parsed.error.message };
    },
    // Re-read on every round, so refinements the user made between turns are visible to the model here.
    format: (attachment) => {
      const { data } = attachment;

      return {
        getRepresentation: () => ({
          type: 'text',
          value: dedent(`
            Interactive log exploration view. The user steers this view directly; the state below is
            their current filter state and overrides anything you established in earlier turns.

            Index: ${data.source.index}
            Message field: ${data.source.messageField}
            Active time range: ${data.source.timeRange.start} to ${data.source.timeRange.end}
            Baseline epoch: ${
              data.view.type === 'volume-comparison'
                ? `${data.view.baselineEpoch.start} to ${data.view.baselineEpoch.end}`
                : '(not set)'
            }

            ${formatRefinements(data.refinements)}

            ${formatView(data)}
          `),
        }),
      };
    },
    getAgentDescription: () =>
      dedent(`
        An interactive log exploration view rendered in the conversation. It shows either a table of
        the top log patterns by document count, each with a trend sparkline, or log volume for the
        current time range overlaid on a user-chosen baseline epoch.

        The pattern table is a top-N cut, never the full set of patterns in the logs, so treat its
        rows as "the largest patterns" rather than "the patterns that exist".

        The user mutes noisy patterns, changes the time range and picks the baseline epoch directly
        in the view, without asking you. Every filter listed in the attachment narrows every view it
        offers. Always read the attachment's current state before answering questions about log
        patterns, and treat muted patterns as though they do not exist.
      `),
  };
}
