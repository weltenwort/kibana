import {
  FETCH_ANCHOR_DOCUMENT_SUCCESS,
  FETCH_PREDECESSOR_DOCUMENTS_SUCCESS,
  FETCH_SUCCESSOR_DOCUMENTS_SUCCESS,
} from './constants';


const defaultDocumentsState = {
  anchor: null,
  predecessors: [],
  successors: [],
};

export function documentsReducer(state = defaultDocumentsState, action) {
  switch (action.type) {
    case FETCH_ANCHOR_DOCUMENT_SUCCESS:
      return {
        ...state,
        anchor: action.payload.hits.hits[0],
      };
    case FETCH_PREDECESSOR_DOCUMENTS_SUCCESS:
      return {
        ...state,
        predecessors: action.payload.hits.hits.slice().reverse(),
      };
    case FETCH_SUCCESSOR_DOCUMENTS_SUCCESS:
      return {
        ...state,
        successors: action.payload.hits.hits,
      };
    default:
      return state;
  }
}
