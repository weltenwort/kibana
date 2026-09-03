/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z } from '@kbn/zod/v4';

/** Rows the table shows, and so the `LIMIT` of the pattern query and the list `format()` gives the model. */
export const MAX_PATTERNS = 8;
export const MAX_MUTED_PATTERNS = 50;
export const MAX_SPARKLINE_BUCKETS = 40;
export const MAX_HISTOGRAM_BUCKETS = 60;

/**
 * A refetch queries `MAX_PATTERNS` un-muted patterns but keeps the previously seen entry for every
 * muted one, so unmuting can restore a row without another round trip. Derived, not a literal: the
 * retained set grows to `MAX_MUTED_PATTERNS` independently of how many rows the table shows.
 */
export const MAX_STORED_PATTERNS = MAX_PATTERNS + MAX_MUTED_PATTERNS;

const MAX_PATTERN_LENGTH = 512;
const MAX_DATEMATH_LENGTH = 64;
const MAX_INDEX_LENGTH = 1024;

/**
 * `maxContentLength` on AttachmentTypeDefinition is declared but never enforced by the framework,
 * so every bound here is load-bearing.
 */

const timeRangeSchema = z.object({
  start: z.string().max(MAX_DATEMATH_LENGTH),
  end: z.string().max(MAX_DATEMATH_LENGTH),
});

const patternSchema = z.object({
  pattern: z.string().max(MAX_PATTERN_LENGTH),
  count: z.number(),
  sparkline: z.array(z.number()).max(MAX_SPARKLINE_BUCKETS),
});

const histogramSchema = z.object({
  intervalMs: z.number(),
  startMs: z.number(),
  baselineStartMs: z.number(),
  current: z.array(z.number()).max(MAX_HISTOGRAM_BUCKETS),
  baseline: z.array(z.number()).max(MAX_HISTOGRAM_BUCKETS),
});

export const logExplorationDataSchema = z.object({
  /** Which view the renderer should draw. Both views share one attachment. */
  type: z.enum(['pattern-table', 'histogram']),
  index: z.string().max(MAX_INDEX_LENGTH),
  messageField: z.string().max(MAX_DATEMATH_LENGTH),
  kqlFilter: z.string().max(MAX_INDEX_LENGTH).optional(),
  timeRange: timeRangeSchema,
  mutedPatterns: z.array(z.string().max(MAX_PATTERN_LENGTH)).max(MAX_MUTED_PATTERNS),
  baselineEpoch: timeRangeSchema.optional(),
  patterns: z.array(patternSchema).max(MAX_STORED_PATTERNS).optional(),
  histogram: histogramSchema.optional(),
  generatedAt: z.string().max(MAX_DATEMATH_LENGTH),
});

export type LogExplorationData = z.infer<typeof logExplorationDataSchema>;
export type LogExplorationPattern = z.infer<typeof patternSchema>;
export type LogExplorationTimeRange = z.infer<typeof timeRangeSchema>;
export type LogExplorationHistogram = z.infer<typeof histogramSchema>;

/** Loop state carried forward when a tool switches the attachment between views. */
export type LogExplorationLoopState = Pick<
  LogExplorationData,
  'mutedPatterns' | 'timeRange' | 'baselineEpoch'
>;

/**
 * Requests for the refetch routes the renderer calls when the user changes the window without
 * spending an agent turn. Every field is already present in the attachment payload.
 */
export const LOG_PATTERNS_API_PATH =
  '/internal/observability_agent_builder/log_exploration/patterns';
export const LOG_VOLUME_COMPARISON_API_PATH =
  '/internal/observability_agent_builder/log_exploration/volume_comparison';

export const logPatternsRequestSchema = z.object({
  index: z.string().max(MAX_INDEX_LENGTH),
  messageField: z.string().max(MAX_DATEMATH_LENGTH),
  kqlFilter: z.string().max(MAX_INDEX_LENGTH).optional(),
  timeRange: timeRangeSchema,
  mutedPatterns: z.array(z.string().max(MAX_PATTERN_LENGTH)).max(MAX_MUTED_PATTERNS),
});

export const logVolumeComparisonRequestSchema = z.object({
  index: z.string().max(MAX_INDEX_LENGTH),
  kqlFilter: z.string().max(MAX_INDEX_LENGTH).optional(),
  timeRange: timeRangeSchema,
  baselineEpoch: timeRangeSchema,
});

export type LogPatternsRequest = z.infer<typeof logPatternsRequestSchema>;
export type LogVolumeComparisonRequest = z.infer<typeof logVolumeComparisonRequestSchema>;

/** What a refetch replaces in the attachment payload. `generatedAt` comes from the server clock. */
export interface LogExplorationFetchResult {
  patterns?: LogExplorationPattern[];
  histogram?: LogExplorationHistogram;
  generatedAt: string;
}

/**
 * Muted patterns are excluded from the query so the top-N backfills, which would otherwise drop them
 * from the payload and leave the unmute chips pointing at nothing.
 */
export const mergeFetchedPatterns = (
  previous: LogExplorationPattern[] | undefined,
  fetched: LogExplorationPattern[],
  mutedPatterns: string[]
): LogExplorationPattern[] => {
  const muted = new Set(mutedPatterns);
  const fetchedPatterns = new Set(fetched.map(({ pattern }) => pattern));
  const retained = (previous ?? []).filter(
    ({ pattern }) => muted.has(pattern) && !fetchedPatterns.has(pattern)
  );
  return [...fetched, ...retained].slice(0, MAX_STORED_PATTERNS);
};
