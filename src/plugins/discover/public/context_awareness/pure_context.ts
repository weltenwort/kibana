/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { isOfAggregateQueryType } from '@kbn/es-query';
import { getIndexPatternFromESQLQuery } from '@kbn/esql-utils';
import { DataSourceType, isDataSourceType } from '../../common/data_sources';
import {
  DataSourceCategory,
  DataSourceContext,
  DataSourceContextProviderParams,
  DocumentContext,
  DocumentContextProviderParams,
  DocumentType,
  RootContext,
  RootContextProviderParams,
  SolutionType,
} from './context';

type ContextResolver<TParams, TContext> = (params: TParams) => TContext | undefined;

export const resolveContext =
  <TParams, TContext>(
    resolvers: Array<ContextResolver<TParams, TContext>>,
    defaultContext: TContext
  ) =>
  (params: TParams) => {
    for (const resolver of resolvers) {
      const context = resolver(params);

      if (context) {
        return context;
      }
    }

    return defaultContext;
  };

export const resolveRootContext = resolveContext<RootContextProviderParams, RootContext>(
  [
    (params) => {
      if (params.solutionNavId === 'search') {
        return {
          solutionType: SolutionType.Search,
        };
      }
    },
    (params) => {
      if (params.solutionNavId === 'oblt') {
        return {
          solutionType: SolutionType.Observability,
        };
      }
    },
    (params) => {
      if (params.solutionNavId === 'security') {
        return {
          solutionType: SolutionType.Security,
        };
      }
    },
  ],
  {
    solutionType: SolutionType.Default,
  }
);

export const resolveDataSourceContext = resolveContext<
  DataSourceContextProviderParams,
  DataSourceContext
>(
  [
    (params) => {
      let indices: string[] = [];

      if (isDataSourceType(params.dataSource, DataSourceType.Esql)) {
        if (!isOfAggregateQueryType(params.query)) {
          return;
        }

        indices = getIndexPatternFromESQLQuery(params.query.esql).split(',');
      } else if (isDataSourceType(params.dataSource, DataSourceType.DataView)) {
        indices = params.dataView.getIndexPattern().split(',');
      }

      if (indices.every((index) => index.startsWith('logs-'))) {
        return {
          category: DataSourceCategory.Logs,
        };
      }
    },
  ],
  { category: DataSourceCategory.Default }
);

export const resolveDocumentContext = resolveContext<
  DocumentContextProviderParams,
  DocumentContext
>(
  [
    (params) => {
      if ('message' in params.record.flattened) {
        return {
          type: DocumentType.Log,
        };
      }
    },
  ],
  { type: DocumentType.Default }
);
