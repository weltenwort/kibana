/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/* eslint-disable @kbn/telemetry/event_generating_elements_should_be_instrumented */
/* eslint-disable @kbn/i18n/strings_should_be_translated_with_i18n */

import { EuiButton, EuiDataGrid, EuiDataGridColumn, RenderCellValue } from '@elastic/eui';
import { AiopsLogRateAnalysisAPIResponse } from '@kbn/aiops-api-plugin/common';
import { ChartsPluginStart } from '@kbn/charts-plugin/public';
import { IUiSettingsClient } from '@kbn/core-ui-settings-browser';
import { FieldFormatsStart } from '@kbn/field-formats-plugin/public';
import React, { useCallback, useState } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import type { LogAnalysisServiceStart } from '../../services/log_analysis';
import {
  LogCategoriesAnalysisResults,
  LogCategoryAnalysisResult,
} from '../../services/log_analysis/types';

type LogRateAnalysisResult = AiopsLogRateAnalysisAPIResponse;

export interface LogsAnalysisDependencies {
  charts: ChartsPluginStart;
  fieldFormats: FieldFormatsStart;
  logsAnalysis: LogAnalysisServiceStart;
  uiSettings: IUiSettingsClient;
}

export interface LogsAnalysisProps {
  dateRange: {
    from: string;
    to: string;
  };
  dependencies: LogsAnalysisDependencies;
}

export const LogsAnalysis: React.FC<LogsAnalysisProps> = ({ dateRange, dependencies }) => {
  const [analysis, performAnalysis] = useAsyncFn(async () => {
    return await dependencies.logsAnalysis.client.getLogCategoriesAnalysis({
      start: dateRange.from,
      end: dateRange.to,
      index: 'logs-*-*',
      timefield: '@timestamp',
      messageField: 'message',
    });
  }, [dateRange.from, dateRange.to, dependencies.logsAnalysis]);

  if (analysis.loading) {
    return <div>Loading...</div>;
  }

  if (analysis.error) {
    return <LogAnalysisError analysisError={analysis.error} onAnalyzeLogs={performAnalysis} />;
  }

  if (!analysis.value) {
    return <LogsAnalysisEmptyState onAnalyzeLogs={performAnalysis} />;
  }

  return (
    <LogAnalysisResults
      analysisResults={analysis.value}
      dependencies={dependencies}
      onAnalyzeLogs={performAnalysis}
    />
  );
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
      <pre>Error: {analysisError.stack}</pre>
    </div>
  );
};

const gridInMemoryConfig = { level: 'sorting' as const };

const LogAnalysisResults: React.FC<{
  analysisResults: LogCategoriesAnalysisResults;
  dependencies: LogsAnalysisDependencies;
  onAnalyzeLogs: () => void;
}> = ({ analysisResults, dependencies: { charts, fieldFormats, uiSettings }, onAnalyzeLogs }) => {
  const [visibleColumns, setVisibleColumns] = useState(['category']);

  const renderCategoryChangesCellValue: RenderCellValue = useCallback(
    ({ rowIndex, columnId }) => {
      const category = analysisResults.logCategories[rowIndex];

      if (columnId === 'category') {
        return <>{category.terms}</>;
      }

      return null;
    },
    [analysisResults.logCategories]
  );

  return (
    <div>
      <LogAnalysisControls onAnalyzeLogs={onAnalyzeLogs} />
      <EuiDataGrid
        columns={categoryChangesGridColumns}
        columnVisibility={{ visibleColumns, setVisibleColumns }}
        inMemory={gridInMemoryConfig}
        renderCellValue={renderCategoryChangesCellValue}
        rowCount={analysisResults.logCategories.length}
      />
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

const categoryChangesGridColumns: EuiDataGridColumn[] = [
  {
    id: 'category',
    displayAsText: 'Category',
    isSortable: false,
    schema: 'string',
  },
];

interface CategoryChangesCellContext {
  categories: LogCategoryAnalysisResult[];
}
