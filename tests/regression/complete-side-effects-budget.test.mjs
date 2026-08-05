/**
 * Fix A — complete must not await unbounded Firebase cleanup before HTTP 200.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const src = readFileSync(join(root, 'server.js'), 'utf8');

test('complete side-effects budget is capped under client 12s HTTP timeout', () => {
  assert.match(src, /COMPLETE_SIDE_EFFECTS_BUDGET_MS\s*=\s*7000/);
  assert.match(src, /complete side-effects budget exceeded/);
  assert.match(src, /budgetExceeded=1/);
  assert.match(src, /_promiseWithTimeout\(\s*_sideFx,\s*COMPLETE_SIDE_EFFECTS_BUDGET_MS/);
  // Fanout stays awaited (ordering vs bwClear) but whole cleanup is budget-capped.
  assert.match(
    src,
    /complete allbookings fanout failed[\s\S]{0,120}awaited:\s*true|awaited:\s*true[\s\S]{0,200}complete allbookings fanout failed/,
  );
  assert.match(src, /complete allbookings re-seal failed/);
  assert.match(src, /_fanVersionToFirebaseAwait\(_cid, bookingId, _completeFanPatch, true\)/);
});

test('hail create awaits allbookings fanout before HTTP 200', () => {
  assert.match(src, /MUST await allbookings\/pendingjobs before HTTP 200/);
  assert.match(src, /skip Active allbookings SET/);
  assert.equal(
    src.includes("fire-and-forget so we don't block the response"),
    false,
    'hail create must not fire-and-forget Firebase fanout',
  );
});

test('POST /api/job/complete has try/catch → JSON 500', () => {
  const idx = src.indexOf("urlPath === '/api/job/complete'");
  assert.ok(idx > 0, 'complete route present');
  const slice = src.slice(idx, idx + 1800);
  assert.match(slice, /catch\s*\(\s*e\s*\)/);
  assert.match(slice, /error_code:\s*'server_error'/);
  assert.match(slice, /_status\s*=\s*500/);
});
