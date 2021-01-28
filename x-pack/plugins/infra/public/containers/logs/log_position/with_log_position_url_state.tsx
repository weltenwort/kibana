/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import React, { useContext, useMemo } from 'react';

import { pickTimeKey } from '../../../../common/time';
import { replaceStateKeyInQueryString, UrlStateContainer } from '../../../utils/url_state';
import {
  HighlightState,
  highlightStateRT,
  LogPositionState,
  LogPositionStateParams,
} from './log_position_state';
import { isValidDatemath, datemathToEpochMillis } from '../../../utils/datemath';
import { decodeOrThrow } from '../../../../common/runtime_types';

/**
 * Url State
 */
export interface LogPositionUrlState {
  position?: LogPositionStateParams['visibleMidpoint'];
  streamLive: boolean;
  start?: string;
  end?: string;
  highlightedLogEntry?: HighlightState;
}

const ONE_HOUR = 3600000;

export const WithLogPositionUrlState = () => {
  const {
    highlightedLogEntry,
    visibleMidpoint,
    isStreaming,
    jumpToTargetPosition,
    setHighlightedLogEntry,
    startLiveStreaming,
    stopLiveStreaming,
    startDateExpression,
    endDateExpression,
    updateDateRange,
    initialize,
  } = useContext(LogPositionState.Context);
  const urlState = useMemo(
    () => ({
      position: visibleMidpoint ? pickTimeKey(visibleMidpoint) : null,
      streamLive: isStreaming,
      start: startDateExpression,
      end: endDateExpression,
      highlightedLogEntry,
    }),
    [visibleMidpoint, isStreaming, startDateExpression, endDateExpression, highlightedLogEntry]
  );
  return (
    <UrlStateContainer
      urlState={urlState}
      urlStateKey="logPosition"
      mapToUrlState={mapToUrlState}
      onChange={(newUrlState: LogPositionUrlState | undefined) => {
        if (!newUrlState) {
          return;
        }

        if (newUrlState.start || newUrlState.end) {
          updateDateRange({
            startDateExpression: newUrlState.start,
            endDateExpression: newUrlState.end,
          });
        }

        if (newUrlState.position) {
          jumpToTargetPosition(newUrlState.position);
        }

        if (newUrlState.streamLive) {
          startLiveStreaming();
        } else if (typeof newUrlState.streamLive !== 'undefined' && !newUrlState.streamLive) {
          stopLiveStreaming();
        }

        if (newUrlState.highlightedLogEntry) {
          try {
            setHighlightedLogEntry(
              decodeOrThrow(highlightStateRT)(newUrlState.highlightedLogEntry)
            );
          } catch {
            // ignore
          }
        }
      }}
      onInitialize={(initialUrlState: LogPositionUrlState | undefined) => {
        if (initialUrlState) {
          const initialPosition = initialUrlState.position;
          let initialStartDateExpression = initialUrlState.start;
          let initialEndDateExpression = initialUrlState.end;

          if (!initialPosition) {
            initialStartDateExpression = initialStartDateExpression || 'now-1d';
            initialEndDateExpression = initialEndDateExpression || 'now';
          } else {
            const initialStartTimestamp = initialStartDateExpression
              ? datemathToEpochMillis(initialStartDateExpression)
              : undefined;
            const initialEndTimestamp = initialEndDateExpression
              ? datemathToEpochMillis(initialEndDateExpression, 'up')
              : undefined;

            // Adjust the start-end range if the target position falls outside or if it's not set.
            if (!initialStartTimestamp || initialStartTimestamp > initialPosition.time) {
              initialStartDateExpression = new Date(initialPosition.time - ONE_HOUR).toISOString();
            }

            if (!initialEndTimestamp || initialEndTimestamp < initialPosition.time) {
              initialEndDateExpression = new Date(initialPosition.time + ONE_HOUR).toISOString();
            }

            jumpToTargetPosition(initialPosition);
          }

          if (initialStartDateExpression || initialEndDateExpression) {
            updateDateRange({
              startDateExpression: initialStartDateExpression,
              endDateExpression: initialEndDateExpression,
            });
          }

          if (initialUrlState.streamLive) {
            startLiveStreaming();
          }

          if (initialUrlState.highlightedLogEntry) {
            setHighlightedLogEntry(initialUrlState.highlightedLogEntry);
          }
        }

        initialize();
      }}
    />
  );
};

const mapToUrlState = (value: any): LogPositionUrlState | undefined =>
  value
    ? {
        position: mapToPositionUrlState(value.position),
        streamLive: mapToStreamLiveUrlState(value.streamLive),
        start: mapToDate(value.start),
        end: mapToDate(value.end),
        highlightedLogEntry: mapToHighlightState(value.highlightedLogEntry),
      }
    : undefined;

const mapToPositionUrlState = (value: any) =>
  value && typeof value.time === 'number' && typeof value.tiebreaker === 'number'
    ? pickTimeKey(value)
    : undefined;

const mapToStreamLiveUrlState = (value: any) => (typeof value === 'boolean' ? value : false);

const mapToDate = (value: any) => (isValidDatemath(value) ? value : undefined);
export const replaceLogPositionInQueryString = (time: number) =>
  Number.isNaN(time)
    ? (value: string) => value
    : replaceStateKeyInQueryString<LogPositionUrlState>('logPosition', {
        position: {
          time,
          tiebreaker: 0,
        },
        end: new Date(time + ONE_HOUR).toISOString(),
        start: new Date(time - ONE_HOUR).toISOString(),
        streamLive: false,
      });

const mapToHighlightState = (value: unknown) => {
  if (highlightStateRT.is(value)) {
    return value;
  } else {
    return undefined;
  }
};
