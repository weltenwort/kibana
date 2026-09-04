/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z } from '@kbn/zod/v4';

/** Rows the table shows, and so the `LIMIT` of the pattern query and the list `format()` gives the model. */
export const MAX_PATTERNS = 8;
export const MAX_SPARKLINE_BUCKETS = 40;
export const MAX_HISTOGRAM_BUCKETS = 60;

/** One `exclude-pattern` refinement per mute, and muting is the fastest way to grow this list. */
export const MAX_EXCLUDED_PATTERNS = 50;

/** Exclusions dominate the list; the headroom covers a scope plus whatever filters the agent set. */
export const MAX_REFINEMENTS = MAX_EXCLUDED_PATTERNS + 10;

/**
 * A refetch queries `MAX_PATTERNS` un-excluded patterns but keeps the previously seen entry for
 * every excluded one, so removing an exclusion can restore a row without another round trip.
 * Derived, not a literal: the retained set grows with the exclusions, not with the rows shown.
 */
export const MAX_STORED_PATTERNS = MAX_PATTERNS + MAX_EXCLUDED_PATTERNS;

/**
 * `maxContentLength` on AttachmentTypeDefinition is declared but never enforced by the framework,
 * so every bound here is load-bearing. Each is derived from the widest tool parameter that can
 * reach it: a value a tool accepts must not produce an attachment that then fails validation.
 */
const MAX_PATTERN_LENGTH = 512;
const MAX_DATEMATH_LENGTH = 64;
/** An ISO-8601 instant with an offset is 29 characters. */
const MAX_TIMESTAMP_LENGTH = 32;
/** `MAX_INDEX_PATTERN_LENGTH` on the tool schemas — a comma-separated list of patterns. */
const MAX_INDEX_LENGTH = 4096;
/** `MAX_KQL_FILTER_LENGTH` on the tool schemas. */
const MAX_KQL_LENGTH = 4096;
const MAX_FIELD_NAME_LENGTH = 256;

const timeRangeSchema = z.object({
  start: z.string().max(MAX_DATEMATH_LENGTH),
  end: z.string().max(MAX_DATEMATH_LENGTH),
});

/** What is being explored. Survives both a refinement and a change of lens. */
const sourceSchema = z.object({
  index: z.string().max(MAX_INDEX_LENGTH),
  messageField: z.string().max(MAX_FIELD_NAME_LENGTH),
  timeRange: timeRangeSchema,
});

/** Labelling only. A refinement the agent applied is still the user's to remove. */
const refinementOriginSchema = z.enum(['user', 'agent']);

/**
 * A narrowing decision, honoured by every view. Uniform storage is the point: a new kind costs a
 * branch in `buildRefinementFilter` and a chip label, not a field in the payload, the request
 * schema, every tool's merge and the controls.
 */
const refinementSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('exclude-pattern'),
    origin: refinementOriginSchema,
    pattern: z.string().max(MAX_PATTERN_LENGTH),
  }),
  z.object({
    kind: z.literal('only-pattern'),
    origin: refinementOriginSchema,
    pattern: z.string().max(MAX_PATTERN_LENGTH),
  }),
  z.object({
    kind: z.literal('kql'),
    origin: refinementOriginSchema,
    query: z.string().max(MAX_KQL_LENGTH),
  }),
]);

/** The lens, and its own parameters. Small and durable, unlike `result`. */
const viewSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('pattern-table') }),
  z.object({ type: z.literal('volume-comparison'), baselineEpoch: timeRangeSchema }),
]);

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

/**
 * The answer to the last query, keyed to the lens that asked it. Disposable, and nearly all of the
 * bytes in a payload write — which is why it is stored apart from the intent above it.
 */
const resultSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('pattern-table'),
    generatedAt: z.string().max(MAX_TIMESTAMP_LENGTH),
    patterns: z.array(patternSchema).max(MAX_STORED_PATTERNS),
  }),
  z.object({
    type: z.literal('volume-comparison'),
    generatedAt: z.string().max(MAX_TIMESTAMP_LENGTH),
    histogram: histogramSchema,
  }),
]);

