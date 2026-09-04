/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { act, renderHook } from '@testing-library/react';
import type { LogExplorationData, LogExplorationRefinement } from '../../../common/log_exploration';
import { refinementKey } from '../../../common/log_exploration';
import {
  MUTE_FETCH_DEBOUNCE_MS,
  logExplorationReducer,
  useLogExplorationState,
} from './use_log_exploration_state';
import type { LogExplorationAction } from './use_log_exploration_state';

const pattern = (name: string, count: number) => ({ pattern: name, count, sparkline: [] });

const exclude = (name: string): LogExplorationRefinement => ({
  kind: 'exclude-pattern',
  origin: 'user',
  pattern: name,
});

const baseData: LogExplorationData = {
  source: { index: 'logs-*', messageField: 'message', timeRange: { start: 'now-1h', end: 'now' } },
  refinements: [exclude('noisy')],
  view: { type: 'pattern-table' },
  result: {
    type: 'pattern-table',
    patterns: [pattern('noisy', 10), pattern('kept', 5)],
    generatedAt: '2026-01-01T00:00:00.000Z',
  },
};

const patternsOf = (data: LogExplorationData) =>
  data.result.type === 'pattern-table' ? data.result.patterns : undefined;

const keysOf = (data: LogExplorationData) => data.refinements.map(refinementKey);

describe('logExplorationReducer', () => {
  describe('ADD_REFINEMENT', () => {
    it('is idempotent, so a row clicked twice before its refetch lands stays one refinement', () => {
      const next = logExplorationReducer(baseData, {
        type: 'ADD_REFINEMENT',
        refinement: exclude('noisy'),
      });

      expect(next).toBe(baseData);
    });

    it('keeps refinements of different kinds targeting the same pattern apart', () => {
      const next = logExplorationReducer(baseData, {
        type: 'ADD_REFINEMENT',
        refinement: { kind: 'only-pattern', origin: 'user', pattern: 'noisy' },
      });

      expect(keysOf(next)).toEqual(['exclude-pattern:noisy', 'only-pattern:noisy']);
    });

    it('replaces an existing scope rather than ANDing two that can never both match', () => {
      const scoped = logExplorationReducer(baseData, {
        type: 'ADD_REFINEMENT',
        refinement: { kind: 'only-pattern', origin: 'user', pattern: 'first' },
      });

      const rescoped = logExplorationReducer(scoped, {
        type: 'ADD_REFINEMENT',
        refinement: { kind: 'only-pattern', origin: 'user', pattern: 'second' },
      });

      expect(keysOf(rescoped)).toEqual(['exclude-pattern:noisy', 'only-pattern:second']);
    });
  });

  describe('FETCH_SUCCEEDED', () => {
    it('keeps the previously seen entry for excluded patterns the query no longer returns', () => {
      const next = logExplorationReducer(baseData, {
        type: 'FETCH_SUCCEEDED',
        result: {
          type: 'pattern-table',
          patterns: [pattern('kept', 7), pattern('new', 3)],
          generatedAt: '2026-01-01T01:00:00.000Z',
        },
      });

      expect(patternsOf(next)).toEqual([
        pattern('kept', 7),
        pattern('new', 3),
        pattern('noisy', 10),
      ]);
      expect(next.result.generatedAt).toBe('2026-01-01T01:00:00.000Z');
    });

    it('does not retain patterns that are not excluded', () => {
      const next = logExplorationReducer(
        { ...baseData, refinements: [] },
        {
          type: 'FETCH_SUCCEEDED',
          result: {
            type: 'pattern-table',
            patterns: [pattern('new', 3)],
            generatedAt: '2026-01-01T01:00:00.000Z',
          },
        }
      );

      expect(patternsOf(next)).toEqual([pattern('new', 3)]);
    });
  });

  describe('FETCH_FAILED', () => {
    it('rolls back the window without discarding what the user did meanwhile', () => {
      const withNewWindow = logExplorationReducer(baseData, {
        type: 'SET_TIME_RANGE',
        timeRange: { start: 'now-24h', end: 'now' },
      });
      const withLaterExclusion = logExplorationReducer(withNewWindow, {
        type: 'ADD_REFINEMENT',
        refinement: exclude('kept'),
      });

      const next = logExplorationReducer(withLaterExclusion, {
        type: 'FETCH_FAILED',
        snapshot: baseData,
      });

      expect(next.source.timeRange).toEqual(baseData.source.timeRange);
      expect(keysOf(next)).toEqual(['exclude-pattern:noisy', 'exclude-pattern:kept']);
    });
  });

  describe('SET_TIME_RANGE', () => {
    it('leaves the baseline epoch alone when the caller does not shift it', () => {
      const withBaseline: LogExplorationData = {
        ...baseData,
        view: { type: 'volume-comparison', baselineEpoch: { start: 'now-2h', end: 'now-1h' } },
      };

      const next = logExplorationReducer(withBaseline, {
        type: 'SET_TIME_RANGE',
        timeRange: { start: 'now-24h', end: 'now' },
      });

      expect(next.view).toEqual(withBaseline.view);
    });
  });
});

