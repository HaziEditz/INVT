/**
 * FIX-S + pendingjobs-normalizer download hygiene.
 * Preserve heal behaviour; exclude load-test tenants; slower safe cadence.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'server.js'), 'utf8');

test('load-test company helper excludes bwtest harness ids', () => {
  assert.match(src, /function _isSyntheticLoadTestCompanyId/);
  assert.match(src, /bwtesttariff/);
  assert.match(src, /_isLoadTest/);
});

test('FIX-S company list filters load-test tenants', () => {
  const idx = src.indexOf('function _fixsCollectCompanyIds');
  assert.ok(idx > 0);
  const slice = src.slice(idx, idx + 1200);
  assert.match(slice, /_isSyntheticLoadTestCompanyId/);
});

test('FIX-S interval is at least 30 minutes', () => {
  const m = src.match(/_FIXS_INTERVAL_MS\s*=\s*([^;]+);/);
  assert.ok(m);
  // eslint-disable-next-line no-new-func
  const ms = Function(`return (${m[1]})`)();
  assert.ok(ms >= 30 * 60 * 1000, 'expected >= 30 min, got ' + ms);
});

test('FIX-S still scans allbookings + completedJobs + closedJobs per cid', () => {
  assert.match(src, /async function reconcileClosedJobsFromFirebase/);
  assert.match(src, /name: 'allbookings'/);
  assert.match(src, /name: 'completedJobs'/);
  assert.match(src, /firebasePath: 'closedJobs'/);
  assert.match(src, /_FIXS_LOOKBACK_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
});

test('pendingjobs-normalizer is at least 60s and skips load-test cids', () => {
  const m = src.match(/_PENDINGJOBS_NORMALIZER_MS\s*=\s*([^;]+);/);
  assert.ok(m);
  // eslint-disable-next-line no-new-func
  const ms = Function(`return (${m[1]})`)();
  assert.ok(ms >= 60 * 1000, 'expected >= 60s, got ' + ms);
  const idx = src.indexOf('const _PENDINGJOBS_NORMALIZER_MS');
  const slice = src.slice(idx, idx + 2500);
  assert.match(slice, /_isSyntheticLoadTestCompanyId\(cid\)/);
  assert.match(slice, /pendingjobs\/\$\{cid\}\.json/);
});
