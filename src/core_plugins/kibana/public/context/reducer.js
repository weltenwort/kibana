import { combineReducers } from 'redux';

import { reducer as parametersReducer } from './parameters';
import { reducer as loadingStatusReducer } from './loading_status';
import { reducer as documentsReducer } from './documents';


export const rootReducer = combineReducers({
  contextApp: combineReducers({
    parameters: parametersReducer,
    loadingStatus: loadingStatusReducer,
    documents: documentsReducer,
  }),
  kibana: combineReducers({
    navigation: (state = {}) => state,
  }),
});
