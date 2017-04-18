import { selectors as documentsSelectors } from './documents';
import { selectors as loadingStatusSelectors } from './loading_status';
import { selectors as parametersSelectors } from './parameters';


export const getContextAppState = (state) => state.contextApp;

// module sub-states

export const getParametersState = (state) => getContextAppState(state).parameters;

export const getDocumentsState = (state) => getContextAppState(state).documents;

export const getLoadingStatusState = (state) => getContextAppState(state).loadingStatus;

// documents module

export const getAllDocuments = (state) => documentsSelectors.getAllDocuments(
  getDocumentsState(state),
);

export const getPredecessorDocuments = (state) => documentsSelectors.getPredecessorDocuments(
  getDocumentsState(state),
);

export const getSuccessorDocuments = (state) => documentsSelectors.getSuccessorDocuments(
  getDocumentsState(state),
);

// parameters module

export const getPredecessorCountParameter = (state) => parametersSelectors.getPredecessorCountParameter(
  getParametersState(state),
);

export const getSuccessorCountParameter = (state) => parametersSelectors.getSuccessorCountParameter(
  getParametersState(state),
);

export const getIndexPatternParameter = (state) => (
  parametersSelectors.getIndexPatternParameter(state.parameters)
);

export const getStepSizeParameter = (state) => (
  parametersSelectors.getStepSizeParameter(state.parameters)
);

export const getSortingParameter = (state) => (
  parametersSelectors.getSortingParameter(state.parameters)
);

export const getColumnsParameter = (state) => (
  parametersSelectors.getColumnsParameter(state.parameters)
);

export const getAnchorUidParameter = (state) => (
  parametersSelectors.getAnchorUidParameter(state.parameters)
);

export const hasFewerPredecessorDocuments = (state) => (
  getPredecessorCountParameter(state) > getPredecessorDocuments(state).length
);

export const hasFewerSuccessorDocuments = (state) => (
  getSuccessorCountParameter(state) > getSuccessorDocuments(state).length
);

// loadingStatus module

export const hasFailedLoadingAnchorDocument = (state) => (
  loadingStatusSelectors.hasFailedLoadingAnchorDocument(state.loadingStatus)
);

export const hasLoadedPredecessorDocuments = (state) => (
  loadingStatusSelectors.hasLoadedPredecessorDocuments(state.loadingStatus)
);

export const hasLoadedSuccessorDocuments = (state) => (
  loadingStatusSelectors.hasLoadedSuccessorDocuments(state.loadingStatus)
);

export const isLoadingAnchorDocument = (state) => (
  loadingStatusSelectors.isLoadingAnchorDocument(state.loadingStatus)
);

export const isLoadingPredecessorDocuments = (state) => (
  loadingStatusSelectors.isLoadingPredecessorDocuments(state.loadingStatus)
);

export const isLoadingSuccessorDocuments = (state) => (
  loadingStatusSelectors.isLoadingSuccessorDocuments(state.loadingStatus)
);
