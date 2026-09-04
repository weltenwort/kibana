/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { applyAgentKqlFilter, buildRefinementFilter } from './log_exploration_refinements';

const messageField = 'message';

describe('buildRefinementFilter', () => {
  it('returns nothing when there is nothing to narrow', () => {
    expect(buildRefinementFilter({ refinements: [], messageField })).toBeUndefined();
  });

  it('translates exclude-pattern and only-pattern into the same clause on opposite sides', () => {
    const excluded = buildRefinementFilter({
      refinements: [{ kind: 'exclude-pattern', origin: 'user', pattern: 'GET /api/v1/orders 200' }],
      messageField,
    });
    const scoped = buildRefinementFilter({
      refinements: [{ kind: 'only-pattern', origin: 'user', pattern: 'GET /api/v1/orders 200' }],
      messageField,
    });

    expect(excluded?.bool?.must_not).toEqual(scoped?.bool?.filter);
    expect(excluded?.bool?.filter).toBeUndefined();
    expect(scoped?.bool?.must_not).toBeUndefined();
  });

  it('carries a kql refinement as a query_string filter', () => {
    const filter = buildRefinementFilter({
      refinements: [{ kind: 'kql', origin: 'agent', query: 'log.level: error' }],
      messageField,
    });

    expect(filter?.bool?.filter).toEqual([{ query_string: { query: 'log.level: error' } }]);
  });

  it('drops a pattern that categorizes to no tokens rather than matching everything', () => {
    const filter = buildRefinementFilter({
      refinements: [{ kind: 'exclude-pattern', origin: 'user', pattern: '.*?' }],
      messageField,
    });

    expect(filter).toBeUndefined();
  });
});

describe('applyAgentKqlFilter', () => {
  const userExclusion = { kind: 'exclude-pattern', origin: 'user', pattern: 'noisy' } as const;

  it('keeps the existing filter when the model omits one', () => {
    const refinements = [
      userExclusion,
      { kind: 'kql', origin: 'agent', query: 'log.level: error' } as const,
    ];

    expect(applyAgentKqlFilter(refinements, undefined)).toBe(refinements);
  });

  it('replaces the filter it set last time rather than accumulating', () => {
    const refinements = applyAgentKqlFilter(
      [userExclusion, { kind: 'kql', origin: 'agent', query: 'log.level: error' }],
      'log.level: warn'
    );

    expect(refinements).toEqual([
      userExclusion,
      { kind: 'kql', origin: 'agent', query: 'log.level: warn' },
    ]);
  });
});
