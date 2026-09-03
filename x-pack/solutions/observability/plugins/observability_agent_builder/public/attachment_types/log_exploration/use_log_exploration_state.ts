/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type {
  LogExplorationData,
  LogExplorationFetchResult,
  LogExplorationTimeRange,
} from '../../../common/log_exploration';
import { mergeFetchedPatterns } from '../../../common/log_exploration';

/**
 * Surface-neutral action vocabulary: every user intent the view supports, independent of how it is
 * rendered. A second surface would reuse these names.
 */
export type LogExplorationAction =
  | { type: 'MUTE_PATTERN'; pattern: string }
  | { type: 'UNMUTE_PATTERN'; pattern: string }
  | {
      type: 'SET_TIME_RANGE';
      timeRange: LogExplorationTimeRange;
      /** Callers holding a baseline offset shift it with the window so the two stay comparable. */
      baselineEpoch?: LogExplorationTimeRange;
    }
  | { type: 'SET_BASELINE_EPOCH'; baselineEpoch: LogExplorationTimeRange }
  | { type: 'FETCH_SUCCEEDED'; result: LogExplorationFetchResult }
  | { type: 'FETCH_FAILED'; snapshot: LogExplorationData }
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
      return {
        ...state,
        timeRange: action.timeRange,
        ...(action.baselineEpoch ? { baselineEpoch: action.baselineEpoch } : {}),
      };
    case 'SET_BASELINE_EPOCH':
      return { ...state, baselineEpoch: action.baselineEpoch };
    case 'FETCH_SUCCEEDED':
      return {
        ...state,
        ...(action.result.patterns
          ? {
              patterns: mergeFetchedPatterns(
                state.patterns,
                action.result.patterns,
                state.mutedPatterns
              ),
            }
          : {}),
        ...(action.result.histogram ? { histogram: action.result.histogram } : {}),
        generatedAt: action.result.generatedAt,
      };
    // Only the window rolls back: anything the user did while the fetch was in flight stands.
    case 'FETCH_FAILED':
      return {
        ...state,
        timeRange: action.snapshot.timeRange,
        baselineEpoch: action.snapshot.baselineEpoch,
      };
    case 'PERSIST_FAILED':
      return action.snapshot;
  }
};

/**
 * Long enough that clicking down a list of patterns costs one query and one attachment version
 * rather than one of each per click, short enough that the backfill still reads as part of the mute.
 */
export const MUTE_FETCH_DEBOUNCE_MS = 300;

/** Each of these needs data the view does not have: a new window, or a pattern the last query excluded. */
const requiresImmediateFetch = (action: LogExplorationAction) =>
  action.type === 'SET_TIME_RANGE' ||
  action.type === 'SET_BASELINE_EPOCH' ||
  action.type === 'UNMUTE_PATTERN';

/**
 * The row hides locally before any I/O, so mute still reads as instant; the refetch behind it
 * backfills the top-N, which matters more now that the table shows only `MAX_PATTERNS` rows.
 */
const requiresDebouncedFetch = (action: LogExplorationAction) => action.type === 'MUTE_PATTERN';

const isAbortError = (error: unknown) => error instanceof Error && error.name === 'AbortError';

const toError = (error: unknown) => (error instanceof Error ? error : new Error(String(error)));

