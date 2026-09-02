/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { LogExplorationData, LogExplorationTimeRange } from '../../../common/log_exploration';

/**
 * Surface-neutral action vocabulary: every user intent the view supports, independent of how it is
 * rendered. A second surface would reuse these names.
 */
export type LogExplorationAction =
  | { type: 'MUTE_PATTERN'; pattern: string }
  | { type: 'UNMUTE_PATTERN'; pattern: string }
  | { type: 'SET_TIME_RANGE'; timeRange: LogExplorationTimeRange }
  | { type: 'SET_BASELINE_EPOCH'; baselineEpoch: LogExplorationTimeRange }
  | { type: 'PERSIST_FAILED'; snapshot: LogExplorationData };

export const logExplorationReducer = (
  state: LogExplorationData,
  action: LogExplorationAction
): LogExplorationData => {
  switch (action.type) {
    case 'MUTE_PATTERN':
      return state.mutedPatterns.includes(action.pattern)
        ? state
        : { ...state, mutedPatterns: [...state.mutedPatterns, action.pattern] };
    case 'UNMUTE_PATTERN':
      return {
        ...state,
        mutedPatterns: state.mutedPatterns.filter((pattern) => pattern !== action.pattern),
      };
    case 'SET_TIME_RANGE':
      return { ...state, timeRange: action.timeRange };
    case 'SET_BASELINE_EPOCH':
      return { ...state, baselineEpoch: action.baselineEpoch };
    case 'PERSIST_FAILED':
      return action.snapshot;
  }
};

const isPersistable = (action: LogExplorationAction) => action.type !== 'PERSIST_FAILED';

interface UseLogExplorationStateArgs {
  initialData: LogExplorationData;
  updateContent?: (data: unknown) => Promise<void>;
  onPersistError?: (error: Error) => void;
}

/**
 * The subtree is keyed on `id:version` and content writes deliberately do not invalidate the
 * conversation, so props stay frozen for the whole loop. Every mutation must therefore be derived
 * from local state, never from `props.attachment.data`.
 */
export const useLogExplorationState = ({
  initialData,
  updateContent,
  onPersistError,
}: UseLogExplorationStateArgs) => {
  const [data, rawDispatch] = useReducer(logExplorationReducer, initialData);

  const dataRef = useRef(data);
  dataRef.current = data;

  // Last state the server acknowledged, so a failed write has something to revert to.
  const acknowledgedRef = useRef(initialData);
  const inFlightRef = useRef<Promise<void>>(Promise.resolve());
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const persist = useCallback(
    (next: LogExplorationData) => {
      if (!updateContent) {
        return;
      }
      const previous = acknowledgedRef.current;
      // Serialise writes: out-of-order responses would otherwise resurrect superseded state.
      inFlightRef.current = inFlightRef.current
        .then(() => updateContent(next))
        .then(() => {
          acknowledgedRef.current = next;
        })
        .catch((error) => {
          if (isMountedRef.current) {
            rawDispatch({ type: 'PERSIST_FAILED', snapshot: previous });
          }
          onPersistError?.(error instanceof Error ? error : new Error(String(error)));
        });
    },
    [updateContent, onPersistError]
  );

  const dispatch = useCallback(
    (action: LogExplorationAction) => {
      const next = logExplorationReducer(dataRef.current, action);
      if (next === dataRef.current) {
        return;
      }
      dataRef.current = next;
      rawDispatch(action);
      if (isPersistable(action)) {
        persist(next);
      }
    },
    [persist]
  );

  /**
   * Streaming remounts this subtree from server data, so an agent turn started while a write is in
   * flight would read stale state. Await this before submitting a message.
   */
  const flushPendingWrites = useCallback(() => inFlightRef.current, []);

  return { data, dispatch, flushPendingWrites };
};
