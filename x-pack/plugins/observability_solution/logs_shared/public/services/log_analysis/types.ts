/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { AiopsLogRateAnalysisAPIResponse } from '@kbn/aiops-api-plugin/common';
import { HttpStart } from '@kbn/core-http-browser';
import { ISearchStart } from '@kbn/data-plugin/public';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface LogAnalysisServiceSetup {}

export interface LogAnalysisServiceStart {
  client: ILogAnalysisClient;
}

export interface LogAnalysisServiceStartDeps {
  http: HttpStart;
  search: ISearchStart;
}

export interface ILogAnalysisClient {
  getLogRateAnalysis(params: LogRateAnalysisParams): Promise<AiopsLogRateAnalysisAPIResponse>;
  getLogCategoriesAnalysis(
    params: LogCategoriesAnalysisParams
  ): Promise<LogCategoriesAnalysisResults>;
}

export interface LogRateAnalysisParams {
  end: string;
  start: string;
  index: string;
  timefield: string;
  keywordFieldCandidates?: string[];
  textFieldCandidates?: string[];
  changePoint?:
    | {
        type: 'detect';
      }
    | { type: 'fixed'; timestamp: string };
}

export type LogRateAnaysisResult = AiopsLogRateAnalysisAPIResponse;

export interface LogCategoriesAnalysisParams {
  start: string;
  end: string;
  index: string;
  timefield: string;
  messageField: string;
  sampling:
    | {
        mode: 'auto';
      }
    | {
        mode: 'none';
      };
}

export interface LogCategoriesAnalysisResults {
  histogram: LogCategoryHistogramBucket[];
  logCategories: LogCategoryAnalysisResult[];
}

export interface LogCategoryAnalysisResult {
  changePoint: ChangePointAnalysisResult;
  docCount: number;
  histogram: LogCategoryHistogramBucket[];
  terms: string;
}

export type ChangePointAnalysisResult =
  | ChangePointAnalysisStationaryResult
  | ChangePointAnalysisSuddenChangeResult
  | ChangePointAnalysisNonStationaryChangeResult
  | ChangePointAnalysisDistributionChangeResult;

export interface ChangePointAnalysisStationaryResult {
  type: 'stationary';
}

export interface ChangePointAnalysisSuddenChangeResult {
  type: 'dip' | 'spike' | 'step_change';
  timestamp: string;
  docCount: number;
  pValue: number;
}

export interface ChangePointAnalysisNonStationaryChangeResult {
  type: 'non_stationary';
  pValue: number;
  trend: 'increasing' | 'decreasing';
}

export interface ChangePointAnalysisDistributionChangeResult {
  type: 'distribution_change' | 'trend_change';
}

export interface LogCategoryHistogramBucket {
  timestamp: string;
  docCount: number;
}
