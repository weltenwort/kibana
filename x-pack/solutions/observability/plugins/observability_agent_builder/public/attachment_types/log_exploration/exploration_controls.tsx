/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiBadge, EuiFlexGroup, EuiFlexItem, EuiSuperDatePicker, EuiText } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import type { LogExplorationData } from '../../../common/log_exploration';
import type { LogExplorationAction } from './use_log_exploration_state';

interface ExplorationControlsProps {
  data: LogExplorationData;
  dispatch: (action: LogExplorationAction) => void;
  isReadOnly: boolean;
}

const truncate = (pattern: string) => (pattern.length > 40 ? `${pattern.slice(0, 40)}…` : pattern);

export const ExplorationControls: React.FC<ExplorationControlsProps> = ({
  data,
  dispatch,
  isReadOnly,
}) => (
  <EuiFlexGroup direction="column" gutterSize="s">
    <EuiFlexItem grow={false}>
      <EuiSuperDatePicker
        compressed
        isDisabled={isReadOnly}
        showUpdateButton={false}
        start={data.timeRange.start}
        end={data.timeRange.end}
        onTimeChange={({ start, end }) =>
          dispatch({ type: 'SET_TIME_RANGE', timeRange: { start, end } })
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
