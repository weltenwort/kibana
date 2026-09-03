/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { act, renderHook } from '@testing-library/react';
import type { LogExplorationData } from '../../../common/log_exploration';
import {
  MUTE_FETCH_DEBOUNCE_MS,
  logExplorationReducer,
  useLogExplorationState,
} from './use_log_exploration_state';

const pattern = (name: string, count: number) => ({ pattern: name, count, sparkline: [] });

const baseData: LogExplorationData = {
  type: 'pattern-table',
  index: 'logs-*',
  messageField: 'message',
  timeRange: { start: 'now-1h', end: 'now' },
  mutedPatterns: ['noisy'],
  patterns: [pattern('noisy', 10), pattern('kept', 5)],
  generatedAt: '2026-01-01T00:00:00.000Z',
};

describe('logExplorationReducer', () => {
  describe('FETCH_SUCCEEDED', () => {
    it('keeps the previously seen entry for muted patterns the query no longer returns', () => {
      const next = logExplorationReducer(baseData, {
        type: 'FETCH_SUCCEEDED',
        result: {
          patterns: [pattern('kept', 7), pattern('new', 3)],
          generatedAt: '2026-01-01T01:00:00.000Z',
        },
      });

      expect(next.patterns).toEqual([pattern('kept', 7), pattern('new', 3), pattern('noisy', 10)]);
      expect(next.generatedAt).toBe('2026-01-01T01:00:00.000Z');
    });

    it('does not retain patterns that are not muted', () => {
      const next = logExplorationReducer(
        { ...baseData, mutedPatterns: [] },
        {
          type: 'FETCH_SUCCEEDED',
          result: { patterns: [pattern('new', 3)], generatedAt: '2026-01-01T01:00:00.000Z' },
        }
      );

      expect(next.patterns).toEqual([pattern('new', 3)]);
    });
  });

  describe('FETCH_FAILED', () => {
    it('rolls back the window without discarding what the user did meanwhile', () => {
      const withNewWindow = logExplorationReducer(baseData, {
        type: 'SET_TIME_RANGE',
        timeRange: { start: 'now-24h', end: 'now' },
      });
      const withLaterMute = logExplorationReducer(withNewWindow, {
        type: 'MUTE_PATTERN',
        pattern: 'kept',
      });

      const next = logExplorationReducer(withLaterMute, {
        type: 'FETCH_FAILED',
        snapshot: baseData,
      });

      expect(next.timeRange).toEqual(baseData.timeRange);
      expect(next.mutedPatterns).toEqual(['noisy', 'kept']);
    });
  });

  describe('SET_TIME_RANGE', () => {
    it('leaves the baseline epoch alone when the caller does not shift it', () => {
      const withBaseline = { ...baseData, baselineEpoch: { start: 'now-2h', end: 'now-1h' } };

      const next = logExplorationReducer(withBaseline, {
        type: 'SET_TIME_RANGE',
        timeRange: { start: 'now-24h', end: 'now' },
      });

      expect(next.baselineEpoch).toEqual(withBaseline.baselineEpoch);
    });
  });
});

describe('useLogExplorationState', () => {
  const generatedAt = '2026-01-01T02:00:00.000Z';

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const setup = (fetchView = jest.fn().mockResolvedValue({ patterns: [], generatedAt })) => {
    const updateContent = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useLogExplorationState({ initialData: baseData, updateContent, fetchView })
    );
    return { result, updateContent, fetchView };
  };

  const mutedIn = (call: unknown[]) => (call[0] as LogExplorationData).mutedPatterns;

  it('collapses a burst of mutes into one refetch', async () => {
    const { result, fetchView } = setup();

    act(() => {
      result.current.dispatch({ type: 'MUTE_PATTERN', pattern: 'kept' });
      result.current.dispatch({ type: 'MUTE_PATTERN', pattern: 'other' });
    });
    expect(fetchView).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(MUTE_FETCH_DEBOUNCE_MS);
    });

    expect(fetchView).toHaveBeenCalledTimes(1);
    expect(fetchView.mock.calls[0][0].data.mutedPatterns).toEqual(['noisy', 'kept', 'other']);
  });

  it('fires a waiting mute refetch on flush rather than waiting out the timer', async () => {
    const { result, updateContent, fetchView } = setup();

    act(() => {
      result.current.dispatch({ type: 'MUTE_PATTERN', pattern: 'kept' });
    });
    await act(async () => {
      await result.current.flushPendingWrites();
    });

    expect(fetchView).toHaveBeenCalledTimes(1);
    expect(mutedIn(updateContent.mock.calls[0])).toEqual(['noisy', 'kept']);
  });

  it('persists the mute when its refetch fails, since nothing else writes it', async () => {
    const { result, updateContent } = setup(jest.fn().mockRejectedValue(new Error('boom')));

    act(() => {
      result.current.dispatch({ type: 'MUTE_PATTERN', pattern: 'kept' });
    });
    await act(async () => {
      jest.advanceTimersByTime(MUTE_FETCH_DEBOUNCE_MS);
    });

    expect(mutedIn(updateContent.mock.calls[0])).toEqual(['noisy', 'kept']);
  });

  it('lets a range change supersede a pending mute refetch without losing the mute', async () => {
    const { result, fetchView } = setup();

    act(() => {
      result.current.dispatch({ type: 'MUTE_PATTERN', pattern: 'kept' });
      result.current.dispatch({
        type: 'SET_TIME_RANGE',
        timeRange: { start: 'now-24h', end: 'now' },
      });
    });
    await act(async () => {
      jest.advanceTimersByTime(MUTE_FETCH_DEBOUNCE_MS);
    });

    expect(fetchView).toHaveBeenCalledTimes(1);
    expect(fetchView.mock.calls[0][0].data).toMatchObject({
      timeRange: { start: 'now-24h', end: 'now' },
      mutedPatterns: ['noisy', 'kept'],
    });
  });
});
