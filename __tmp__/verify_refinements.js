const KIBANA = 'http://localhost:5601';
const AUTH = 'Basic ' + Buffer.from('elastic:changeme').toString('base64');

const post = async (path, body) => {
  const res = await fetch(KIBANA + path, {
    method: 'POST',
    headers: {
      Authorization: AUTH,
      'Content-Type': 'application/json',
      'kbn-xsrf': 'true',
      'x-elastic-internal-origin': 'kibana',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  return json;
};

const source = {
  index: 'logs-poc-default',
  messageField: 'message',
  timeRange: { start: 'now-24h', end: 'now' },
};
const view = {
  type: 'volume-comparison',
  baselineEpoch: { start: 'now-48h', end: 'now-24h' },
};

const patterns = (refinements) =>
  post('/internal/observability_agent_builder/log_exploration/patterns', {
    source,
    refinements,
    view: { type: 'pattern-table' },
  }).then((r) => r.patterns);

const volume = (refinements) =>
  post('/internal/observability_agent_builder/log_exploration/volume_comparison', {
    source,
    refinements,
    view,
  }).then((r) => r.histogram.current.reduce((a, b) => a + b, 0));

const main = async () => {
  const base = await patterns([]);
  const top = base[0];
  console.log('top pattern :', top.pattern);
  console.log('its count   :', top.count);

  const total = await volume([]);
  const only = await volume([{ kind: 'only-pattern', origin: 'user', pattern: top.pattern }]);
  const excluded = await volume([
    { kind: 'exclude-pattern', origin: 'user', pattern: top.pattern },
  ]);

  const patExcluded = await patterns([
    { kind: 'exclude-pattern', origin: 'user', pattern: top.pattern },
  ]);
  const patOnly = await patterns([{ kind: 'only-pattern', origin: 'user', pattern: top.pattern }]);

  const check = (label, actual, expected) =>
    console.log(
      `${label.padEnd(38)} actual=${String(actual).padEnd(6)} expected=${String(expected).padEnd(6)} ${
        actual === expected ? 'PASS' : 'FAIL'
      }`
    );

  console.log('\nvolume-comparison route');
  check('unfiltered total', total, 3685);
  check('only-pattern == that pattern count', only, top.count);
  check('exclude-pattern == total - count', excluded, total - top.count);

  console.log('\npatterns route');
  check(
    'exclude drops it from the table',
    patExcluded.some((p) => p.pattern === top.pattern),
    false
  );
  check('exclude still backfills to 8', patExcluded.length, 8);
  check('only leaves exactly that row', patOnly.length, 1);
  check('only keeps its count', patOnly[0]?.count, top.count);
};

main().catch((e) => {
  console.error('FAILED', e.message);
  process.exit(1);
});
