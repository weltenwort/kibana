/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z } from '@kbn/zod/v4';

export const MAX_PATTERNS = 25;
export const MAX_MUTED_PATTERNS = 50;
export const MAX_SPARKLINE_BUCKETS = 40;
export const MAX_HISTOGRAM_BUCKETS = 60;

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
  patterns: z.array(patternSchema).max(MAX_PATTERNS).optional(),
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
