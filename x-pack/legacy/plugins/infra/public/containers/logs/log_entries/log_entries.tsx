/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';

import { undefined } from 'io-ts';
import { LogEntryTime } from '../../../../common/log_entry';
import { compareTimeKeys, pickTimeKey } from '../../../../common/time';
import { LogEntriesAround as LogEntriesAroundQuery } from '../../../graphql/types';
import { useApolloClient } from '../../../utils/apollo_context';
import { getLogEntryIndexBeforeTime, LogEntry } from '../../../utils/log_entry';
import { usePrevious } from '../../../utils/use_previous';
import { useTrackedPromise } from '../../../utils/use_tracked_promise';
import { logEntriesAroundQuery } from './log_entries.gql_query';
import { withLogPosition } from '../with_log_position';

type LogEntriesAround = LogEntriesAroundQuery.Query['source']['logEntriesAround'];
// type LoadingDirection = 'before' | 'after' | 'both';

export const useLogEntriesAround = (
  sourceId: string,
  target: LogEntryTime | null,
  countBefore: number,
  countAfter: number,
  filterQuery: string | null
) => {
  const [logEntriesAround, setLogEntriesAround] = useState<LogEntriesAround>({
    entries: [],
    hasMoreAfter: false,
    hasMoreBefore: false,
  });
  // const previousTarget = usePrevious(target);
  // const [lastLoadingDirection, setLastLoadingDirection] = useState<LoadingDirection | null>(null);
  const apolloClient = useApolloClient();

  const [loadLogEntriesRequest, loadLogEntries] = useTrackedPromise(
    {
      cancelPreviousOn: 'resolution',
      createPromise: async (
        timeKey: LogEntryTime,
        loadCountBefore: number,
        loadCountAfter: number,
        loadFilterQuery: string | null
      ) => {
        if (!apolloClient) {
          throw new Error('Failed to load source: No apollo client available.');
        }

        return await apolloClient.query<
          LogEntriesAroundQuery.Query,
          LogEntriesAroundQuery.Variables
        >({
          fetchPolicy: 'no-cache',
          query: logEntriesAroundQuery,
          variables: {
            sourceId,
            timeKey,
            countAfter: loadCountAfter,
            countBefore: loadCountBefore,
            filterQuery: loadFilterQuery,
          },
        });
      },
      onResolve: response => {
        setLogEntriesAround(response.data.source.logEntriesAround);
      },
    },
    [apolloClient, sourceId]
  );

  const [bufferCountBefore, bufferCountAfter] = useMemo(
    () => {
      if (target == null) {
        return [0, 0];
      }

      const indexAfterTarget = getLogEntryIndexBeforeTime(logEntriesAround.entries, target);

      return [indexAfterTarget, logEntriesAround.entries.length - indexAfterTarget];
    },
    [target, logEntriesAround.entries]
  );

  const isLoading = useMemo(() => loadLogEntriesRequest.state === 'pending', [
    loadLogEntriesRequest.state,
  ]);

  useEffect(
    () => {
      if (target == null || isLoading) {
        return;
      }
      // const targetChangeDirection = previousTarget
      //   ? compareTimeKeys(target, previousTarget)
      //   : undefined;

      // if (typeof targetChangeDirection === 'undefined') {
      //   // no previous target
      // } else if (targetChangeDirection > 0) {
      //   // moved into the future
      // } else if (targetChangeDirection < 0) {
      //   // moved into the past
      // } else {
      //   // not moved
      // }
      const missingEntriesBefore = countBefore - bufferCountBefore;
      const missingEntriesAfter = countAfter - bufferCountAfter;

      if (missingEntriesBefore > 0 || missingEntriesAfter > 0) {
        loadLogEntries(target, countBefore, countAfter, filterQuery);
      }
    },
    [sourceId, target, countBefore, countAfter, filterQuery, bufferCountBefore, bufferCountAfter]
  );

  return {
    hasMoreAfter: logEntriesAround.hasMoreAfter,
    hasMoreBefore: logEntriesAround.hasMoreBefore,
    isLoading,
    logEntries: logEntriesAround.entries,
  };
};

export const WithLogEntriesAround = withLogPosition<{
  children: (
    args: {
      isLoading: boolean;
      items: Array<ReturnType<typeof createLogEntryStreamItem>>;
    }
  ) => React.ReactElement;
  targetPosition: LogEntryTime | null;
  visibleMidpoint: LogEntryTime | null;
}>(({ children, targetPosition, visibleMidpoint }) => {
  const target = useMemo(() => (targetPosition ? pickTimeKey(targetPosition) : null), [
    targetPosition,
  ]);

  const logEntriesAround = useLogEntriesAround('default', target, 100, 100, null);

  const items = useMemo(() => logEntriesAround.logEntries.map(createLogEntryStreamItem), [
    logEntriesAround.logEntries,
  ]);

  return children({
    isLoading: logEntriesAround.isLoading,
    items,
  });
});

const createLogEntryStreamItem = (logEntry: LogEntry) => ({
  kind: 'logEntry' as 'logEntry',
  logEntry,
});

const useDebouncedValue = <Value extends unknown>(value: Value, delay: number) => {
  const [currentValue, setCurrentValue] = useState<{ value: Value; time: number }>({
    value,
    time: Date.now(),
  });
  const pendingChange = useRef<{
    value: Value;
    timeoutId: number;
  } | null>(null);

  const applyChangeAfterDelay = useCallback(
    () => {
      if (!pendingChange.current) {
        return;
      }

      window.clearTimeout(pendingChange.current.timeoutId);

      const currentTime = Date.now();
      const timeSinceLastApplication = currentTime - currentValue.time;

      if (timeSinceLastApplication >= delay) {
        setCurrentValue({
          value: pendingChange.current.value,
          time: currentTime,
        });
      } else {
        window.setTimeout(applyChangeAfterDelay, timeSinceLastApplication);
      }
    },
    [delay]
  );

  useEffect(
    () => {
      pendingChange.current = {
        value,
        time: Date.now(),
      };

      applyChangeAfterDelay();

      return () => {
        if (!pendingChange.current) {
          return;
        }
        window.clearTimeout(pendingChange.current.timeoutId);
      };
    },
    [applyChangeAfterDelay, value]
  );

  return currentValue;
};
