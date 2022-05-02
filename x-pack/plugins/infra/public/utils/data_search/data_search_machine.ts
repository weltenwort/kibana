/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { OperatorFunction } from 'rxjs';
import { share, tap } from 'rxjs/operators';
import {
  IKibanaSearchRequest,
  IKibanaSearchResponse,
  ISearchGeneric,
  ISearchOptions,
} from 'src/plugins/data/public';
import { assign, createMachine } from 'xstate';
import { tapUnsubscribe } from '../use_observable';
import { ParsedKibanaSearchResponse } from './types';

interface DataSearchCommonContext<SearchStrategyRequest extends IKibanaSearchRequest> {
  request: SearchStrategyRequest;
  options: ISearchOptions;
}

interface DataSearchSearchingContext {
  loaded: number;
  total: number;
}

interface DataSearchSuccessContext<
  ParsedSearchStrategyResponse extends ParsedKibanaSearchResponse<any>
> {
  response: ParsedSearchStrategyResponse;
}

type DataSearchContext<
  SearchStrategyRequest extends IKibanaSearchRequest,
  ParsedSearchStrategyResponse extends ParsedKibanaSearchResponse<any>
> = DataSearchCommonContext<SearchStrategyRequest> &
  Partial<DataSearchSuccessContext<ParsedSearchStrategyResponse>> &
  Partial<DataSearchSearchingContext>;

type DataSearchEvent<ParsedSearchStrategyResponse extends ParsedKibanaSearchResponse<any>> =
  | {
      type: 'RECEIVE_RESPONSE';
      response: ParsedSearchStrategyResponse;
    }
  | { type: 'CANCEL' };

type DataSearchTypestate<
  SearchStrategyRequest extends IKibanaSearchRequest,
  ParsedSearchStrategyResponse extends ParsedKibanaSearchResponse<any>
> =
  | {
      value: 'searching';
      context: DataSearchCommonContext<SearchStrategyRequest> & DataSearchSearchingContext;
    }
  | {
      value: 'success';
      context: DataSearchCommonContext<SearchStrategyRequest> &
        DataSearchSuccessContext<ParsedSearchStrategyResponse>;
    }
  | { value: 'failure'; context: DataSearchCommonContext<SearchStrategyRequest> & {} }
  | { value: 'canceled'; context: DataSearchCommonContext<SearchStrategyRequest> & {} };

export const createDataSearchMachine = <
  SearchStrategyRequest extends IKibanaSearchRequest,
  ParsedSearchStrategyResponse extends ParsedKibanaSearchResponse<any>
>() => {
  return createMachine<
    DataSearchContext<SearchStrategyRequest, ParsedSearchStrategyResponse>,
    DataSearchEvent<ParsedSearchStrategyResponse>,
    DataSearchTypestate<SearchStrategyRequest, ParsedSearchStrategyResponse>
  >(
    {
      id: 'data_search',
      initial: 'searching',
      states: {
        searching: {
          invoke: {
            src: 'search',
          },
          on: {
            RECEIVE_RESPONSE: [
              {
                target: 'searching',
                cond: 'isRunning',
                actions: ['storeResponse'],
              },
              {
                target: 'success',
                cond: 'isComplete',
                actions: ['storeResponse'],
              },
              {
                target: 'failure',
                cond: 'isPartialComplete',
                actions: ['storeResponse'],
              },
            ],
            CANCEL: [
              {
                target: 'canceled',
              },
            ],
          },
        },
        success: {
          type: 'final',
          data: (context) => context.response,
        },
        failure: {
          type: 'final',
          data: (context) => context.response,
        },
        canceled: {
          type: 'final',
          data: (context) => context.response,
        },
      },
    },
    {
      actions: {
        storeResponse: assign({
          response: (context, event) =>
            event.type === 'RECEIVE_RESPONSE' ? event.response : context.response,
        }),
      },
    }
    // {
    //   search: () => {
    //     return data.
    //   },
    // }
  );
};

export const createSearchService =
  <
    SearchStrategyRequest extends IKibanaSearchRequest,
    SearchStrategyResponse extends IKibanaSearchResponse,
    ParsedSearchStrategyResponse extends ParsedKibanaSearchResponse<any>
  >(
    search: ISearchGeneric,
    parseResponses: OperatorFunction<SearchStrategyResponse, ParsedSearchStrategyResponse>
  ) =>
  ({ request, options }: DataSearchCommonContext<SearchStrategyRequest>) => {
    const abortController = new AbortController();
    let isAbortable = true;

    return search<SearchStrategyRequest, SearchStrategyResponse>(request, {
      abortSignal: abortController.signal,
      ...options,
    }).pipe(
      // avoid aborting failed or completed requests
      tap({
        error: () => {
          isAbortable = false;
        },
        complete: () => {
          isAbortable = false;
        },
      }),
      tapUnsubscribe(() => {
        if (isAbortable) {
          abortController.abort();
        }
      }),
      parseResponses,
      share()
    );
  };
