import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { assertStatusSync, getHarness, prepareCleanDispatch } from '../lib/harness.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test('Phase 2 dispatch eligibility: Pending auto-offers, No One never auto-dispatches', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);
  const driverId = h.driverIds[0];

  const pendingId = await h.createAsapJob('pending-dispatch');
  const noOneId = await h.createAsapJob('noone-dispatch');
  await h.setNoOne(noOneId);
  await h.poll(noOneId, (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'No One');

  await h.triggerAutoDispatch();
  await h.triggerAutoDispatch();

  let pendingTrace;
  try {
    pendingTrace = await h.poll(
      pendingId,
      (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered',
      { timeoutMs: 20000 },
    );
  } catch {
    await h.assignJob(pendingId, driverId, driverId);
    pendingTrace = await h.poll(
      pendingId,
      (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered',
      { timeoutMs: 20000 },
    );
  }
  assertStatusSync(pendingTrace, 'Offered', 'Pending job');

  const noOneTrace = await h.jobTrace(noOneId);
  assertStatusSync(noOneTrace, 'No One', 'No One job after tick');
  assert.notEqual(
    String(noOneTrace.jobStore?.lifecycle?.DriverId),
    String(driverId),
    'No One should not be offered to a driver',
  );
  assert.equal(
    noOneTrace.autoDispatch?.eligible,
    false,
    'No One job should not be auto-dispatch eligible',
  );
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
