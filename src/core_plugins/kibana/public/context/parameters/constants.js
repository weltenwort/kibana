import {
  initialParametersState,
} from './initial_state';

export const MAX_CONTEXT_SIZE = 10000; // Elasticsearch's default maximum size limit
export const MIN_CONTEXT_SIZE = 0;
export const PARAMETER_KEYS = Object.keys(initialParametersState);

// Actions
export const SET_PARAMETERS = 'kibana/context/SET_PARAMETERS';
export const SET_PREDECESSOR_COUNT = 'kibana/context/SET_PREDECESSOR_COUNT';
export const SET_SUCCESSOR_COUNT = 'kibana/context/SET_SUCCESSOR_COUNT';
