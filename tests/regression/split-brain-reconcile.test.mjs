import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { assertFirebaseHealthy, getHarness, prepareCleanDispatch } from '../lib/harness.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test.afterEach(async () => {
  const h = await getHarness();
  await prepareCleanDispatch(h);
});

test('Split-brain: stale Offered + Firebase Completed does not block other jobs', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);

  const driverA = h.driverIds[0];
  const driverB = h.driverIds[1];
  const stuckJobId = await h.createAsapJob('split-brain-stuck-offered');
  const freshJobId = await h.createAsapJob('split-brain-fresh-pending');

  await h.mutateJobStore(stuckJobId, {
    BookingStatus: 'Offered',
    DriverId: driverA,
    VehicleId: driverA,
    offeredAt: Date.now() - 5 * 60 * 1000,
    returnReason: 'Offer expired (stale offered job)',
  });
  await h.setFirebaseBooking(stuckJobId, {
    BookingStatus: 'Completed',
    Status: 'Completed',
    DriverId: String(driverA),
  });

  const beforeTick = await h.jobTrace(stuckJobId);
  assert.equal(String(beforeTick.jobStore?.lifecycle?.BookingStatus || ''), 'Offered');

  await h.triggerAutoDispatch();
  await h.triggerAutoDispatch();

  const stuckAfter = await h.jobTrace(stuckJobId);
  assert.notEqual(
    stuckAfter.jobStore?.found,
    true,
    'stuck Offered + Firebase Completed must be purged from live jobStore before dispatch continues',
  );

  const freshTrace = await h.waitForAutoOffer(freshJobId, driverA, { timeoutMs: 45000 });
  assert.equal(String(freshTrace.jobStore.lifecycle.BookingStatus), 'Offered');
  assert.ok(
    String(freshTrace.jobStore.lifecycle.DriverId) === String(driverA) ||
      String(freshTrace.jobStore.lifecycle.DriverId) === String(driverB),
    `expected fresh job offered to a driver, got ${freshTrace.jobStore.lifecycle.DriverId}`,
  );
  assertFirebaseHealthy(freshTrace, 'after company-wide block safeguard');

  await h.cancelAssigned(freshJobId);
});

test('Split-brain: jobStore Active + Firebase Completed — trust_firebase purges jobStore', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);

  const driverId = h.driverIds[0];
  const jobId = await h.createAsapJob('split-brain-active-completed');

  await h.mutateJobStore(jobId, {
    BookingStatus: 'Active',
    DriverId: driverId,
    VehicleId: driverId,
  });
  await h.setFirebaseBooking(jobId, {
    BookingStatus: 'Completed',
    Status: 'Completed',
    DriverId: String(driverId),
  });

  const syncAttempt = await h.repairBooking(jobId, 'sync');
  assert.equal(syncAttempt.body.ok, false, 'sync must refuse when Firebase is terminal');
  assert.match(String(syncAttempt.body.error || ''), /trust_firebase/i);

  const trust = await h.repairBooking(jobId, 'trust_firebase');
  assert.equal(trust.status, 200);
  assert.equal(trust.body.ok, true);
  assert.equal(trust.body.purged, true);

  const after = await h.jobTrace(jobId);
  assert.notEqual(after.jobStore?.found, true, 'job should be purged from live jobStore');
});

test('Split-brain: jobStore Queued + Firebase Pending — auto-dispatch reconcile re-fans Queued', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);

  const driverId = h.driverIds[0];
  const jobId = await h.createAsapJob('split-brain-queued-pending');

  await h.mutateJobStore(jobId, {
    BookingStatus: 'Queued',
    DriverId: driverId,
    VehicleId: driverId,
    queuedAt: Date.now(),
    originalStatus: 'pending',
  });
  await h.setFirebaseBooking(jobId, {
    BookingStatus: 'Pending',
    Status: 'Pending',
    DriverId: '0',
    AssignedDriverId: '',
  });

  await h.triggerAutoDispatch();

  const healed = await h.poll(
    jobId,
    (t) => {
      const ab = t.firebase?.allbookings;
      return ab && String(ab.BookingStatus || ab.Status) === 'Queued';
    },
    { timeoutMs: 30000 },
  );
  assert.equal(String(healed.firebase.allbookings.BookingStatus || healed.firebase.allbookings.Status), 'Queued');
  assert.equal(String(healed.firebase.allbookings.DriverId), String(driverId));
  assert.equal(healed.splitBrainDiagnosis?.detected, false, JSON.stringify(healed.splitBrainDiagnosis));
  assertFirebaseHealthy(healed, 'after queued reconcile');
});

test('Auto-dispatch analyze: stale Offered is reported but not blocking', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);

  const staleJobId = await h.createAsapJob('analyze-stale-offered-blocker');
  const pendingJobId = await h.createAsapJob('analyze-fresh-pending');

  await h.mutateJobStore(staleJobId, {
    BookingStatus: 'Offered',
    DriverId: h.driverIds[0],
    VehicleId: h.driverIds[0],
    offeredAt: Date.now() - 5 * 60 * 1000,
  });

  const trace = await h.jobTrace(pendingJobId);
  const reasons = trace.autoDispatch?.reasons || [];
  const staleLine = reasons.find((x) => String(x).includes('stale Offered') && String(x).includes('not blocking'));
  assert.ok(staleLine, `expected stale-not-blocking reason, got: ${JSON.stringify(reasons)}`);
  assert.ok(
    staleLine.includes(String(staleJobId)),
    `stale job #${staleJobId} should be listed as non-blocking: ${staleLine}`,
  );
  const blockLine = reasons.find((x) => String(x).startsWith('company blocked:'));
  if (blockLine) {
    assert.ok(
      !blockLine.includes(String(staleJobId)),
      `stale job #${staleJobId} must not appear in company blockers: ${blockLine}`,
    );
  }
});
