import _ from 'lodash';

import {
  SET_PREDECESSOR_COUNT,
  SET_PARAMETERS,
  SET_SUCCESSOR_COUNT,
} from './constants';


export const setPredecessorCount = (predecessorCount) => ({
  type: SET_PREDECESSOR_COUNT,
  payload: predecessorCount,
});

export const increasePredecessorCount = (value) => (dispatch, getState) => {
  const { queryParameters: { defaultStepSize, predecessorCount } } = getState();

  return dispatch(setPredecessorCount(
    predecessorCount + (_.isFinite(value) ? value : defaultStepSize),
  ));
};

export const setSuccessorCount = (successorCount) => ({
  type: SET_SUCCESSOR_COUNT,
  payload: successorCount,
});

export const increaseSuccessorCount = (value) => (dispatch, getState) => {
  const { queryParameters: { defaultStepSize, successorCount } } = getState();

  return dispatch(setSuccessorCount(
    successorCount + (_.isFinite(value) ? value : defaultStepSize),
  ));
};

export const setParameters = (parameters) => ({
  type: SET_PARAMETERS,
  payload: parameters,
});
