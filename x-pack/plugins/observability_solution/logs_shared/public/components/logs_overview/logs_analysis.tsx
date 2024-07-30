/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/* eslint-disable @kbn/telemetry/event_generating_elements_should_be_instrumented */
/* eslint-disable @kbn/i18n/strings_should_be_translated_with_i18n */

import { EuiButton } from '@elastic/eui';
import { AiopsLogRateAnalysisAPIResponse } from '@kbn/aiops-api-plugin/common';
import React from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import type { LogAnalysisServiceStart } from '../../services/log_analysis';

type LogRateAnalysisResult = AiopsLogRateAnalysisAPIResponse;

export interface LogsAnalysisProps {
  dateRange: {
    from: string;
    to: string;
  };
  logsAnalysis: LogAnalysisServiceStart;
}

export const LogsAnalysis: React.FC<LogsAnalysisProps> = ({ dateRange, logsAnalysis }) => {
  const [analysis, performAnalysis] = useAsyncFn(async () => {
    return await logsAnalysis.client.getLogRateAnalysis({
      start: dateRange.from,
      end: dateRange.to,
      index: 'logs-*-*',
      timefield: '@timestamp',
      keywordFieldCandidates: ['host.name', 'service.name'],
      textFieldCandidates: ['message'],
    });
  }, [dateRange.from, dateRange.to, logsAnalysis]);

  if (analysis.loading) {
    return <div>Loading...</div>;
  }

  if (analysis.error) {
    return <LogAnalysisError analysisError={analysis.error} onAnalyzeLogs={performAnalysis} />;
  }

  if (!analysis.value) {
    return <LogsAnalysisEmptyState onAnalyzeLogs={performAnalysis} />;
  }

  // TODO: show analysis results
  return <LogAnalysisResults analysisResults={analysis.value} onAnalyzeLogs={performAnalysis} />;
};

const LogsAnalysisEmptyState: React.FC<{
  onAnalyzeLogs: () => void;
}> = ({ onAnalyzeLogs }) => {
  return (
    <div>
      <LogAnalysisControls onAnalyzeLogs={onAnalyzeLogs} />
    </div>
  );
};

const LogAnalysisError: React.FC<{
  analysisError: Error;
  onAnalyzeLogs: () => void;
}> = ({ analysisError, onAnalyzeLogs }) => {
  return (
    <div>
      <LogAnalysisControls onAnalyzeLogs={onAnalyzeLogs} />
      <pre>Error: {analysisError.message}</pre>
    </div>
  );
};

const LogAnalysisResults: React.FC<{
  analysisResults: LogRateAnalysisResult;
  onAnalyzeLogs: () => void;
}> = ({ analysisResults, onAnalyzeLogs }) => {
  return (
    <div>
      <LogAnalysisControls onAnalyzeLogs={onAnalyzeLogs} />
      <pre>{`Analysis results: ${JSON.stringify(analysisResults, undefined, 2)}`}</pre>
    </div>
  );
};

const LogAnalysisControls: React.FC<{ onAnalyzeLogs: () => void }> = ({ onAnalyzeLogs }) => {
  return (
    <div>
      <EuiButton onClick={() => onAnalyzeLogs()}>Analyze Logs</EuiButton>
    </div>
  );
};
