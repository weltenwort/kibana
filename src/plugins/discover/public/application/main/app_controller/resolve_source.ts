/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { DataViewsServicePublic } from '@kbn/data-views-plugin/public';
import { SavedSearchPublicPluginStart } from '@kbn/saved-search-plugin/public';

export interface ResolveSourceDependencies {
  dataViews: DataViewsServicePublic;
  savedSearches: SavedSearchPublicPluginStart;
}

export interface DiscoverDefaultSource {
  type: 'default';
}

export interface DiscoverSavedSearchSource {
  type: 'saved-search';
  savedSearchId: string;
}

export type DiscoverSource = DiscoverDefaultSource | DiscoverSavedSearchSource;

export const resolveSource =
  (services: ResolveSourceDependencies) => async (source: DiscoverSource) => {
    const savedSearch = await resolveSavedSearch(services)(source);

    // TODO: choose profile
  };

const resolveSavedSearch =
  (services: ResolveSourceDependencies) => async (source: DiscoverSource) => {
    if (source.type === 'saved-search') {
      return services.savedSearches.get(source.savedSearchId);
    } else {
      const savedSearch = services.savedSearches.getNew();
      const dataView = await services.dataViews.getDefaultDataView();
      savedSearch.searchSource.setField('index', dataView);
      return savedSearch;
    }
  };

// import { createMachine } from 'xstate';

// export const createPureSourceResolver = () =>
//   createMachine({
//     /** @xstate-layout N4IgpgJg5mDOIC5gF8A0IB2B7CdGgGUsBXAJwGMwAlOLAGwDcxT8QAHLWASwBcusMrAB6IADOgCeY5GhBEylGrHpNSAOlg8AhqR6sO3PgOGIALAA5JicwHY1AVhkygA */
//     initial: 'start',

//     states: {
//       resolvingSource: {
//         invoke: {
//           src: 'resolveSource',
//           id: 'resolveSource',
//         },
//       },

//       start: {},
//     },

//     id: 'SourceResolver',
//   });
