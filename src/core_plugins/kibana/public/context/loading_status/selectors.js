import _ from 'lodash';

import {
  constants as documentsConstants,
} from '../documents';

import {
  LOADING_STATUS_FAILURE,
  LOADING_STATUS_PENDING,
  LOADING_STATUS_SUCCESS,
  LOADING_STATUS_UNKNOWN,
} from './constants';


const isLoadingStatus = _.curry((status, subject, state) => (
  state[subject] === status
));

const isFailure = isLoadingStatus(LOADING_STATUS_FAILURE);
const isPending = isLoadingStatus(LOADING_STATUS_PENDING);
const isSuccess = isLoadingStatus(LOADING_STATUS_SUCCESS);
const isUnknown = isLoadingStatus(LOADING_STATUS_UNKNOWN);

export const hasFailedLoadingAnchorDocument = (state) => (
  isFailure(documentsConstants.FETCH_ANCHOR_DOCUMENT, state)
);

export const hasLoadedPredecessorDocuments = (state) => (
  isSuccess(documentsConstants.FETCH_PREDECESSOR_DOCUMENTS, state)
);

export const hasLoadedSuccessorDocuments = (state) => (
  isSuccess(documentsConstants.FETCH_SUCCESSOR_DOCUMENTS, state)
);

export const isLoadingAnchorDocument = (state) => (
  isPending(documentsConstants.FETCH_ANCHOR_DOCUMENT, state)
  || isUnknown(documentsConstants.FETCH_ANCHOR_DOCUMENT, state)
);

export const isLoadingPredecessorDocuments = (state) => (
  isPending(documentsConstants.FETCH_PREDECESSOR_DOCUMENTS, state)
  || isUnknown(documentsConstants.FETCH_PREDECESSOR_DOCUMENTS, state)
);

export const isLoadingSuccessorDocuments = (state) => (
  isPending(documentsConstants.FETCH_SUCCESSOR_DOCUMENTS, state)
  || isUnknown(documentsConstants.FETCH_SUCCESSOR_DOCUMENTS, state)
);
