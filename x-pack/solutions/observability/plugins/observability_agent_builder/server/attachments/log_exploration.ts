/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import dedent from 'dedent';
import type { AttachmentTypeDefinition } from '@kbn/agent-builder-server/attachments';
import type { LogExplorationData } from '../../common/log_exploration';
import { logExplorationDataSchema, MAX_PATTERNS } from '../../common/log_exploration';
import { OBSERVABILITY_LOG_EXPLORATION_ATTACHMENT_TYPE_ID } from '../../common';

const formatPatternTable = (data: LogExplorationData): string => {
  const muted = new Set(data.mutedPatterns);
  const remaining = (data.patterns ?? []).filter((p) => !muted.has(p.pattern));

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

const formatHistogram = (data: LogExplorationData): string => {
  if (!data.histogram) {
    return 'View: log volume histogram (no data)';
  }
  const { current, baseline, intervalMs } = data.histogram;
  const total = (values: number[]) => values.reduce((sum, value) => sum + value, 0);

  return dedent(`
    View: log volume histogram, current range overlaid on the baseline epoch
    Bucket interval: ${intervalMs}ms across ${current.length} buckets
    Total documents in current range: ${total(current)}
    Total documents in baseline epoch: ${total(baseline)}
  `);
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
    // Re-read on every round, so user mutes made between turns are visible to the model here.
    format: (attachment) => {
      const { data } = attachment;

      return {
        getRepresentation: () => ({
          type: 'text',
          value: dedent(`
            Interactive log exploration view. The user steers this view directly; the state below is
            their current filter state and overrides anything you established in earlier turns.

            Index: ${data.index}
            Message field: ${data.messageField}
            ${data.kqlFilter ? `KQL filter: ${data.kqlFilter}` : 'KQL filter: (none)'}
            Active time range: ${data.timeRange.start} to ${data.timeRange.end}
            Baseline epoch: ${
              data.baselineEpoch
                ? `${data.baselineEpoch.start} to ${data.baselineEpoch.end}`
                : '(not set)'
            }

            MUTED PATTERNS (${data.mutedPatterns.length}) — the user dismissed these as noise. Never
            mention, summarize, count or investigate them:
            ${
              data.mutedPatterns.length
                ? data.mutedPatterns.map((pattern) => `- ${pattern}`).join('\n')
                : '(none)'
            }

            ${data.type === 'pattern-table' ? formatPatternTable(data) : formatHistogram(data)}
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
        in the view, without asking you. Always read the attachment's current state before answering
        questions about log patterns, and treat muted patterns as though they do not exist.
      `),
  };
}
