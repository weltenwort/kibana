/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { AiopsLogRateAnalysisAPIResponse } from '@kbn/aiops-api-plugin/common';
import { HttpStart } from '@kbn/core-http-browser';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface LogAnalysisServiceSetup {}

export interface LogAnalysisServiceStart {
  client: ILogAnalysisClient;
}

export interface LogAnalysisServiceStartDeps {
  http: HttpStart;
}

export interface ILogAnalysisClient {
  getLogRateAnalysis(params: LogRateAnalysisParams): Promise<AiopsLogRateAnalysisAPIResponse>;
}

export interface LogRateAnalysisParams {
  end: string;
  start: string;
  index: string;
  timefield: string;
  keywordFieldCandidates?: string[];
  textFieldCandidates?: string[];
}

export type LogRateAnaysisResult = AiopsLogRateAnalysisAPIResponse;
