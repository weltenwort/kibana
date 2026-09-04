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
    Patterns currently in the cut, which are the ONLY ones you may discuss:
  `) + `\n${rows}`
  );
};

const formatHistogram = (
  result: Extract<LogExplorationResult, { type: 'volume-comparison' }>
): string => {
  const { current, baseline, intervalMs } = result.histogram;
  const total = (values: number[]) => values.reduce((sum, value) => sum + value, 0);

  return dedent(`
    View: log volume histogram, current range overlaid on the baseline epoch
    Bucket interval: ${intervalMs}ms across ${current.length} buckets
    Total documents in current range: ${total(current)}
    Total documents in baseline epoch: ${total(baseline)}
  `);
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
    `MUTED PATTERNS (${excluded.length}) — the user dismissed these as noise. Never mention,\n` +
      `summarize, count or investigate them:\n` +
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
