/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { QueryDslQueryContainer } from '@elastic/elasticsearch/lib/api/types';
import { extractCategorizeTokens } from '@kbn/esql-utils';
import type { LogExplorationRefinement } from '../../common/log_exploration';
import { addRefinement } from '../../common/log_exploration';

/**
 * Matches the documents a `CATEGORIZE` pattern covers, the way Discover's patterns profile drills
 * into a category. Excluding and scoping are the same clause on opposite sides of the bool query.
 */
const patternClause = (
  pattern: string,
  messageField: string
): QueryDslQueryContainer | undefined => {
  const tokens = extractCategorizeTokens(pattern).join(' ').trim();
  if (!tokens) {
    return undefined;
  }
  return {
    match: {
      [messageField]: {
        query: tokens,
        operator: 'and' as const,
        fuzziness: 0,
        auto_generate_synonyms_phrase_query: false,
      },
    },
  };
};

/**
 * The one translation from refinements to Elasticsearch, shared by every view, so a narrowing the
 * user applied cannot reach one lens and miss another. KQL rides along here rather than in the
 * ES|QL text because ES|QL has no KQL construct and restricts full-text functions under NOT.
 */
export const buildRefinementFilter = ({
  refinements,
  messageField,
}: {
  refinements: LogExplorationRefinement[];
  messageField: string;
}): QueryDslQueryContainer | undefined => {
  const filter: QueryDslQueryContainer[] = [];
  const mustNot: QueryDslQueryContainer[] = [];

  for (const refinement of refinements) {
    switch (refinement.kind) {
      case 'exclude-pattern': {
        const clause = patternClause(refinement.pattern, messageField);
        if (clause) {
          mustNot.push(clause);
        }
        break;
      }
      case 'only-pattern': {
        const clause = patternClause(refinement.pattern, messageField);
        if (clause) {
          filter.push(clause);
        }
        break;
      }
      case 'kql':
        filter.push({ query_string: { query: refinement.query } });
        break;
    }
  }

  if (filter.length === 0 && mustNot.length === 0) {
    return undefined;
  }

  return {
    bool: {
      ...(filter.length > 0 ? { filter } : {}),
      ...(mustNot.length > 0 ? { must_not: mustNot } : {}),
    },
  };
};

/**
 * Folds a tool's `kqlFilter` parameter into the carried-forward refinements. A filter the model
 * passes replaces the one it set last time; omitting it keeps whatever is there, the same way
 * omitting `start` keeps the user's window. Only a removal in the view clears one.
 */
export const applyAgentKqlFilter = (
  refinements: LogExplorationRefinement[],
  kqlFilter: string | undefined
): LogExplorationRefinement[] => {
  if (kqlFilter === undefined) {
    return refinements;
  }
  const withoutPreviousAgentFilter = refinements.filter(
    (refinement) => !(refinement.kind === 'kql' && refinement.origin === 'agent')
  );
  return addRefinement(withoutPreviousAgentFilter, {
    kind: 'kql',
    origin: 'agent',
    query: kqlFilter,
  });
};
