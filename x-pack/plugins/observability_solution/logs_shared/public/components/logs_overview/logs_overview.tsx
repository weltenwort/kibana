/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import type { LogAnalysisServiceStart } from '../../services/log_analysis';
import { LogsAnalysis } from './logs_analysis';

export interface LogsOverviewProps {
  dateRange: {
    from: string;
    to: string;
  };
}

export interface LogsOverviewDeps {
  logAnalysis: LogAnalysisServiceStart;
}

export const LogsOverview: React.FC<LogsOverviewProps & LogsOverviewDeps> = ({
  dateRange,
  logAnalysis,
}) => {
  return <LogsAnalysis dateRange={dateRange} logsAnalysis={logAnalysis} />;
};

// for dynamic imports
// eslint-disable-next-line import/no-default-export
export default LogsOverview;
