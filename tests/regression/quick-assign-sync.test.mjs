import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { assertStatusSync } from '../lib/harness.mjs';
import { getHarness } from '../lib/harness.mjs';

test('Phase 1 quick-assign: Pending → No One syncs jobStore and Firebase', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const jobId = await h.createAsapJob('quick-assign');

  const { response } = await h.setNoOne(jobId);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.ok, true, JSON.stringify(response.body));

  const trace = await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'No One',
    { timeoutMs: 20000 },
  );

  assertStatusSync(trace, 'No One', 'after quick-assign No One');
  assert.equal(String(trace.jobStore.lifecycle.DriverId), '-1');
});

test('Phase 1 quick-assign: No One → Pending round-trip stays in sync', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const jobId = await h.createAsapJob('quick-assign-roundtrip');

  await h.setNoOne(jobId);
  await h.poll(jobId, (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'No One');

  const { response } = await h.setPending(jobId);
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);

  const trace = await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Pending',
    { timeoutMs: 20000 },
  );
  assertStatusSync(trace, 'Pending', 'after revert to Pending');
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
