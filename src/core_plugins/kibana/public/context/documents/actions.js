import _ from 'lodash';

import { SEARCH_SOURCE_EFFECT } from 'ui/courier/redux';

import {
  increasePredecessorCount,
  increaseSuccessorCount,
  setPredecessorCount,
  setParameters,
  setSuccessorCount,
} from '../parameters/actions';
import {
  FETCH_ANCHOR_DOCUMENT,
  FETCH_ANCHOR_DOCUMENT_FAILURE,
  FETCH_ANCHOR_DOCUMENT_PENDING,
  FETCH_ANCHOR_DOCUMENT_SUCCESS,
  FETCH_PREDECESSOR_DOCUMENTS,
  FETCH_PREDECESSOR_DOCUMENTS_FAILURE,
  FETCH_PREDECESSOR_DOCUMENTS_PENDING,
  FETCH_PREDECESSOR_DOCUMENTS_SUCCESS,
  FETCH_SUCCESSOR_DOCUMENTS,
  FETCH_SUCCESSOR_DOCUMENTS_FAILURE,
  FETCH_SUCCESSOR_DOCUMENTS_PENDING,
  FETCH_SUCCESSOR_DOCUMENTS_SUCCESS,
} from './constants';
import { reverseSortDirective } from '../api/utils/sorting';


export const fetchAnchorDocument = (indexPattern, anchorUid, sort) => ({
  type: SEARCH_SOURCE_EFFECT,
  payload: {
    method: 'fetch',
    configuration: {
      inherits: false,
      index: indexPattern,
      version: true,
      size: 1,
      query: {
        terms: {
          _uid: [anchorUid],
        },
      },
      sort: [_.zipObject([sort]), { _uid: 'asc' }],
    },
    responseTypes: [
      FETCH_ANCHOR_DOCUMENT_PENDING,
      FETCH_ANCHOR_DOCUMENT_SUCCESS,
      FETCH_ANCHOR_DOCUMENT_FAILURE,
    ],
    responseTransformation: (response) => {
      if (_.get(response, ['hits', 'total'], 0) < 1) {
        throw new Error('Failed to load anchor document.');
      }

      return response;
    }
  },
  meta: {
    groupType: FETCH_ANCHOR_DOCUMENT,
  },
});

export const fetchPredecessorDocuments = (indexPattern, anchorSortValues, sort, count) => ({
  type: SEARCH_SOURCE_EFFECT,
  payload: {
    method: 'fetch',
    configuration: {
      inherits: false,
      index: indexPattern,
      version: true,
      size: count,
      query: {
        match_all: {},
      },
      searchAfter: anchorSortValues,
      sort: [reverseSortDirective(_.zipObject([sort])), { _uid: 'desc' }],
    },
    responseTypes: [
      FETCH_PREDECESSOR_DOCUMENTS_PENDING,
      FETCH_PREDECESSOR_DOCUMENTS_SUCCESS,
      FETCH_PREDECESSOR_DOCUMENTS_FAILURE,
    ],
  },
  meta: {
    groupType: FETCH_PREDECESSOR_DOCUMENTS,
  },
});

export const fetchSuccessorDocuments = (indexPattern, anchorSortValues, sort, count) => ({
  type: SEARCH_SOURCE_EFFECT,
  payload: {
    method: 'fetch',
    configuration: {
      inherits: false,
      index: indexPattern,
      version: true,
      size: count,
      query: {
        match_all: {},
      },
      searchAfter: anchorSortValues,
      sort: [_.zipObject([sort]), { _uid: 'asc' }],
    },
    responseTypes: [
      FETCH_SUCCESSOR_DOCUMENTS_PENDING,
      FETCH_SUCCESSOR_DOCUMENTS_SUCCESS,
      FETCH_SUCCESSOR_DOCUMENTS_FAILURE,
    ],
  },
  meta: {
    groupType: FETCH_SUCCESSOR_DOCUMENTS,
  },
});

export const fetchAllDocuments = (
  indexPattern,
  anchorUid,
  sort,
  predecessorCount,
  successorCount,
) => (dispatch) => (
  dispatch(fetchAnchorDocument(indexPattern, anchorUid, sort))
    .then(({ hits: { hits: [ anchorDocument ] } }) => Promise.all([
      dispatch(fetchPredecessorDocuments(indexPattern, anchorDocument.sort, sort, predecessorCount)),
      dispatch(fetchSuccessorDocuments(indexPattern, anchorDocument.sort, sort, successorCount)),
    ]))
);

export const fetchAllDocumentsWithNewParameters = (parameters) => (dispatch) => {
  dispatch(setParameters(parameters));
  return dispatch(fetchAllDocuments(
    parameters.indexPattern,
    parameters.anchorUid,
    parameters.sort,
    parameters.predecessorCount,
    parameters.successorCount,
  ));
};

export const fetchGivenPredecessorDocuments = (indexPattern, anchorSortValues, sort, count) => (dispatch) => {
  dispatch(setPredecessorCount(count));
  return dispatch(fetchPredecessorDocuments(indexPattern, anchorSortValues, sort, count));
};

export const fetchGivenSuccessorDocuments = (indexPattern, anchorSortValues, sort, count) => (dispatch) => {
  dispatch(setSuccessorCount(count));
  return dispatch(fetchSuccessorDocuments(indexPattern, anchorSortValues, sort, count));
};

// export const fetchMorePredecessorDocuments = () => (dispatch) => {
//   dispatch(increasePredecessorCount());
//   return dispatch(fetchPredecessorDocuments());
// };

// export const fetchMoreSuccessorDocuments = () => (dispatch) => {
//   dispatch(increaseSuccessorCount());
//   return dispatch(fetchSuccessorDocuments());
// };

  // const setAllRows = (state) => (predecessorRows, anchorRow, successorRows) => (
  //   state.rows.all = [
  //     ...(predecessorRows || []),
  //     ...(anchorRow ? [anchorRow] : []),
  //     ...(successorRows || []),
  //   ]
  // );

  // return {
  //   fetchAllRows,
  //   fetchAllRowsWithNewQueryParameters,
  //   fetchAnchorRow,
  //   fetchGivenPredecessorRows,
  //   fetchGivenSuccessorRows,
  //   fetchMorePredecessorRows,
  //   fetchMoreSuccessorRows,
  //   fetchPredecessorRows,
  //   fetchSuccessorRows,
  //   // setAllRows,
  // };
// }
