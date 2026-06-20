import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret, ADMIN_KEY } from '../lib/config.mjs';
import { get } from '../lib/http.mjs';
import { getHarness } from '../lib/harness.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test('Phase 0 smoke: server health and admin jobTrace reachable', async () => {
  requireFirebaseSecret();

  const status = await get('/dev/loadtest/status');
  assert.equal(status.status, 200);
  assert.equal(typeof status.body.totalJobs, 'number');

  const version = await get('/admin/version', { 'X-Admin-Key': ADMIN_KEY });
  assert.equal(version.status, 200);
  assert.ok(version.body.serverBuildId || version.body.buildId, 'server build id present');

  const h = await getHarness();
  const jobId = await h.createAsapJob('smoke');
  const trace = await h.jobTrace(jobId);
  assert.equal(trace.jobStore.found, true);
  assert.ok(trace.firebase?.allbookings || trace.firebase?.pendingjobs, 'Firebase nodes should exist');
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