/**
 * An exploration journey: a subject, progressively refined, viewed through a lens, plus a cache of
 * the last query. The current position only — the attachment version chain is the history.
 */
export const logExplorationDataSchema = z.object({
  source: sourceSchema,
  refinements: z.array(refinementSchema).max(MAX_REFINEMENTS),
  view: viewSchema,
  result: resultSchema,
});

export type LogExplorationData = z.infer<typeof logExplorationDataSchema>;
export type LogExplorationSource = z.infer<typeof sourceSchema>;
export type LogExplorationRefinement = z.infer<typeof refinementSchema>;
export type LogExplorationRefinementOrigin = z.infer<typeof refinementOriginSchema>;
export type LogExplorationView = z.infer<typeof viewSchema>;
export type LogExplorationResult = z.infer<typeof resultSchema>;
export type LogExplorationPattern = z.infer<typeof patternSchema>;
export type LogExplorationTimeRange = z.infer<typeof timeRangeSchema>;
export type LogExplorationHistogram = z.infer<typeof histogramSchema>;

/** Loop state a tool carries forward, so re-running a query never resets what the user built. */
export interface LogExplorationLoopState {
  source: LogExplorationSource;
  refinements: LogExplorationRefinement[];
  baselineEpoch?: LogExplorationTimeRange;
}

/**
 * A refetch asks for exactly the state minus its cache, and gets back exactly the cache. The two
 * hand-written request schemas this replaces stated that relationship in duplicate, and drifted:
 * the volume-comparison one never carried muted patterns, so muting never reached the histogram.
 */
export const logExplorationRequestSchema = logExplorationDataSchema.omit({ result: true });

export type LogExplorationRequest = z.infer<typeof logExplorationRequestSchema>;

export const LOG_PATTERNS_API_PATH =
  '/internal/observability_agent_builder/log_exploration/patterns';
export const LOG_VOLUME_COMPARISON_API_PATH =
  '/internal/observability_agent_builder/log_exploration/volume_comparison';

/** Identity for dedupe and removal: same kind, same target, one refinement. */
export const refinementKey = (refinement: LogExplorationRefinement): string =>
  refinement.kind === 'kql'
    ? `${refinement.kind}:${refinement.query}`
    : `${refinement.kind}:${refinement.pattern}`;

export const addRefinement = (
  refinements: LogExplorationRefinement[],
  refinement: LogExplorationRefinement
): LogExplorationRefinement[] => {
  const key = refinementKey(refinement);
  // Adding twice must be a no-op: a row can be clicked again before its refetch lands.
  if (refinements.some((existing) => refinementKey(existing) === key)) {
    return refinements;
  }
  // The schema bound is enforced here rather than at write time, where exceeding it would reject
  // the whole payload and leave the view unrenderable.
  return refinements.length >= MAX_REFINEMENTS ? refinements : [...refinements, refinement];
};

export const removeRefinement = (
  refinements: LogExplorationRefinement[],
  key: string
): LogExplorationRefinement[] =>
  refinements.filter((refinement) => refinementKey(refinement) !== key);

export const excludedPatterns = (refinements: LogExplorationRefinement[]): string[] =>
  refinements.flatMap((refinement) =>
    refinement.kind === 'exclude-pattern' ? [refinement.pattern] : []
  );

/**
 * Excluded patterns are dropped from the query so the top-N backfills, which would otherwise drop
 * them from the payload and leave their chips pointing at nothing.
 */
export const mergeFetchedPatterns = (
  previous: LogExplorationPattern[] | undefined,
  fetched: LogExplorationPattern[],
  excluded: string[]
): LogExplorationPattern[] => {
  const isExcluded = new Set(excluded);
  const fetchedPatterns = new Set(fetched.map(({ pattern }) => pattern));
  const retained = (previous ?? []).filter(
    ({ pattern }) => isExcluded.has(pattern) && !fetchedPatterns.has(pattern)
  );
  return [...fetched, ...retained].slice(0, MAX_STORED_PATTERNS);
};
