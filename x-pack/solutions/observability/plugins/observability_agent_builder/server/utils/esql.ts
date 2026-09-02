/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/**
 * ES|QL has no parameter binding for identifiers, so index patterns and field names are
 * interpolated into the query string. Allow-list them rather than trying to escape.
 */

const INDEX_PATTERN_RE = /^[a-zA-Z0-9_\-.*,:+@]+$/;
const FIELD_NAME_RE = /^[a-zA-Z0-9_.@]+$/;

export function assertSafeIndexPattern(index: string): string {
  if (!INDEX_PATTERN_RE.test(index)) {
    throw new Error(`Unsupported characters in index pattern "${index}"`);
  }
  return index;
}

export function assertSafeFieldName(field: string): string {
  if (!FIELD_NAME_RE.test(field)) {
    throw new Error(`Unsupported characters in field name "${field}"`);
  }
  return field;
}

/**
 * Picks a round bucket interval that yields roughly `targetBuckets` buckets, so two epochs of the
 * same duration always land on an identical grid and can be overlaid by index.
 */
export function pickBucketInterval(
  durationMs: number,
  targetBuckets: number
): { literal: string; ms: number } {
  const candidates: Array<{ literal: string; ms: number }> = [
    { literal: '1 second', ms: 1000 },
    { literal: '5 seconds', ms: 5 * 1000 },
    { literal: '30 seconds', ms: 30 * 1000 },
    { literal: '1 minute', ms: 60 * 1000 },
    { literal: '5 minutes', ms: 5 * 60 * 1000 },
    { literal: '10 minutes', ms: 10 * 60 * 1000 },
    { literal: '30 minutes', ms: 30 * 60 * 1000 },
    { literal: '1 hour', ms: 60 * 60 * 1000 },
    { literal: '3 hours', ms: 3 * 60 * 60 * 1000 },
    { literal: '12 hours', ms: 12 * 60 * 60 * 1000 },
    { literal: '1 day', ms: 24 * 60 * 60 * 1000 },
    { literal: '7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  ];

  const ideal = durationMs / targetBuckets;
  return candidates.find((candidate) => candidate.ms >= ideal) ?? candidates[candidates.length - 1];
}
