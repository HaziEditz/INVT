import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { assertStatusSync, getHarness } from '../lib/harness.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test('Phase 1 sequence: two jobs quick-assign No One sequentially without mismatch', async () => {
  requireFirebaseSecret();
  const h = await getHarness();

  const jobA = await h.createAsapJob('seq-A');
  const jobB = await h.createAsapJob('seq-B');

  const resA = await h.setNoOne(jobA);
  assert.equal(resA.response.status, 200);
  assert.equal(resA.response.body.ok, true, `job A: ${JSON.stringify(resA.response.body)}`);

  const traceA = await h.poll(
    jobA,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'No One',
    { timeoutMs: 20000 },
  );
  assertStatusSync(traceA, 'No One', 'job A');

  const resB = await h.setNoOne(jobB);
  assert.equal(resB.response.status, 200, JSON.stringify(resB.response.body));
  assert.equal(resB.response.body.ok, true, `job B: ${JSON.stringify(resB.response.body)}`);

  const traceB = await h.poll(
    jobB,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'No One',
    { timeoutMs: 20000 },
  );
  assertStatusSync(traceB, 'No One', 'job B');

  // Job A must remain No One (no cross-job regression)
  const traceAAfter = await h.jobTrace(jobA);
  assertStatusSync(traceAAfter, 'No One', 'job A after job B update');
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
