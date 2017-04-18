import {
  applyMiddleware,
  compose,
  createStore as createBasicStore,
} from 'redux';
import thunk from 'redux-thunk';

import { SearchSourceMiddlewareProvider } from 'ui/courier/redux';
import { NotifierMiddlewareProvider } from 'ui/notify/redux';

import { rootReducer } from './reducer';


export function CreateStoreProvider(Private) {
  const searchSourceMiddleware = Private(SearchSourceMiddlewareProvider);
  const notifierMiddleware = Private(NotifierMiddlewareProvider);

  return function createStore(initialState) {
    const middleware = [
      thunk,
      searchSourceMiddleware,
      notifierMiddleware,
    ];

    const composeEnhancers =
      window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
      ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({
        name: 'context app',
      })
      : compose;

    const enhancer = composeEnhancers(
      applyMiddleware(...middleware),
    );

    return createBasicStore(rootReducer, initialState, enhancer);
  };
}
