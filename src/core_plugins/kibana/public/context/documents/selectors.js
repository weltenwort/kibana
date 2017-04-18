import { createSelector } from 'reselect';


export const getAnchorDocument = createSelector(
  [
    state => state.anchor,
  ],
  (anchorDocument) => (
    anchorDocument
    ? {
      ...anchorDocument,
      $$_isAnchor: true,
    }
    : null
  ),
);

export const getPredecessorDocuments = (state) => (
  state.predecessors
);

export const getSuccessorDocuments = (state) => (
  state.successors
);

export const getAllDocuments = createSelector(
  [getPredecessorDocuments, getAnchorDocument, getSuccessorDocuments],
  (predecessors, anchor, successors) => (
    [...predecessors, anchor, ...successors]
  ),
);
