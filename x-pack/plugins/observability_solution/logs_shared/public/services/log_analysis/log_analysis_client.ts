/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { AiopsLogRateAnalysisAPIResponse } from '@kbn/aiops-api-plugin/common';
import type { HttpStart } from '@kbn/core-http-browser';
import { LogRateAnalysisParams } from './types';

export class LogAnalysisClient {
  constructor(private readonly http: HttpStart) {}

  public async getLogRateAnalysis(
    params: LogRateAnalysisParams
  ): Promise<AiopsLogRateAnalysisAPIResponse> {
    return await this.http.post<AiopsLogRateAnalysisAPIResponse>(
      '/internal/aiops/simple_log_rate_analysis',
      {
        body: JSON.stringify(params),
      }
    );
  }
}
