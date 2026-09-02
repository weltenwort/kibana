/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiBadge, EuiFlexGroup, EuiFlexItem, EuiSuperDatePicker, EuiText } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import dateMath from '@kbn/datemath';
import type { LogExplorationData, LogExplorationTimeRange } from '../../../common/log_exploration';
import type { LogExplorationAction } from './use_log_exploration_state';

interface ExplorationControlsProps {
  data: LogExplorationData;
  dispatch: (action: LogExplorationAction) => void;
  isReadOnly: boolean;
  isFetching: boolean;
}

const truncate = (pattern: string) => (pattern.length > 40 ? `${pattern.slice(0, 40)}…` : pattern);

/**
 * Keeps the baseline the same distance behind the window and the same length, so moving the range
 * does not silently turn a "24 hours earlier" comparison into an arbitrary one.
 */
const shiftBaselineEpoch = (
  data: LogExplorationData,
  next: LogExplorationTimeRange
): LogExplorationTimeRange | undefined => {
  if (!data.baselineEpoch) {
    return undefined;
  }
  const previousStartMs = dateMath.parse(data.timeRange.start)?.valueOf();
  const baselineStartMs = dateMath.parse(data.baselineEpoch.start)?.valueOf();
  const nextStartMs = dateMath.parse(next.start)?.valueOf();
  const nextEndMs = dateMath.parse(next.end, { roundUp: true })?.valueOf();
  if (
    previousStartMs === undefined ||
    baselineStartMs === undefined ||
    nextStartMs === undefined ||
    nextEndMs === undefined
  ) {
    return undefined;
  }
  const offsetMs = previousStartMs - baselineStartMs;
  return {
    start: new Date(nextStartMs - offsetMs).toISOString(),
    end: new Date(nextEndMs - offsetMs).toISOString(),
  };
};

export const ExplorationControls: React.FC<ExplorationControlsProps> = ({
  data,
  dispatch,
  isReadOnly,
  isFetching,
}) => (
  <EuiFlexGroup direction="column" gutterSize="s">
    <EuiFlexItem grow={false}>
      <EuiSuperDatePicker
        compressed
        isDisabled={isReadOnly}
        isLoading={isFetching}
        showUpdateButton={false}
        start={data.timeRange.start}
        end={data.timeRange.end}
        onTimeChange={({ start, end }) =>
          dispatch({
            type: 'SET_TIME_RANGE',
            timeRange: { start, end },
            baselineEpoch: shiftBaselineEpoch(data, { start, end }),
          })
        }
        width="auto"
      />
    </EuiFlexItem>
    {data.mutedPatterns.length > 0 && (
      <EuiFlexItem grow={false}>
        <EuiFlexGroup gutterSize="xs" alignItems="center" wrap responsive={false}>
          <EuiFlexItem grow={false}>
            <EuiText size="xs" color="subdued">
              {i18n.translate('xpack.observabilityAgentBuilder.logExploration.mutedLabel', {
                defaultMessage: 'Muted:',
              })}
            </EuiText>
          </EuiFlexItem>
          {data.mutedPatterns.map((pattern) => (
            <EuiFlexItem grow={false} key={pattern}>
              {isReadOnly ? (
                <EuiBadge color="hollow">{truncate(pattern)}</EuiBadge>
              ) : (
                <EuiBadge
                  color="hollow"
                  iconType="cross"
                  iconSide="right"
                  iconOnClick={() => dispatch({ type: 'UNMUTE_PATTERN', pattern })}
                  iconOnClickAriaLabel={i18n.translate(
                    'xpack.observabilityAgentBuilder.logExploration.unmuteAriaLabel',
                    { defaultMessage: 'Unmute pattern' }
                  )}
                >
                  {truncate(pattern)}
                </EuiBadge>
              )}
            </EuiFlexItem>
          ))}
        </EuiFlexGroup>
      </EuiFlexItem>
    )}
  </EuiFlexGroup>
);
