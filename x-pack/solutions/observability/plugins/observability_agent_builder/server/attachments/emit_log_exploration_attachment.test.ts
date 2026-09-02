/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { resolveRange } from './emit_log_exploration_attachment';

const FALLBACK = { start: 'now-1h', end: 'now' };
const USER_RANGE = { start: 'now-12h', end: 'now' };

describe('resolveRange', () => {
  it('keeps the range the user selected when the model asks for nothing', () => {
    expect(resolveRange({}, USER_RANGE, FALLBACK)).toEqual(USER_RANGE);
  });

  it('falls back when there is no stored range yet', () => {
    expect(resolveRange({}, undefined, FALLBACK)).toEqual(FALLBACK);
  });

  // Regression: loop state used to win unconditionally, so an empty first result trapped the agent
  // at that range forever and it could never widen the window.
  it('lets an explicit request override the stored range', () => {
    expect(resolveRange({ start: 'now-24h', end: 'now' }, USER_RANGE, FALLBACK)).toEqual({
      start: 'now-24h',
      end: 'now',
    });
  });

  it('fills the unspecified side from the stored range', () => {
    expect(resolveRange({ start: 'now-24h' }, USER_RANGE, FALLBACK)).toEqual({
      start: 'now-24h',
      end: USER_RANGE.end,
    });
  });
});
