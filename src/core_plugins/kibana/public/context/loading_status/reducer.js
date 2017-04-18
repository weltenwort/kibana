import _ from 'lodash';
import { combineReducers } from 'redux';

import {
  constants as documentConstants,
} from '../documents';

import {
  LOADING_STATUS_FAILURE,
  LOADING_STATUS_PENDING,
  LOADING_STATUS_SUCCESS,
  LOADING_STATUS_UNKNOWN,
} from './constants';


function createLoadingStatusReducer(...actionTypes) {
  const statusMap = _.zipObject(actionTypes, [
    LOADING_STATUS_PENDING,
    LOADING_STATUS_SUCCESS,
    LOADING_STATUS_FAILURE,
  ]);

  return (state = LOADING_STATUS_UNKNOWN, action) => (
    _.get(statusMap, action.type, state)
  );
}

export const loadingStatusReducer = combineReducers({
  [documentConstants.FETCH_ANCHOR_DOCUMENT]: createLoadingStatusReducer(
    documentConstants.FETCH_ANCHOR_DOCUMENT_PENDING,
    documentConstants.FETCH_ANCHOR_DOCUMENT_SUCCESS,
    documentConstants.FETCH_ANCHOR_DOCUMENT_FAILURE,
  ),
  [documentConstants.FETCH_PREDECESSOR_DOCUMENTS]: createLoadingStatusReducer(
    documentConstants.FETCH_PREDECESSOR_DOCUMENTS_PENDING,
    documentConstants.FETCH_PREDECESSOR_DOCUMENTS_SUCCESS,
    documentConstants.FETCH_PREDECESSOR_DOCUMENTS_FAILURE,
  ),
  [documentConstants.FETCH_SUCCESSOR_DOCUMENTS]: createLoadingStatusReducer(
    documentConstants.FETCH_SUCCESSOR_DOCUMENTS_PENDING,
    documentConstants.FETCH_SUCCESSOR_DOCUMENTS_SUCCESS,
    documentConstants.FETCH_SUCCESSOR_DOCUMENTS_FAILURE,
  ),
});