interface UseLogExplorationStateArgs {
  initialData: LogExplorationData;
  updateContent?: (data: unknown) => Promise<void>;
  fetchView?: (args: {
    data: LogExplorationData;
    signal: AbortSignal;
  }) => Promise<LogExplorationFetchResult>;
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
  fetchView,
  onPersistError,
}: UseLogExplorationStateArgs) => {
  const [data, rawDispatch] = useReducer(logExplorationReducer, initialData);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const dataRef = useRef(data);
  dataRef.current = data;

  // Last state the server acknowledged, so a failed write has something to revert to.
  const acknowledgedRef = useRef(initialData);
  const inFlightRef = useRef<Promise<void>>(Promise.resolve());
  const fetchInFlightRef = useRef<Promise<void>>(Promise.resolve());
  const isMountedRef = useRef(true);
  // Latest request wins: an older fetch resolving late must not overwrite a newer window.
  const requestSeqRef = useRef(0);
  const abortRef = useRef<AbortController>();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();
  // Rollback base for a mute burst: the state before its first mute, not before its last.
  const debouncedSnapshotRef = useRef<LogExplorationData>();

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
      clearTimeout(debounceTimerRef.current);
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
            dataRef.current = previous;
            rawDispatch({ type: 'PERSIST_FAILED', snapshot: previous });
          }
          onPersistError?.(toError(error));
        });
    },
    [updateContent, onPersistError]
  );

  /**
   * Refetches the view for a changed window, then writes the window and its data back in one
   * update. Persisting first would leave the attachment describing a range whose table still
   * belongs to the previous one.
   */
  const runFetch = useCallback(
    (
      next: LogExplorationData,
      snapshot: LogExplorationData,
      { persistOnFailure = false }: { persistOnFailure?: boolean } = {}
    ) => {
      if (!fetchView) {
        return;
      }
      const seq = ++requestSeqRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsFetching(true);
      setFetchError(null);

      fetchInFlightRef.current = fetchView({ data: next, signal: controller.signal }).then(
        (result) => {
          if (seq !== requestSeqRef.current || !isMountedRef.current) {
            return;
          }
          const action: LogExplorationAction = { type: 'FETCH_SUCCEEDED', result };
          const merged = logExplorationReducer(dataRef.current, action);
          dataRef.current = merged;
          rawDispatch(action);
          setIsFetching(false);
          persist(merged);
        },
        (error) => {
          if (isAbortError(error) || seq !== requestSeqRef.current || !isMountedRef.current) {
            return;
          }
          const action: LogExplorationAction = { type: 'FETCH_FAILED', snapshot };
          dataRef.current = logExplorationReducer(dataRef.current, action);
          rawDispatch(action);
          setIsFetching(false);
          setFetchError(toError(error).message);
          // A mute is written only by its own refetch, so a failed one still has to persist it.
          if (persistOnFailure) {
            persist(dataRef.current);
          }
        }
      );
    },
    [fetchView, persist]
  );

  const cancelDebouncedFetch = useCallback(() => {
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = undefined;
  }, []);

  const scheduleFetch = useCallback(
    (next: LogExplorationData, snapshot: LogExplorationData) => {
      if (!fetchView) {
        persist(next);
        return;
      }
      debouncedSnapshotRef.current = debouncedSnapshotRef.current ?? snapshot;
      cancelDebouncedFetch();
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = undefined;
        const base = debouncedSnapshotRef.current ?? snapshot;
        debouncedSnapshotRef.current = undefined;
        runFetch(dataRef.current, base, { persistOnFailure: true });
      }, MUTE_FETCH_DEBOUNCE_MS);
    },
    [cancelDebouncedFetch, fetchView, persist, runFetch]
  );

  /** Fires a waiting mute refetch now, so nothing can observe a mute that has not been written. */
  const flushDebouncedFetch = useCallback(() => {
    if (debounceTimerRef.current === undefined) {
      return;
    }
    cancelDebouncedFetch();
    const snapshot = debouncedSnapshotRef.current ?? dataRef.current;
    debouncedSnapshotRef.current = undefined;
    runFetch(dataRef.current, snapshot, { persistOnFailure: true });
  }, [cancelDebouncedFetch, runFetch]);

  const dispatch = useCallback(
    (action: LogExplorationAction) => {
      const current = dataRef.current;
      const next = logExplorationReducer(current, action);
      if (next === current) {
        return;
      }
      dataRef.current = next;
      rawDispatch(action);
      if (requiresImmediateFetch(action)) {
        cancelDebouncedFetch();
        debouncedSnapshotRef.current = undefined;
        runFetch(next, current);
      } else if (requiresDebouncedFetch(action)) {
        scheduleFetch(next, current);
      }
    },
    [cancelDebouncedFetch, runFetch, scheduleFetch]
  );

  /**
   * Streaming remounts this subtree from server data, so an agent turn started while a refetch or
   * write is in flight would read stale state. Await this before submitting a message.
   */
  const flushPendingWrites = useCallback(async () => {
    flushDebouncedFetch();
    await fetchInFlightRef.current;
    await inFlightRef.current;
  }, [flushDebouncedFetch]);

  return { data, dispatch, flushPendingWrites, isFetching, fetchError };
};
