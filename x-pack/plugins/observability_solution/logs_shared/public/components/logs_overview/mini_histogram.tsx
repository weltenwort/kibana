/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import {
  BarSeries,
  Chart,
  PartialTheme,
  ScaleType,
  Settings,
  Tooltip,
  TooltipType,
} from '@elastic/charts';
import { EuiLoadingChart, EuiTextColor, useEuiTheme } from '@elastic/eui';
import { css } from '@emotion/react';
import { LOG_RATE_ANALYSIS_HIGHLIGHT_COLOR } from '@kbn/aiops-log-rate-analysis/constants';
import { ChartsPluginStart } from '@kbn/charts-plugin/public';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import { SignificantItemHistogramItem } from '@kbn/ml-agg-utils';
import React from 'react';

interface MiniHistogramProps {
  chartData?: SignificantItemHistogramItem[];
  isLoading: boolean;
  label: string;
  /** Optional color override for the default bar color for charts */
  barColorOverride?: string;
  /** Optional color override for the highlighted bar color for charts */
  barHighlightColorOverride?: string;
  dependencies: MiniHistogramDependencies;
}

interface MiniHistogramDependencies {
  charts: ChartsPluginStart;
}

export const MiniHistogram: React.FC<MiniHistogramProps> = ({
  chartData,
  isLoading,
  label,
  barColorOverride,
  barHighlightColorOverride,
  dependencies: { charts },
}) => {
  const euiTheme = useEuiTheme();
  const chartBaseTheme = charts.theme.useChartsBaseTheme();

  const miniHistogramChartTheme: PartialTheme = {
    chartMargins: {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
    chartPaddings: {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
    scales: {
      barsPadding: 0.1,
    },
    background: {
      color: 'transparent',
    },
  };

  const cssChartSize = css({
    width: '80px',
    height: euiTheme.euiTheme.size.l,
    margin: '0px',
  });

  const cssCenter = css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  if (isLoading) {
    return (
      <div css={[cssChartSize, cssCenter]}>
        <EuiLoadingChart mono />
      </div>
    );
  }

  if (!chartData) {
    return (
      <div css={[cssChartSize, cssCenter]}>
        <EuiTextColor color="subdued">
          <FormattedMessage id="xpack.logsShared.miniHistogram.noDataLabel" defaultMessage="N/A" />
        </EuiTextColor>
      </div>
    );
  }

  const barColor = barColorOverride ? [barColorOverride] : undefined;
  const barHighlightColor = barHighlightColorOverride
    ? [barHighlightColorOverride]
    : [LOG_RATE_ANALYSIS_HIGHLIGHT_COLOR];

  return (
    <div css={cssChartSize}>
      <Chart>
        <Tooltip type={TooltipType.None} />
        <Settings
          theme={[miniHistogramChartTheme]}
          baseTheme={chartBaseTheme}
          showLegend={false}
          locale={i18n.getLocale()}
        />
        <BarSeries
          id="doc_count_overall"
          xScaleType={ScaleType.Time}
          yScaleType={ScaleType.Linear}
          xAccessor={'key'}
          yAccessors={['doc_count_overall']}
          data={chartData}
          stackAccessors={[0]}
          color={barColor}
        />
        <BarSeries
          id={label}
          xScaleType={ScaleType.Time}
          yScaleType={ScaleType.Linear}
          xAccessor={'key'}
          yAccessors={['doc_count_significant_item']}
          data={chartData}
          stackAccessors={[0]}
          color={barHighlightColor}
        />
      </Chart>
    </div>
  );
};
