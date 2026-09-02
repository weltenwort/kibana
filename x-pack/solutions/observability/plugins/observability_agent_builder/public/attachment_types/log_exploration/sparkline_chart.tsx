/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useMemo } from 'react';
import type { FC } from 'react';
import { BarSeries, Chart, ScaleType, Settings, Tooltip, TooltipType } from '@elastic/charts';
import type { PartialTheme } from '@elastic/charts';
import { EuiScreenReaderOnly } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import type { ChartsPluginStart } from '@kbn/charts-plugin/public';

// Adapted from Discover's sparkline data source profile, which is plugin-internal and not exported.
const sparklineChartTheme: PartialTheme = {
  chartMargins: { left: 0, right: 0, top: 0, bottom: 0 },
  chartPaddings: { left: 0, right: 0, top: 0, bottom: 0 },
  scales: { barsPadding: 0.1 },
  background: { color: 'transparent' },
};

export const SparklineChart: FC<{ charts: ChartsPluginStart; values: number[] }> = ({
  charts,
  values,
}) => {
  const chartBaseTheme = charts.theme.useChartsBaseTheme();
  const chartData = useMemo(() => values.map((value, index) => ({ key: index, value })), [values]);

  if (values.length === 0) {
    return <span>{'—'}</span>;
  }

  return (
    <>
      <Chart size={{ height: 24 }}>
        <Tooltip type={TooltipType.None} />
        <Settings
          theme={[sparklineChartTheme]}
          baseTheme={chartBaseTheme}
          showLegend={false}
          locale={i18n.getLocale()}
        />
        <BarSeries
          id="pattern_trend"
          xScaleType={ScaleType.Linear}
          yScaleType={ScaleType.Linear}
          xAccessor="key"
          yAccessors={['value']}
          data={chartData}
          stackAccessors={[0]}
        />
      </Chart>
      <EuiScreenReaderOnly>
        <span>{values.join(', ')}</span>
      </EuiScreenReaderOnly>
    </>
  );
};
