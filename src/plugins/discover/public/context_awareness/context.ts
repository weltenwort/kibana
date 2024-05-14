/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import type { DataView } from '@kbn/data-views-plugin/common';
import type { DataTableRecord } from '@kbn/discover-utils';
import { AggregateQuery, Query } from '@kbn/es-query';

export interface ContextProvider<TParams, TContext> {
  order: number;
  resolve: (params: TParams) => TContext | undefined;
}

export enum SolutionType {
  Observability = 'oblt',
  Security = 'security',
  Search = 'search',
  Default = 'default',
}

export interface RootContext {
  solutionType: SolutionType;
}

export interface RootContextProviderParams {
  solutionNavId: string;
}

export type RootContextProvider = ContextProvider<RootContextProviderParams, RootContext>;

export enum DataSourceCategory {
  Logs = 'logs',
  Default = 'default',
}

export interface DataSourceContext {
  category: DataSourceCategory;
}

export interface DataSourceContextProviderParams {
  dataSource: unknown;
  dataView: DataView;
  query: Query | AggregateQuery | undefined;
}

export type DataSourceContextProvider = ContextProvider<
  DataSourceContextProviderParams,
  DataSourceContext
>;

export enum DocumentType {
  Log = 'log',
  Default = 'default',
}

export interface DocumentContext {
  type: DocumentType;
}

export interface DocumentContextProviderParams {
  record: DataTableRecord;
}

export type DocumentContextProvider = ContextProvider<
  DocumentContextProviderParams,
  DocumentContext
>;
