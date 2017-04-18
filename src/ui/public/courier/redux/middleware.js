import _ from 'lodash';

import { SearchSourceProvider } from 'ui/courier/data_source/search_source';

import {
  SEARCH_SOURCE_EFFECT,
  SEARCH_SOURCE_EFFECT_PENDING,
  SEARCH_SOURCE_EFFECT_SUCCESS,
  SEARCH_SOURCE_EFFECT_FAILURE,
} from './constants';


export function SearchSourceMiddlewareProvider(Private) {
  const SearchSource = Private(SearchSourceProvider);

  return (store) => (next) => (action) => {
    if (action.type !== SEARCH_SOURCE_EFFECT) {
      return next(action);
    }

    const {
      payload: {
        configuration = {},
        method,
        responseTransformation = _.identity,
        responseTypes: [
          pendingActionType = SEARCH_SOURCE_EFFECT_PENDING,
          successActionType = SEARCH_SOURCE_EFFECT_SUCCESS,
          failureActionType = SEARCH_SOURCE_EFFECT_FAILURE,
        ] = [],
      } = {},
      meta,
    } = action;

    const searchSource = createSearchSourceFromConfiguration(configuration);

    switch(method) {
      case 'fetch':
        store.dispatch({
          type: pendingActionType,
          meta,
        });

        return searchSource.fetch()
          .then((response) => {
            const transformedResponse = responseTransformation(response);

            store.dispatch({
              type: successActionType,
              payload: transformedResponse,
              meta,
            });

            return transformedResponse;
          })
          .catch((error) => {
            store.dispatch({
              type: failureActionType,
              payload: error,
              error: true,
              meta,
            });

            throw error;
          });
      default:
        return next(action);
    }
  };

  function createSearchSourceFromConfiguration(searchSourceConfiguration) {
    const searchSource = new SearchSource();

    const searchSourceConfigurationProps = (searchSource._methods || [])
      .concat(['index', 'inherits']);

    for (const property of searchSourceConfigurationProps) {
      if (_.has(searchSourceConfiguration, property)) {
        searchSource[property](searchSourceConfiguration[property]);
      }
    }

    return searchSource;
  }
}
