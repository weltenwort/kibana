/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { HttpStart } from '@kbn/core/public';
import type {
  LogExplorationData,
  LogExplorationRequest,
  LogExplorationResult,
} from '../../../common/log_exploration';
import {
  LOG_PATTERNS_API_PATH,
  LOG_VOLUME_COMPARISON_API_PATH,
} from '../../../common/log_exploration';

export type FetchLogExplorationView = (args: {
  data: LogExplorationData;
  signal: AbortSignal;
}) => Promise<LogExplorationResult>;

const PATH_BY_VIEW_TYPE: Record<LogExplorationData['view']['type'], string> = {
  'pattern-table': LOG_PATTERNS_API_PATH,
  'volume-comparison': LOG_VOLUME_COMPARISON_API_PATH,
};

/**
 * Re-runs the query behind the current view against the state the user just changed. The request is
 * the state minus its cache and the response is that cache, so this only has to pick the route.
 */
export const createFetchLogExplorationView =
  (http: HttpStart): FetchLogExplorationView =>
  async ({ data, signal }) => {
    const { source, refinements, view } = data;
    const body: LogExplorationRequest = { source, refinements, view };

    return http.post<LogExplorationResult>(PATH_BY_VIEW_TYPE[view.type], {
      body: JSON.stringify(body),
      signal,
    });
  };
