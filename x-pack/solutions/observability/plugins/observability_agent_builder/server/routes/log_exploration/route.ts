/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z } from '@kbn/zod/v4';
import type { ServerRouteRepository } from '@kbn/server-route-repository-utils';
import { apiPrivileges } from '@kbn/agent-builder-plugin/common/features';
import type { LogExplorationFetchResult } from '../../../common/log_exploration';
import {
  LOG_PATTERNS_API_PATH,
  LOG_VOLUME_COMPARISON_API_PATH,
  logPatternsRequestSchema,
  logVolumeComparisonRequestSchema,
} from '../../../common/log_exploration';
import { getLogPatterns } from '../../tools/get_log_patterns/handler';
import { getLogVolumeComparison } from '../../tools/get_log_volume_comparison/handler';
import { createObservabilityAgentBuilderServerRoute } from '../create_observability_agent_builder_server_route';

/**
 * Lets the log exploration renderer re-run its own query when the user moves the window, without
 * spending an agent turn. Stateless on purpose: the renderer already holds every parameter and
 * writes the returned data back into the attachment itself, so these routes share the tools' query
 * handlers and know nothing about conversations.
 */
export function getObservabilityAgentBuilderLogExplorationRouteRepository(): ServerRouteRepository {
  const logPatternsRoute = createObservabilityAgentBuilderServerRoute({
    endpoint: `POST ${LOG_PATTERNS_API_PATH}`,
    options: {
      access: 'internal',
    },
    security: {
      authz: {
        requiredPrivileges: [apiPrivileges.readAgentBuilder],
      },
    },
    params: z.object({
      body: logPatternsRequestSchema,
    }),
    handler: async ({ context, params }): Promise<LogExplorationFetchResult> => {
      const { index, messageField, kqlFilter, timeRange, mutedPatterns } = params.body;
      const { elasticsearch } = await context.core;

      const patterns = await getLogPatterns({
        esClient: elasticsearch.client,
        start: timeRange.start,
        end: timeRange.end,
        index,
        kqlFilter,
        messageField,
        mutedPatterns,
      });

      return { patterns, generatedAt: new Date().toISOString() };
    },
  });

  const logVolumeComparisonRoute = createObservabilityAgentBuilderServerRoute({
    endpoint: `POST ${LOG_VOLUME_COMPARISON_API_PATH}`,
    options: {
      access: 'internal',
    },
    security: {
      authz: {
        requiredPrivileges: [apiPrivileges.readAgentBuilder],
      },
    },
    params: z.object({
      body: logVolumeComparisonRequestSchema,
    }),
    handler: async ({ context, params }): Promise<LogExplorationFetchResult> => {
      const { index, kqlFilter, timeRange, baselineEpoch } = params.body;
      const { elasticsearch } = await context.core;

      const histogram = await getLogVolumeComparison({
        esClient: elasticsearch.client,
        index,
        kqlFilter,
        start: timeRange.start,
        end: timeRange.end,
        baselineStart: baselineEpoch.start,
        baselineEnd: baselineEpoch.end,
      });

      return { histogram, generatedAt: new Date().toISOString() };
    },
  });

  return {
    ...logPatternsRoute,
    ...logVolumeComparisonRoute,
  };
}
