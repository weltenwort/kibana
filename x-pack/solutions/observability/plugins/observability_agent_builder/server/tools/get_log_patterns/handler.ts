/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { IScopedClusterClient } from '@kbn/core/server';
import type { LogExplorationPattern } from '../../../common/log_exploration';
import { MAX_PATTERNS, MAX_SPARKLINE_BUCKETS } from '../../../common/log_exploration';
import { parseDatemath } from '../../utils/time';
import { assertSafeFieldName, assertSafeIndexPattern } from '../../utils/esql';

const columnIndex = (columns: Array<{ name: string }>, name: string) =>
  columns.findIndex((column) => column.name === name);

const toSparkline = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .slice(0, MAX_SPARKLINE_BUCKETS)
    .map((entry) => (typeof entry === 'number' ? entry : 0));
};

export async function getLogPatterns({
  esClient,
  start,
  end,
  index,
  kqlFilter,
  messageField,
}: {
  esClient: IScopedClusterClient;
  start: string;
  end: string;
  index: string;
  kqlFilter?: string;
  messageField: string;
}): Promise<LogExplorationPattern[]> {
  const startMs = parseDatemath(start);
  const endMs = parseDatemath(end, { roundUp: true });

  const field = assertSafeFieldName(messageField);
  const query = [
    `FROM ${assertSafeIndexPattern(index)}`,
    `| WHERE @timestamp >= ?tstart AND @timestamp <= ?tend`,
    `| WHERE ${field} IS NOT NULL`,
    `| STATS count = COUNT(*), sparkline = SPARKLINE(COUNT(*), @timestamp, ${MAX_SPARKLINE_BUCKETS}, ?tstart, ?tend) BY pattern = CATEGORIZE(${field})`,
    `| SORT count DESC`,
    `| LIMIT ${MAX_PATTERNS}`,
  ].join('\n');

  const response = await esClient.asCurrentUser.esql.query({
    query,
    params: [{ tstart: new Date(startMs).toISOString() }, { tend: new Date(endMs).toISOString() }],
    // KQL is not an ES|QL construct, so it rides along as a query DSL filter.
    ...(kqlFilter ? { filter: { query_string: { query: kqlFilter } } } : {}),
  });

  const columns = response.columns ?? [];
  const patternIdx = columnIndex(columns, 'pattern');
  const countIdx = columnIndex(columns, 'count');
  const sparklineIdx = columnIndex(columns, 'sparkline');

  if (patternIdx === -1 || countIdx === -1) {
    return [];
  }

  return (response.values ?? []).flatMap((row) => {
    const pattern = row[patternIdx];
    if (typeof pattern !== 'string') {
      return [];
    }
    return [
      {
        pattern,
        count: Number(row[countIdx] ?? 0),
        sparkline: sparklineIdx === -1 ? [] : toSparkline(row[sparklineIdx]),
      },
    ];
  });
}
