/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ServerRouteRepository } from '@kbn/server-route-repository-utils';
import { getObservabilityAgentBuilderAiInsightsRouteRepository } from './ai_insights/route';
import { getObservabilityAgentBuilderLogExplorationRouteRepository } from './log_exploration/route';

export function getGlobalObservabilityAgentBuilderServerRouteRepository(): ServerRouteRepository {
  return {
    ...getObservabilityAgentBuilderAiInsightsRouteRepository(),
    ...getObservabilityAgentBuilderLogExplorationRouteRepository(),
  };
}

export type ObservabilityAgentBuilderServerRouteRepository = ReturnType<
  typeof getGlobalObservabilityAgentBuilderServerRouteRepository
>;