describe('useLogExplorationState', () => {
  const generatedAt = '2026-01-01T02:00:00.000Z';

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const setup = (
    fetchView = jest.fn().mockResolvedValue({ type: 'pattern-table', patterns: [], generatedAt })
  ) => {
    const updateContent = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useLogExplorationState({ initialData: baseData, updateContent, fetchView })
    );
    return { result, updateContent, fetchView };
  };

  const requestedIn = (call: unknown[]) => (call[0] as { data: LogExplorationData }).data;
  const writtenIn = (call: unknown[]) => call[0] as LogExplorationData;

  it('collapses a burst of exclusions into one refetch', async () => {
    const { result, fetchView } = setup();

    act(() => {
      result.current.dispatch({ type: 'ADD_REFINEMENT', refinement: exclude('kept') });
      result.current.dispatch({ type: 'ADD_REFINEMENT', refinement: exclude('other') });
    });
    expect(fetchView).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(MUTE_FETCH_DEBOUNCE_MS);
    });

    expect(fetchView).toHaveBeenCalledTimes(1);
    expect(keysOf(requestedIn(fetchView.mock.calls[0]))).toEqual([
      'exclude-pattern:noisy',
      'exclude-pattern:kept',
      'exclude-pattern:other',
    ]);
  });

  it('fires a waiting exclusion refetch on flush rather than waiting out the timer', async () => {
    const { result, updateContent, fetchView } = setup();

    act(() => {
      result.current.dispatch({ type: 'ADD_REFINEMENT', refinement: exclude('kept') });
    });
    await act(async () => {
      await result.current.flushPendingWrites();
    });

    expect(fetchView).toHaveBeenCalledTimes(1);
    expect(keysOf(writtenIn(updateContent.mock.calls[0]))).toEqual([
      'exclude-pattern:noisy',
      'exclude-pattern:kept',
    ]);
  });

  it('persists the exclusion when its refetch fails, since nothing else writes it', async () => {
    const { result, updateContent } = setup(jest.fn().mockRejectedValue(new Error('boom')));

    act(() => {
      result.current.dispatch({ type: 'ADD_REFINEMENT', refinement: exclude('kept') });
    });
    await act(async () => {
      jest.advanceTimersByTime(MUTE_FETCH_DEBOUNCE_MS);
    });

    expect(keysOf(writtenIn(updateContent.mock.calls[0]))).toEqual([
      'exclude-pattern:noisy',
      'exclude-pattern:kept',
    ]);
  });

  it('lets a range change supersede a pending exclusion refetch without losing it', async () => {
    const { result, fetchView } = setup();

    act(() => {
      result.current.dispatch({ type: 'ADD_REFINEMENT', refinement: exclude('kept') });
      result.current.dispatch({
        type: 'SET_TIME_RANGE',
        timeRange: { start: 'now-24h', end: 'now' },
      });
    });
    await act(async () => {
      jest.advanceTimersByTime(MUTE_FETCH_DEBOUNCE_MS);
    });

    expect(fetchView).toHaveBeenCalledTimes(1);
    const requested = requestedIn(fetchView.mock.calls[0]);
    expect(requested.source.timeRange).toEqual({ start: 'now-24h', end: 'now' });
    expect(keysOf(requested)).toEqual(['exclude-pattern:noisy', 'exclude-pattern:kept']);
  });

  it('refetches immediately when a refinement is removed, since the query excluded its rows', async () => {
    const { result, fetchView } = setup();

    await act(async () => {
      result.current.dispatch({ type: 'REMOVE_REFINEMENT', key: 'exclude-pattern:noisy' });
    });

    expect(fetchView).toHaveBeenCalledTimes(1);
    expect(keysOf(requestedIn(fetchView.mock.calls[0]))).toEqual([]);
  });

  it.each([
    [
      'a scope whose refetch fails',
      {
        type: 'ADD_REFINEMENT',
        refinement: { kind: 'only-pattern', origin: 'user', pattern: 'p' },
      },
      ['exclude-pattern:noisy', 'only-pattern:p'],
    ],
    [
      'a removal whose refetch fails',
      { type: 'REMOVE_REFINEMENT', key: 'exclude-pattern:noisy' },
      [],
    ],
  ] as Array<[string, LogExplorationAction, string[]]>)(
    'persists %s, so an agent turn cannot read a server that never heard about it',
    async (_label, action, expected) => {
      const { result, updateContent } = setup(jest.fn().mockRejectedValue(new Error('boom')));

      await act(async () => {
        result.current.dispatch(action);
      });

      expect(updateContent).toHaveBeenCalledTimes(1);
      expect(keysOf(writtenIn(updateContent.mock.calls[0]))).toEqual(expected);
    }
  );

  it('does not persist a failed range change, which rolls back instead', async () => {
    const { result, updateContent } = setup(jest.fn().mockRejectedValue(new Error('boom')));

    await act(async () => {
      result.current.dispatch({
        type: 'SET_TIME_RANGE',
        timeRange: { start: 'now-24h', end: 'now' },
      });
    });

    expect(updateContent).not.toHaveBeenCalled();
  });
});
