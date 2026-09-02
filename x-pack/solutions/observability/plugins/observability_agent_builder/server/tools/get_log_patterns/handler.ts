/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { IScopedClusterClient } from '@kbn/core/server';
import type { QueryDslQueryContainer } from '@elastic/elasticsearch/lib/api/types';
import { extractCategorizeTokens } from '@kbn/esql-utils';
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

/**
 * KQL is not an ES|QL construct and ES|QL restricts full-text functions under NOT, so both the
 * user's filter and the muted patterns ride along as a query DSL filter instead. Muting is inverted
 * from the token match Discover's patterns profile uses to drill into a category.
 */
const buildFilter = ({
  kqlFilter,
  messageField,
  mutedPatterns,
}: {
  kqlFilter?: string;
  messageField: string;
  mutedPatterns: string[];
}): QueryDslQueryContainer | undefined => {
  const mustNot = mutedPatterns.flatMap((pattern) => {
    const tokens = extractCategorizeTokens(pattern).join(' ').trim();
    return tokens
      ? [
          {
            match: {
              [messageField]: {
                query: tokens,
                operator: 'and' as const,
                fuzziness: 0,
                auto_generate_synonyms_phrase_query: false,
              },
            },
          },
        ]
      : [];
  });

  if (!kqlFilter && mustNot.length === 0) {
    return undefined;
  }

  return {
    bool: {
      ...(kqlFilter ? { filter: [{ query_string: { query: kqlFilter } }] } : {}),
      ...(mustNot.length > 0 ? { must_not: mustNot } : {}),
    },
  };
};

export async function getLogPatterns({
  esClient,
  start,
  end,
  index,
  kqlFilter,
  messageField,
  mutedPatterns = [],
}: {
  esClient: IScopedClusterClient;
  start: string;
  end: string;
  index: string;
  kqlFilter?: string;
  messageField: string;
  mutedPatterns?: string[];
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

  const filter = buildFilter({ kqlFilter, messageField: field, mutedPatterns });

  const response = await esClient.asCurrentUser.esql.query({
    query,
    params: [{ tstart: new Date(startMs).toISOString() }, { tend: new Date(endMs).toISOString() }],
    ...(filter ? { filter } : {}),
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
