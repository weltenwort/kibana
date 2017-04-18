import _ from 'lodash';

import {
  MAX_CONTEXT_SIZE,
  MIN_CONTEXT_SIZE,
  PARAMETER_KEYS,
  SET_PREDECESSOR_COUNT,
  SET_PARAMETERS,
  SET_SUCCESSOR_COUNT,
} from './constants';
import {
  initialParametersState,
} from './initial_state';


export function parametersReducer(state = initialParametersState, action) {
  switch(action.type) {
    case SET_PREDECESSOR_COUNT:
      return {
        ...state,
        predecessorCount: clamp(
          MIN_CONTEXT_SIZE,
          MAX_CONTEXT_SIZE,
          action.payload,
        ),
      };
    case SET_SUCCESSOR_COUNT:
      return {
        ...state,
        successorCount: clamp(
          MIN_CONTEXT_SIZE,
          MAX_CONTEXT_SIZE,
          action.payload,
        ),
      };
    case SET_PARAMETERS:
      return {
        ...state,
        ...(_.pick(action.payload, PARAMETER_KEYS)),
      };
    default:
      return state;
  }
}

function clamp(minimum, maximum, value) {
  return Math.max(Math.min(maximum, value), minimum);
}
