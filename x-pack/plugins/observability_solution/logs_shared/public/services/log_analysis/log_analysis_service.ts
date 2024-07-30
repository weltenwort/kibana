/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { LogAnalysisClient } from './log_analysis_client';
import {
  LogAnalysisServiceSetup,
  LogAnalysisServiceStart,
  LogAnalysisServiceStartDeps,
} from './types';

export class LogAnalysisService {
  public setup(): LogAnalysisServiceSetup {
    return {};
  }

  public start({ http }: LogAnalysisServiceStartDeps): LogAnalysisServiceStart {
    const client = new LogAnalysisClient(http);

    return {
      client,
    };
  }
}
