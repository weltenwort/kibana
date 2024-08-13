/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/* eslint-disable @kbn/telemetry/event_generating_elements_should_be_instrumented */
/* eslint-disable @kbn/i18n/strings_should_be_translated_with_i18n */

import {
  EuiBadge,
  EuiButton,
  EuiDataGrid,
  EuiDataGridColumn,
  EuiDataGridPaginationProps,
  RenderCellValue,
} from '@elastic/eui';
import { AiopsLogRateAnalysisAPIResponse } from '@kbn/aiops-api-plugin/common';
import { ChartsPluginStart } from '@kbn/charts-plugin/public';
import { IUiSettingsClient } from '@kbn/core-ui-settings-browser';
import { FieldFormatsStart } from '@kbn/field-formats-plugin/public';
import React, { useCallback, useState } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { FormattedDate } from '@kbn/i18n-react';
import type { LogAnalysisServiceStart } from '../../services/log_analysis';
import {
  LogCategoriesAnalysisResults,
  LogCategoryAnalysisResult,
} from '../../services/log_analysis/types';
import { MiniHistogram } from './mini_histogram';

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
      // sampling: { mode: 'auto' },
      sampling: { mode: 'none' },
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
  const [visibleColumns, setVisibleColumns] = useState(() =>
    categoryChangesGridColumns.map(({ id }) => id)
  );
  const [pagination, setPagination] = useState<
    Pick<EuiDataGridPaginationProps, 'pageIndex' | 'pageSize' | 'pageSizeOptions'>
  >({ pageIndex: 0 });
  const onChangeItemsPerPage = useCallback(
    (pageSize) =>
      setPagination((paginationState) => ({
        ...paginationState,
        pageSize,
        pageIndex: 0,
      })),
    [setPagination]
  );
  const onChangePage = useCallback(
    (pageIndex) => setPagination((paginationState) => ({ ...paginationState, pageIndex })),
    [setPagination]
  );

  // Sorting
  const [sortingColumns, setSortingColumns] = useState([]);
  const onSort = useCallback(
    (sortingColumnsState) => {
      setSortingColumns(sortingColumnsState);
    },
    [setSortingColumns]
  );

  const renderCategoryChangesCellValue: RenderCellValue = useCallback(
    ({ rowIndex, columnId }) => {
      const category = analysisResults.logCategories[rowIndex];

      if (columnId === 'category') {
        return <pre>{category.terms}</pre>;
      } else if (columnId === 'count') {
        return <>{category.docCount}</>;
      } else if (columnId === 'history') {
        return (
          <MiniHistogram
            chartData={category.histogram.map((bucket, bucketIndex) => ({
              // doc_count_overall: analysisResults.histogram[bucketIndex].docCount,
              // doc_count_significant_item: bucket.docCount,
              doc_count_overall: bucket.docCount,
              doc_count_significant_item: 0,
              key: new Date(bucket.timestamp).getTime(),
              key_as_string: bucket.timestamp,
            }))}
            isLoading={false}
            label="History"
            dependencies={{ charts }}
          />
        );
      } else if (columnId === 'change') {
        if (
          category.changePoint?.type === 'dip' ||
          category.changePoint?.type === 'spike' ||
          category.changePoint?.type === 'step_change'
        ) {
          return (
            <>
              <EuiBadge>{category.changePoint.type}</EuiBadge> at{' '}
              <FormattedDate
                value={category.changePoint.timestamp}
                year="numeric"
                month="2-digit"
                day="2-digit"
                hour="2-digit"
                minute="2-digit"
              />
            </>
          );
        } else if (category.changePoint?.type === 'non_stationary') {
          return <EuiBadge>{category.changePoint.trend} trend</EuiBadge>;
        } else if (category.changePoint?.type === 'distribution_change') {
          return <EuiBadge>Distribution change</EuiBadge>;
        } else if (category.changePoint?.type === 'trend_change') {
          return <EuiBadge>Trend change</EuiBadge>;
        } else if (category.changePoint?.type === 'stationary') {
          return <>-</>;
        } else {
          return <EuiBadge>{category.changePoint.type}</EuiBadge>;
        }
      } else if (columnId === 'significance') {
        return <>{category.changePoint?.pValue ?? 0}</>;
      }

      return null;
    },
    [analysisResults.logCategories, charts]
  );

  return (
    <div>
      <LogAnalysisControls onAnalyzeLogs={onAnalyzeLogs} />
      <EuiDataGrid
        aria-label="Log category analysis results"
        columns={categoryChangesGridColumns}
        columnVisibility={{ visibleColumns, setVisibleColumns }}
        inMemory={gridInMemoryConfig}
        renderCellValue={renderCategoryChangesCellValue}
        rowCount={analysisResults.logCategories.length}
        sorting={{ columns: sortingColumns, onSort }}
        pagination={{
          ...pagination,
          onChangeItemsPerPage,
          onChangePage,
        }}
      />
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
    display: 'Category',
    isSortable: false,
    schema: 'string',
  },
  {
    id: 'count',
    display: 'Count',
    isSortable: true,
    schema: 'numeric',
    initialWidth: 100,
  },
  {
    id: 'history',
    display: 'History',
    isSortable: false,
    initialWidth: 100,
  },
  {
    id: 'change',
    display: 'Change',
    isSortable: false,
    initialWidth: 300,
  },
  {
    id: 'significance',
    display: 'Significance',
    isSortable: true,
    schema: 'numeric',
    initialWidth: 100,
  },
];
