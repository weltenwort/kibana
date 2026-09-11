/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/* eslint-disable no-console */

// Seeds the log exploration PoC dataset. Throwaway: node __tmp__/seed_logs_poc.js

const ES = 'http://localhost:9200';
const AUTH = 'Basic ' + Buffer.from('elastic:changeme').toString('base64');
const INDEX = 'logs-poc-default';

// The head of the distribution: distinctive, high volume, what the user mutes first.
const HEAD_PATTERNS = [
  { tpl: (i) => `GET /api/v1/orders/${1000 + i} 200 in ${20 + (i % 80)}ms`, count: 720, level: 'info', service: 'orders' },
  { tpl: (i) => `Cache miss for key session:${i}`, count: 540, level: 'info', service: 'auth' },
  { tpl: () => `User authenticated successfully`, count: 360, level: 'info', service: 'auth' },
  { tpl: () => `Connection timeout to database replica after 30000ms`, count: 180, level: 'error', service: 'inventory', burst: true },
  { tpl: () => `Failed to acquire lock on resource inventory, retrying`, count: 150, level: 'error', service: 'inventory', burst: true },
  { tpl: (i) => `Scheduled job cleanup expired carts finished in ${100 + (i % 50)}ms`, count: 120, level: 'info', service: 'checkout' },
  { tpl: () => `Payment gateway returned error code 502`, count: 90, level: 'error', service: 'checkout', burst: true },
];

/**
 * The tail exists so the total exceeds the tool's `LIMIT 25`: without it, muting can never promote a
 * new pattern into the top-N and the refetch backfill is untestable. Each message uses a distinct
 * vocabulary so CATEGORIZE keeps them apart.
 */
const TAIL_MESSAGES = [
  ['Retry budget exhausted for upstream shipping service', 'warn', 'shipping'],
  ['Kafka consumer lag exceeded threshold on topic orders', 'warn', 'orders'],
  ['Disk usage above 85 percent on volume var lib data', 'warn', 'platform'],
  ['TLS handshake failed with peer certificate expired', 'error', 'gateway'],
  ['Rate limit applied to client key partner-api', 'warn', 'gateway'],
  ['Feature flag evaluation defaulted to control variant', 'info', 'platform'],
  ['Background reindex task completed with zero conflicts', 'info', 'search'],
  ['Session token refreshed ahead of expiry window', 'info', 'auth'],
  ['Warehouse stock reservation released after cancellation', 'info', 'inventory'],
  ['Email notification queued for delivery batch', 'info', 'notifications'],
  ['Search query rewritten to use cached filter clause', 'info', 'search'],
  ['Currency conversion rate fetched from provider fixer', 'info', 'checkout'],
  ['Webhook delivery attempt returned status 429', 'warn', 'notifications'],
  ['Audit trail entry persisted for privileged operation', 'info', 'auth'],
  ['Thread pool queue depth increased beyond soft limit', 'warn', 'platform'],
  ['Idempotency key collision detected on submit endpoint', 'error', 'checkout'],
  ['Shipping label generation deferred to async worker', 'info', 'shipping'],
  ['Fraud score computed below manual review threshold', 'info', 'checkout'],
  ['Config reload picked up new upstream endpoint list', 'info', 'gateway'],
  ['Garbage collection pause exceeded target duration', 'warn', 'platform'],
  ['Read replica promoted after primary heartbeat loss', 'error', 'inventory'],
  ['Bulk import rejected malformed row at offset', 'error', 'search'],
  ['Coupon validation failed expired promotional code', 'warn', 'checkout'],
  ['Metrics exporter dropped samples due to backpressure', 'warn', 'platform'],
  ['Deprecated api version requested by mobile client', 'warn', 'gateway'],
];

const PATTERNS = [
  ...HEAD_PATTERNS,
  // Strictly descending so the top-25 cut is unambiguous and the promoted pattern is predictable.
  ...TAIL_MESSAGES.map(([message, level, service], index) => ({
    tpl: () => message,
    count: 85 - index * 2,
    level,
    service,
    // One tail pattern joins the burst, so a spike is not explainable by the head alone.
    burst: message.startsWith('TLS handshake'),
  })),
];

/**
 * Volume shape. Spread evenly, every bucket holds the same count, so a current range and its
 * baseline epoch agree to within rounding and there is no change for the volume comparison to
 * describe. `BURST_SHARE` of a bursting pattern's documents are instead packed into a short window
 * near the end of the span — three error patterns failing together. Timestamps move; counts do not,
 * so the top-N cut, the strict descent and the pattern a mute promotes are all unchanged.
 */
const BURST_SHARE = 0.7;
const BURST_FROM = 0.88;
const BURST_TO = 0.93;

/** Fraction of the span, in [0, 1), at which document `i` of `count` lands. */
const positionOf = (i, count, burst) => {
  if (!burst) {
    return i / count;
  }
  const burstCount = Math.floor(count * BURST_SHARE);
  if (i < burstCount) {
    return BURST_FROM + (i / burstCount) * (BURST_TO - BURST_FROM);
  }
  return (i - burstCount) / (count - burstCount);
};

const request = async (path, method, body) => {
  const res = await fetch(`${ES}${path}`, {
    method,
    headers: { 'Content-Type': body?.ndjson ? 'application/x-ndjson' : 'application/json', Authorization: AUTH },
    body: body?.ndjson ?? (body ? JSON.stringify(body) : undefined),
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
};

const run = async () => {
  await fetch(`${ES}/_data_stream/${INDEX}`, { method: 'DELETE', headers: { Authorization: AUTH } });

  // Spread across the last 6 hours so "now-1h" and wider windows both return data.
  const endMs = Date.now();
  const startMs = endMs - 6 * 60 * 60 * 1000;
  const docs = [];
  for (const { tpl, count, level, service, burst } of PATTERNS) {
    for (let i = 0; i < count; i++) {
      docs.push({
        '@timestamp': new Date(
          startMs + Math.floor(positionOf(i, count, burst) * (endMs - startMs))
        ).toISOString(),
        message: tpl(i),
        'log.level': level,
        'service.name': service,
      });
    }
  }

  const ndjson =
    docs.map((d) => `${JSON.stringify({ create: {} })}\n${JSON.stringify(d)}`).join('\n') + '\n';
  const result = await request(`/${INDEX}/_bulk?refresh=true`, 'POST', { ndjson });
  console.log(`indexed=${docs.length} errors=${result.errors}`);

  const counted = await request(`/${INDEX}/_count`, 'GET');
  console.log(`count=${counted.count} patterns=${PATTERNS.length}`);
};

run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
