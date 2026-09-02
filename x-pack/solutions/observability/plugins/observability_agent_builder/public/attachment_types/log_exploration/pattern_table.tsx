/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  EuiButtonIcon,
  EuiDataGrid,
  EuiText,
  EuiToolTip,
  type EuiDataGridColumn,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import type { ChartsPluginStart } from '@kbn/charts-plugin/public';
import type { LogExplorationData } from '../../../common/log_exploration';
import type { LogExplorationAction } from './use_log_exploration_state';
import { SparklineChart } from './sparkline_chart';

const COLUMNS: EuiDataGridColumn[] = [
  {
    id: 'pattern',
    displayAsText: i18n.translate('xpack.observabilityAgentBuilder.logExploration.patternColumn', {
      defaultMessage: 'Pattern',
    }),
    isSortable: false,
  },
  {
    id: 'count',
    displayAsText: i18n.translate('xpack.observabilityAgentBuilder.logExploration.countColumn', {
      defaultMessage: 'Count',
    }),
    initialWidth: 100,
    isSortable: false,
  },
  {
    id: 'sparkline',
    displayAsText: i18n.translate('xpack.observabilityAgentBuilder.logExploration.trendColumn', {
      defaultMessage: 'Trend',
    }),
    initialWidth: 140,
    isSortable: false,
  },
];

interface PatternTableProps {
  data: LogExplorationData;
  dispatch: (action: LogExplorationAction) => void;
  charts: ChartsPluginStart;
  onInvestigate: (pattern: string) => void;
  isReadOnly: boolean;
}

export const PatternTable: React.FC<PatternTableProps> = ({
  data,
  dispatch,
  charts,
  onInvestigate,
  isReadOnly,
}) => {
  const [visibleColumns, setVisibleColumns] = useState(COLUMNS.map(({ id }) => id));

  const rows = useMemo(() => {
    const muted = new Set(data.mutedPatterns);
    return (data.patterns ?? []).filter((row) => !muted.has(row.pattern));
  }, [data.patterns, data.mutedPatterns]);

  const renderCellValue = useCallback(
    ({ rowIndex, columnId }: { rowIndex: number; columnId: string }) => {
      const row = rows[rowIndex];
      if (!row) {
        return null;
      }
      if (columnId === 'pattern') {
        return <span title={row.pattern}>{row.pattern}</span>;
      }
      if (columnId === 'count') {
        return <span>{row.count.toLocaleString()}</span>;
      }
      return <SparklineChart charts={charts} values={row.sparkline} />;
    },
    [rows, charts]
  );

  const trailingControlColumns = useMemo(
    () => [
      {
        id: 'actions',
        width: isReadOnly ? 44 : 76,
        headerCellRender: () => null,
        rowCellRender: ({ rowIndex }: { rowIndex: number }) => {
          const row = rows[rowIndex];
          if (!row) {
            return null;
          }
          return (
            <>
              {!isReadOnly && (
                <EuiToolTip
                  content={i18n.translate(
                    'xpack.observabilityAgentBuilder.logExploration.muteTooltip',
                    { defaultMessage: 'Mute this pattern. Updates immediately.' }
                  )}
                >
                  <EuiButtonIcon
                    data-test-subj="observabilityAgentBuilderTrailingControlColumnsButton"
                    iconType="eyeSlash"
                    color="text"
                    aria-label={i18n.translate(
                      'xpack.observabilityAgentBuilder.logExploration.muteAriaLabel',
                      { defaultMessage: 'Mute pattern' }
                    )}
                    onClick={() => dispatch({ type: 'MUTE_PATTERN', pattern: row.pattern })}
                  />
                </EuiToolTip>
              )}
              <EuiToolTip
                content={i18n.translate(
                  'xpack.observabilityAgentBuilder.logExploration.investigateTooltip',
                  {
                    defaultMessage: 'Investigate this pattern. Starts a new conversation turn.',
                  }
                )}
              >
                <EuiButtonIcon
                  data-test-subj="observabilityAgentBuilderTrailingControlColumnsButton"
                  iconType="sparkles"
                  color="text"
                  aria-label={i18n.translate(
                    'xpack.observabilityAgentBuilder.logExploration.investigateAriaLabel',
                    { defaultMessage: 'Investigate pattern' }
                  )}
                  onClick={() => onInvestigate(row.pattern)}
                />
              </EuiToolTip>
            </>
          );
        },
      },
    ],
    [rows, dispatch, onInvestigate, isReadOnly]
  );

  if (rows.length === 0) {
    return (
      <EuiText size="s" color="subdued">
        {i18n.translate('xpack.observabilityAgentBuilder.logExploration.allMuted', {
          defaultMessage: 'No patterns left to show. Unmute one to bring it back.',
        })}
      </EuiText>
    );
  }

  return (
    <EuiDataGrid
      aria-label={i18n.translate('xpack.observabilityAgentBuilder.logExploration.gridAriaLabel', {
        defaultMessage: 'Log patterns',
      })}
      columns={COLUMNS}
      columnVisibility={{ visibleColumns, setVisibleColumns }}
      rowCount={rows.length}
      renderCellValue={renderCellValue}
      trailingControlColumns={trailingControlColumns}
      gridStyle={{ border: 'horizontal', header: 'underline' }}
      toolbarVisibility={false}
      height={Math.min(rows.length * 40 + 40, 360)}
    />
  );
};
