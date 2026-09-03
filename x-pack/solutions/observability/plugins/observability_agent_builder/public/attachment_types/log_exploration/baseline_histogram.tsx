/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useMemo } from 'react';
import { Axis, BarSeries, Chart, Position, ScaleType, Settings } from '@elastic/charts';
import { EuiFlexGroup, EuiFlexItem, EuiFormRow, EuiSelect, EuiText } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import dateMath from '@kbn/datemath';
import type { ChartsPluginStart } from '@kbn/charts-plugin/public';
import type { LogExplorationData } from '../../../common/log_exploration';
import type { LogExplorationAction } from './use_log_exploration_state';

const HOUR_MS = 60 * 60 * 1000;

const BASELINE_OFFSETS = [
  { value: String(HOUR_MS), text: '1 hour earlier' },
  { value: String(6 * HOUR_MS), text: '6 hours earlier' },
  { value: String(24 * HOUR_MS), text: '24 hours earlier' },
  { value: String(7 * 24 * HOUR_MS), text: '7 days earlier' },
];

const CUSTOM_OFFSET = 'custom';

interface BaselineHistogramProps {
  data: LogExplorationData;
  dispatch: (action: LogExplorationAction) => void;
  charts: ChartsPluginStart;
  isReadOnly: boolean;
}

export const BaselineHistogram: React.FC<BaselineHistogramProps> = ({
  data,
  dispatch,
  charts,
  isReadOnly,
}) => {
  const chartBaseTheme = charts.theme.useChartsBaseTheme();

  const series = useMemo(() => {
    if (!data.histogram) {
      return [];
    }
    const { current, baseline, startMs, intervalMs } = data.histogram;
    const length = Math.max(current.length, baseline.length);
    return Array.from({ length }, (_, index) => ({
      x: startMs + index * intervalMs,
      current: current[index] ?? 0,
      baseline: baseline[index] ?? 0,
    }));
  }, [data.histogram]);

  const selectedOffset = useMemo(() => {
    const rangeStart = dateMath.parse(data.timeRange.start)?.valueOf();
    const baselineStart = data.baselineEpoch
      ? dateMath.parse(data.baselineEpoch.start)?.valueOf()
      : undefined;
    if (rangeStart === undefined || baselineStart === undefined) {
      return CUSTOM_OFFSET;
    }
    const gap = rangeStart - baselineStart;
    // Datemath resolves against "now", so tolerate drift between the stored value and this render.
    const match = BASELINE_OFFSETS.find(
      (option) => Math.abs(Number(option.value) - gap) < 60 * 1000
    );
    return match?.value ?? CUSTOM_OFFSET;
  }, [data.timeRange.start, data.baselineEpoch]);

  const options = useMemo(
    () =>
      selectedOffset === CUSTOM_OFFSET
        ? [
            {
              value: CUSTOM_OFFSET,
              text: i18n.translate(
                'xpack.observabilityAgentBuilder.logExploration.customBaseline',
                { defaultMessage: 'Custom' }
              ),
            },
            ...BASELINE_OFFSETS,
          ]
        : BASELINE_OFFSETS,
    [selectedOffset]
  );

  if (!data.histogram) {
    return (
      <EuiText size="s" color="subdued">
        {i18n.translate('xpack.observabilityAgentBuilder.logExploration.noHistogram', {
          defaultMessage: 'No volume data available for this range.',
        })}
      </EuiText>
    );
  }

  return (
    <EuiFlexGroup direction="column" gutterSize="s">
      <EuiFlexItem grow={false}>
        <EuiFormRow
          display="columnCompressed"
          label={i18n.translate('xpack.observabilityAgentBuilder.logExploration.baselineLabel', {
            defaultMessage: 'Baseline',
          })}
        >
          <EuiSelect
            data-test-subj="observabilityAgentBuilderBaselineHistogramSelect"
            compressed
            disabled={isReadOnly}
            options={options}
            value={selectedOffset}
            onChange={(event) => {
              const offsetMs = Number(event.target.value);
              const rangeStart = dateMath.parse(data.timeRange.start)?.valueOf();
              const rangeEnd = dateMath.parse(data.timeRange.end, { roundUp: true })?.valueOf();
              if (
                !Number.isFinite(offsetMs) ||
                rangeStart === undefined ||
                rangeEnd === undefined
              ) {
                return;
              }
              // Shift the whole window back so the baseline always matches the current duration.
              dispatch({
                type: 'SET_BASELINE_EPOCH',
                baselineEpoch: {
                  start: new Date(rangeStart - offsetMs).toISOString(),
                  end: new Date(rangeEnd - offsetMs).toISOString(),
                },
              });
            }}
          />
        </EuiFormRow>
      </EuiFlexItem>
      <EuiFlexItem grow={false}>
        <Chart size={{ height: 200 }}>
          <Settings baseTheme={chartBaseTheme} showLegend legendPosition={Position.Bottom} />
          <Axis
            id="bottom"
            position={Position.Bottom}
            tickFormat={(value) => new Date(value).toLocaleTimeString()}
          />
          <Axis id="left" position={Position.Left} />
          <BarSeries
            id={i18n.translate('xpack.observabilityAgentBuilder.logExploration.currentSeries', {
              defaultMessage: 'Current',
            })}
            xScaleType={ScaleType.Time}
            yScaleType={ScaleType.Linear}
            xAccessor="x"
            yAccessors={['current']}
            data={series}
          />
          <BarSeries
            id={i18n.translate('xpack.observabilityAgentBuilder.logExploration.baselineSeries', {
              defaultMessage: 'Baseline',
            })}
            xScaleType={ScaleType.Time}
            yScaleType={ScaleType.Linear}
            xAccessor="x"
            yAccessors={['baseline']}
            data={series}
          />
        </Chart>
      </EuiFlexItem>
    </EuiFlexGroup>
  );
};
