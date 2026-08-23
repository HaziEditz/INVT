import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { assertFirebaseHealthy, getHarness } from '../lib/harness.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

/**
 * Option 1: Busy drivers do not get exclusive Offered.
 * Voluntary queue = accept Pending from pool while Busy → Queued.
 */
test('Phase 3 queue-while-busy: Pending pool accept → Queue → Recall', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const driverId = h.driverIds[2];
  await h.ensureDriverReady(driverId);
  const poolJobId = await h.createAsapJob('queue-pool');

  await h.driverStatusChanged(driverId, 'Busy', { zonename: 'North' });
  await h.configureDriver(driverId, {
    vehiclestatus: 'Busy',
    lat: -46.412,
    lng: 168.353,
    zonename: 'North',
  });

  // Assign while Busy must leave Pending (no Offered).
  const assign = await h.assignJob(poolJobId, driverId, driverId);
  assert.equal(assign.status, 200, JSON.stringify(assign.body));
  assert.equal(String(assign.body.status || ''), 'Pending', JSON.stringify(assign.body));
  assert.ok(assign.body.leftInPool || assign.body.busyPool, JSON.stringify(assign.body));

  const acceptRes = await h.acceptJob(poolJobId, driverId);
  assert.equal(acceptRes.status, 200, JSON.stringify(acceptRes.body));
  assert.equal(acceptRes.body.ok, true, JSON.stringify(acceptRes.body));
  assert.equal(acceptRes.body.queued, true, JSON.stringify(acceptRes.body));

  const queued = await h.poll(
    poolJobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Queued',
    { timeoutMs: 25000 },
  );
  assert.equal(String(queued.jobStore.lifecycle.BookingStatus), 'Queued');
  assert.equal(String(queued.jobStore.lifecycle.DriverId), String(driverId));
  assert.equal(queued.splitBrainDiagnosis?.detected, false, JSON.stringify(queued.splitBrainDiagnosis));
  assertFirebaseHealthy(queued, 'after busy pool accept→Queued');

  const recallRes = await h.recallQueuedJob(poolJobId);
  assert.equal(recallRes.status, 200);

  await h.poll(
    poolJobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Pending',
    { timeoutMs: 45000 },
  );

  await h.driverStatusChanged(driverId, 'Available', { zonename: 'North' });
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
