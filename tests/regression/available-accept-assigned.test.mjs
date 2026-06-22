import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { assertFirebaseHealthy, getHarness, prepareCleanDispatch } from '../lib/harness.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test.beforeEach(async () => {
  const h = await getHarness();
  await prepareCleanDispatch(h);
});

test('Available driver accept: stale Queued jobStore ghost must not queue a fresh auto-dispatch offer', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const driverId = h.driverIds[0];
  await h.ensureDriverReady(driverId);

  const ghostJobId = await h.createAsapJob('avail-accept-ghost');
  await h.poll(
    ghostJobId,
    (t) => t.jobStore?.found === true && String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Pending',
    { timeoutMs: 30000 },
  );

  await h.mutateJobStore(ghostJobId, {
    BookingStatus: 'Queued',
    DriverId: driverId,
    queuedAt: Date.now(),
    originalStatus: 'pending',
  });
  await h.setFirebaseBooking(ghostJobId, {
    BookingStatus: 'Completed',
    Status: 'Completed',
    DriverId: driverId,
    updateSeq: 1,
  });

  const ghostTrace = await h.jobTrace(ghostJobId);
  assert.equal(String(ghostTrace.jobStore?.lifecycle?.BookingStatus || ''), 'Queued');
  assert.equal(String(ghostTrace.jobStore?.lifecycle?.DriverId || ''), String(driverId));

  await h.configureDriver(driverId, {
    vehiclestatus: 'Available',
    lat: -46.412,
    lng: 168.353,
    zonename: 'Central',
  });
  await h.driverStatusChanged(driverId, 'Available');

  const newJobId = await h.createAsapJob('avail-accept-fresh');
  await h.triggerAutoDispatch();
  const offered = await h.waitForAutoOffer(newJobId, driverId, { timeoutMs: 45000 });
  assert.equal(String(offered.jobStore.lifecycle.BookingStatus), 'Offered');
  assert.equal(String(offered.jobStore.lifecycle.DriverId), String(driverId));

  const accept = await h.acceptJob(newJobId, driverId);
  assert.equal(accept.status, 200, JSON.stringify(accept.body));
  assert.equal(accept.body.ok, true, JSON.stringify(accept.body));
  assert.notEqual(accept.body.queued, true, 'Available accept must not queue');
  assert.equal(accept.body.status, 'Assigned', JSON.stringify(accept.body));

  const assigned = await h.poll(
    newJobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Assigned',
    { timeoutMs: 25000 },
  );
  assert.equal(String(assigned.jobStore.lifecycle.BookingStatus), 'Assigned');
  assert.equal(String(assigned.jobStore.lifecycle.DriverId), String(driverId));
  assert.equal(assigned.splitBrainDiagnosis?.detected, false, JSON.stringify(assigned.splitBrainDiagnosis));
  assertFirebaseHealthy(assigned, 'after available accept assigned');

  await h.cancelAssigned(newJobId).catch(() => undefined);
  await h.mutateJobStore(ghostJobId, { BookingStatus: 'Pending', DriverId: '0' }).catch(() => undefined);
  await h.cancelUnassigned(ghostJobId).catch(() => undefined);
});

test.afterEach(async () => {
  const h = await getHarness();
  await prepareCleanDispatch(h);
});
