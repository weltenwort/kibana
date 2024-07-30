/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

export { LogAnalysisClient } from './log_analysis_client';
export { LogAnalysisService } from './log_analysis_service';
export type {
  LogAnalysisServiceSetup,
  LogAnalysisServiceStart,
  LogAnalysisServiceStartDeps,
  ILogAnalysisClient,
  LogRateAnalysisParams,
  LogRateAnaysisResult,
} from './types';
