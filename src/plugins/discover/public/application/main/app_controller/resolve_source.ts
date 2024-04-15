/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { DataView, DataViewsServicePublic } from '@kbn/data-views-plugin/public';
import { SavedSearch, SavedSearchPublicPluginStart } from '@kbn/saved-search-plugin/public';
import { DiscoverDataSource, ResolvedDataSource } from './source_types';

export interface ResolveSourceDependencies {
  dataViews: DataViewsServicePublic;
  savedSearches: SavedSearchPublicPluginStart;
}

export const resolveSource =
  (services: ResolveSourceDependencies) =>
  async (source: DiscoverDataSource): Promise<ResolvedDataSource> => {
    const savedSearch = await resolveSavedSearch(services)(source);

    // TODO: choose profile
    return chooseProfile(source, savedSearch);
  };

const resolveSavedSearch =
  (services: ResolveSourceDependencies) => async (source: DiscoverDataSource) => {
    if (source.type === 'saved-search') {
      return services.savedSearches.get(source.savedSearchId);
    } else {
      const savedSearch = services.savedSearches.getNew();
      const dataView = await resolveDataView(services)(source);
      savedSearch.searchSource.setField('index', dataView); // TODO: handle null data view
      return savedSearch;
    }
  };

const resolveDataView =
  (services: ResolveSourceDependencies) =>
  async (source: DiscoverDataSource): Promise<DataView | null> => {
    if (source.type === 'data-view') {
      return services.dataViews.get(source.dataViewId);
    } else if (source.type === 'all-logs') {
      // TODO: create all logs data view
      return null;
    } else if (source.type === 'log-dataset') {
      // TODO: create single dataset data view
      return null;
    }

    return services.dataViews.getDefault();
  };

const chooseProfile = (
  source: DiscoverDataSource,
  savedSearch: SavedSearch
): ResolvedDataSource => {
  if (isLogsSource(source, savedSearch)) {
    return { profile: 'logs', savedSearch };
  } else {
    return { profile: 'default', savedSearch };
  }
};

const isLogsSource = (source: DiscoverDataSource, savedSearch: SavedSearch): boolean => {
  // TODO: implement logs source check
  return false;
};

// import { createMachine } from 'xstate';

// export const createPureSourceResolver = () =>
//   createMachine({
//     /** @xstate-layout N4IgpgJg5mDOIC5QGUD2BXATgYzAJTlQBsA3MTAOlgBcBDTagYgG0AGAXUVAAdVYBLav1QA7LiAAeiALQBGAGwUATAA4AnK3lKArABoQAT0QKVAX1P60WXAVjEylGvSbNZnJCF4Cho8VITyAOxqFKyy2lp6hsbyZhYgVjj4hKTkFESotBD8IlDItGQQyGD02AAWjBCiYBQ5JKgA1jUZWfmFxaVlbO48fILCYh7+AMwUsmraw7I6+kYIwypKFNrmlhhJtvZpLdm5bZAdOBXkmKiU3ES01ABmZwC26ZlFBQclR93iXv2+Q4jDSrIxsFYoEonMlIFhqsEusbCkHBRsJgSkI9i8im9ypVqrURPUmojkVcwAA5MAAd32GM6Hw8Xx8g1A-nkUwowJUoNmf0Wy3M8REqAgcHEiThdlSmE+fQZfhkslYKgowwALMNOdEENJFMM1OFVNpwsM1Qr5GBpIFoaLkuKEU4GFLvANZQhlSouQgObz4lbNhLHlkcnl0Ydyg7vozJDJ5Kwlar1eDXZbYdatpQkSjA1SQ2UwzLfghtNoQmo1WDEEoFl61tYU36doGACJXWgANX4FNzTvzShjkXdyshXvMQA */
//     initial: 'start',

//     states: {
//       start: {
//         always: [
//           {
//             target: 'loadingSavedSearch',
//             cond: 'hasPersistedSavedSearch',
//           },
//           'creatingSavedSearch',
//         ],
//       },

//       loadingSavedSearch: {
//         invoke: {
//           src: 'loadSavedSearch',
//           id: 'loadSavedSearch',
//           onDone: 'loadingDataView',
//           onError: 'creatingSavedSearch',
//         },
//       },

//       creatingSavedSearch: {
//         invoke: {
//           src: 'createNewSavedSearch',
//           id: 'createNewSavedSearch',
//           onDone: 'loadingDataView',
//         },
//       },

//       loadingDataView: {},
//     },

//     id: 'SourceResolver',
//     predictableActionArguments: true,
//   });
