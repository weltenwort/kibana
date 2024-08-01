/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { LogsAnalysis, LogsAnalysisDependencies } from './logs_analysis';

export interface LogsOverviewProps {
  dateRange: {
    from: string;
    to: string;
  };
}

export type LogsOverviewDeps = LogsAnalysisDependencies;

export const LogsOverview: React.FC<LogsOverviewProps & { dependencies: LogsOverviewDeps }> = ({
  dateRange,
  dependencies,
}) => {
  return <LogsAnalysis dateRange={dateRange} dependencies={dependencies} />;
};

// for dynamic imports
// eslint-disable-next-line import/no-default-export
export default LogsOverview;
