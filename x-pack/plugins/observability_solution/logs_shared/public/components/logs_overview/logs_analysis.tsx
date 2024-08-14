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
  EuiFlexGroup,
  EuiFlexItem,
  EuiSwitch,
  RenderCellValue,
} from '@elastic/eui';
import { ChartsPluginStart } from '@kbn/charts-plugin/public';
import { IUiSettingsClient } from '@kbn/core-ui-settings-browser';
import { FieldFormatsStart } from '@kbn/field-formats-plugin/public';
import React, { useCallback, useState } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { FormattedDate } from '@kbn/i18n-react';
import type { LogAnalysisServiceStart } from '../../services/log_analysis';
import {
  LogCategoriesAnalysisParams,
  LogCategoriesAnalysisResults,
} from '../../services/log_analysis/types';
import { MiniHistogram } from './mini_histogram';

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

type SamplingMode = LogCategoriesAnalysisParams['sampling']['mode'];

export const LogsAnalysis: React.FC<LogsAnalysisProps> = ({ dateRange, dependencies }) => {
  const [samplingMode, setSamplingMode] = useState<'auto' | 'none'>('auto');

  const [analysis, performAnalysis] = useAsyncFn(async () => {
    return await dependencies.logsAnalysis.client.getLogCategoriesAnalysis({
      start: dateRange.from,
      end: dateRange.to,
      index: 'logs-*-*',
      timefield: '@timestamp',
      messageField: 'message',
      sampling: { mode: samplingMode },
    });
  }, [dateRange.from, dateRange.to, dependencies.logsAnalysis, samplingMode]);

  if (analysis.loading) {
    return (
      <LogsAnalysisLoadingState
        onAnalyzeLogs={performAnalysis}
        onChangeSamplingMode={setSamplingMode}
        samplingMode={samplingMode}
      />
    );
  }

  if (analysis.error) {
    return (
      <LogAnalysisError
        analysisError={analysis.error}
        onAnalyzeLogs={performAnalysis}
        onChangeSamplingMode={setSamplingMode}
        samplingMode={samplingMode}
      />
    );
  }

  if (!analysis.value) {
    return (
      <LogsAnalysisEmptyState
        onAnalyzeLogs={performAnalysis}
        onChangeSamplingMode={setSamplingMode}
        samplingMode={samplingMode}
      />
    );
  }

  return (
    <LogAnalysisResults
      analysisResults={analysis.value}
      dependencies={dependencies}
      onAnalyzeLogs={performAnalysis}
      onChangeSamplingMode={setSamplingMode}
      samplingMode={samplingMode}
    />
  );
};

const LogsAnalysisEmptyState: React.FC<{
  onAnalyzeLogs: () => void;
  onChangeSamplingMode: (mode: 'auto' | 'none') => void;
  samplingMode: SamplingMode;
}> = ({ onAnalyzeLogs, onChangeSamplingMode, samplingMode }) => {
  return (
    <div>
      <LogAnalysisControls
        onAnalyzeLogs={onAnalyzeLogs}
        onChangeSamplingMode={onChangeSamplingMode}
        samplingMode={samplingMode}
      />
    </div>
  );
};

const LogsAnalysisLoadingState: React.FC<{
  onAnalyzeLogs: () => void;
  onChangeSamplingMode: (mode: 'auto' | 'none') => void;
  samplingMode: SamplingMode;
}> = ({ onAnalyzeLogs, onChangeSamplingMode, samplingMode }) => {
  return (
    <EuiFlexGroup direction="column">
      <EuiFlexItem>
        <LogAnalysisControls
          disabled
          onAnalyzeLogs={onAnalyzeLogs}
          onChangeSamplingMode={onChangeSamplingMode}
          samplingMode={samplingMode}
        />
      </EuiFlexItem>
      <EuiFlexItem>
        <div>Loading...</div>
      </EuiFlexItem>
    </EuiFlexGroup>
  );
};

const LogAnalysisError: React.FC<{
  analysisError: Error;
  onAnalyzeLogs: () => void;
  onChangeSamplingMode: (mode: 'auto' | 'none') => void;
  samplingMode: SamplingMode;
}> = ({ analysisError, onAnalyzeLogs, onChangeSamplingMode, samplingMode }) => {
  return (
    <EuiFlexGroup direction="column">
      <EuiFlexItem>
        <LogAnalysisControls
          onAnalyzeLogs={onAnalyzeLogs}
          onChangeSamplingMode={onChangeSamplingMode}
          samplingMode={samplingMode}
        />
      </EuiFlexItem>
      <EuiFlexItem>
        <pre>Error: {analysisError.message}</pre>
        <pre>{analysisError.stack}</pre>
      </EuiFlexItem>
    </EuiFlexGroup>
  );
};

const gridInMemoryConfig = { level: 'sorting' as const };

const LogAnalysisResults: React.FC<{
  analysisResults: LogCategoriesAnalysisResults;
  dependencies: LogsAnalysisDependencies;
  onAnalyzeLogs: () => void;
  onChangeSamplingMode: (mode: SamplingMode) => void;
  samplingMode: SamplingMode;
}> = ({
  analysisResults,
  dependencies: { charts, fieldFormats, uiSettings },
  onAnalyzeLogs,
  onChangeSamplingMode,
  samplingMode,
}) => {
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
        return <>{'pValue' in category.changePoint ? category.changePoint.pValue : 0}</>;
      }

      return null;
    },
    [analysisResults.logCategories, charts]
  );

  return (
    <EuiFlexGroup direction="column">
      <EuiFlexItem>
        <LogAnalysisControls
          onAnalyzeLogs={onAnalyzeLogs}
          onChangeSamplingMode={onChangeSamplingMode}
          samplingMode={samplingMode}
        />
      </EuiFlexItem>
      <EuiFlexItem>
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
      </EuiFlexItem>
    </EuiFlexGroup>
  );
};

const LogAnalysisControls: React.FC<{
  disabled?: boolean;
  onAnalyzeLogs: () => void;
  onChangeSamplingMode: (mode: SamplingMode) => void;
  samplingMode: SamplingMode;
}> = ({ disabled = false, onAnalyzeLogs, onChangeSamplingMode, samplingMode }) => {
  return (
    <EuiFlexGroup justifyContent="flexEnd" alignItems="center">
      <EuiFlexItem grow={false}>
        <EuiSwitch
          disabled={disabled}
          label="Enable sampling"
          checked={samplingMode === 'auto'}
          onChange={(evt) => {
            onChangeSamplingMode(evt.target.checked ? 'auto' : 'none');
          }}
        />
      </EuiFlexItem>
      <EuiFlexItem grow={false}>
        <EuiButton disabled={disabled} onClick={() => onAnalyzeLogs()}>
          Analyze Logs
        </EuiButton>
      </EuiFlexItem>
    </EuiFlexGroup>
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
