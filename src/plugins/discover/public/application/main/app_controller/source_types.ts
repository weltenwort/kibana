/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { SavedSearch } from '@kbn/saved-search-plugin/public';

export interface DefaultDiscoverDataSource {
  type: 'default';
}

export interface AllLogsDataSource {
  type: 'all-logs';
}

export interface LogDataSetDataSource {
  type: 'log-dataset';
  integrationId?: string;
  datasetId: string;
}

export interface DataViewDataSource {
  type: 'data-view';
  dataViewId: string;
}

export interface SavedSearchDataSource {
  type: 'saved-search';
  savedSearchId: string;
}

export type DiscoverDataSource =
  | AllLogsDataSource
  | DataViewDataSource
  | DefaultDiscoverDataSource
  | LogDataSetDataSource
  | SavedSearchDataSource;

export type ResolvedDataSource =
  | { profile: 'default'; savedSearch: SavedSearch }
  | { profile: 'logs'; savedSearch: SavedSearch };
