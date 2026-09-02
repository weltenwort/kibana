/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { HttpStart } from '@kbn/core/public';
import dateMath from '@kbn/datemath';
import type {
  LogExplorationData,
  LogExplorationFetchResult,
  LogPatternsRequest,
  LogVolumeComparisonRequest,
  LogExplorationTimeRange,
} from '../../../common/log_exploration';
import {
  LOG_PATTERNS_API_PATH,
  LOG_VOLUME_COMPARISON_API_PATH,
} from '../../../common/log_exploration';

export type FetchLogExplorationView = (args: {
  data: LogExplorationData;
  signal: AbortSignal;
}) => Promise<LogExplorationFetchResult>;

/** Falls back to the window immediately before the current one, matching the tool's own default. */
const resolveBaselineEpoch = (data: LogExplorationData): LogExplorationTimeRange => {
  if (data.baselineEpoch) {
    return data.baselineEpoch;
  }
  const startMs = dateMath.parse(data.timeRange.start)?.valueOf();
  const endMs = dateMath.parse(data.timeRange.end, { roundUp: true })?.valueOf();
  if (startMs === undefined || endMs === undefined) {
    throw new Error(`Could not resolve the time range "${data.timeRange.start}"`);
  }
  return { start: new Date(startMs - (endMs - startMs)).toISOString(), end: data.timeRange.start };
};

/**
 * Re-runs the query behind the current view against the window the user just picked. The routes are
 * stateless, so the caller writes the returned data back into the attachment itself.
 */
export const createFetchLogExplorationView =
  (http: HttpStart): FetchLogExplorationView =>
  async ({ data, signal }) => {
    if (data.type === 'histogram') {
      const body: LogVolumeComparisonRequest = {
        index: data.index,
        kqlFilter: data.kqlFilter,
        timeRange: data.timeRange,
        baselineEpoch: resolveBaselineEpoch(data),
      };
      return http.post<LogExplorationFetchResult>(LOG_VOLUME_COMPARISON_API_PATH, {
        body: JSON.stringify(body),
        signal,
      });
    }

    const body: LogPatternsRequest = {
      index: data.index,
      messageField: data.messageField,
      kqlFilter: data.kqlFilter,
      timeRange: data.timeRange,
      mutedPatterns: data.mutedPatterns,
    };
    return http.post<LogExplorationFetchResult>(LOG_PATTERNS_API_PATH, {
      body: JSON.stringify(body),
      signal,
    });
  };
