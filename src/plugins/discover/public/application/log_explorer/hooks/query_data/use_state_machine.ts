/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { ISearchSource, QueryStart } from '@kbn/data-plugin/public';
import { DataView } from '@kbn/data-views-plugin/public';
import { useInterpret } from '@xstate/react';
import { ignoreElements, timer } from 'rxjs';
import { assign } from 'xstate';
import { dataAccessStateMachine } from '../../state_machines';
import { loadAround } from '../../state_machines/services/load_around';

export const useDataAccessStateMachine = ({
  dataView,
  query,
  searchSource,
}: {
  dataView: DataView;
  query: QueryStart;
  searchSource: ISearchSource;
}) => {
  const dataAccessService = useInterpret(
    () => {
      const initialTimeRange = query.timefilter.timefilter.getAbsoluteTime();

      return dataAccessStateMachine.withContext({
        dataView,
        timeRange: initialTimeRange,
        position: {
          timestamp: initialTimeRange.from,
          tiebreaker: 0,
        },
        topChunk: {
          status: 'uninitialized',
        },
        bottomChunk: {
          status: 'uninitialized',
        },
      });
    },
    {
      actions: {
        resetChunks: assign((context) => ({
          ...context,
          topChunk: {
            status: 'uninitialized' as const,
          },
          bottomChunk: {
            status: 'uninitialized' as const,
          },
        })),
      },
      services: {
        loadAround: loadAround({ dataView, query, searchSource }),
      },
      devTools: true,
    }
  );

  return dataAccessService;
};

const createDummyService =
  (delay: number = 3000) =>
  () =>
    timer(delay).pipe(ignoreElements());
