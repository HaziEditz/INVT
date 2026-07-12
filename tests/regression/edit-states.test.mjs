import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { assertEditLockClear, assertStatusSync, getHarness, prepareCleanDispatch } from '../lib/harness.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

async function editNotesWithoutStatusDrift(h, jobId, label) {
  const before = await h.jobTrace(jobId);
  const stBefore = String(before.jobStore?.lifecycle?.BookingStatus || '');

  const lockOn = await h.editLock(jobId, true, { actorName: `Regression-${label}` });
  assert.equal(lockOn.body.ok, true);

  const seq = await h.readUpdateSeq(jobId);
  const save = await h.bookingUpdate(jobId, { Notes: `REGTEST edit ${label} ${Date.now()}` }, seq);
  assert.equal(save.body.ok, true, JSON.stringify(save.body));

  const lockOff = await h.editLock(jobId, false, { actorName: `Regression-${label}`, forceRelease: true });
  assert.equal(lockOff.body.ok, true);

  const after = await h.poll(
    jobId,
    (t) => {
      const ab = t.firebase?.allbookings;
      const st = String(t.jobStore?.lifecycle?.BookingStatus || '');
      const lockClear =
        !ab || (ab.editLockActive !== true && ab.jobEditing !== true && ab.dispatcherEditing !== true);
      return lockClear && st === stBefore;
    },
    { timeoutMs: 25000 },
  );
  assertEditLockClear(after, label);
  assert.equal(String(after.jobStore?.lifecycle?.BookingStatus || ''), stBefore, `${label}: status unchanged`);
  if (['Pending', 'No One', 'Scheduled'].includes(stBefore)) {
    assertStatusSync(after, stBefore, label);
  }
}

async function editVehicleTypeAfterLegacySeqDrift(h, jobId, label, targetVehicleType = 'Van') {
  const baselineSeq = await h.readUpdateSeq(jobId);
  const baseline = await h.bookingUpdate(
    jobId,
    { Notes: `REGTEST legacy-seq baseline ${label} ${Date.now()}` },
    baselineSeq,
  );
  assert.equal(baseline.body.ok, true, JSON.stringify(baseline.body));
  const clientSeq = Number(baseline.body.seq ?? (baselineSeq + 1));

  // Simulate old jobs where Firebase/client seq is ahead but jobStore predates
  // updateSeq, then save through the normal edit endpoint using the higher seq.
  await h.mutateJobStore(jobId, { updateSeq: 0, VehicleType: 'Not Specified' });
  const save = await h.bookingUpdate(jobId, { VehicleType: targetVehicleType }, clientSeq);
  assert.equal(save.body.ok, true, `${label}: ${JSON.stringify(save.body)}`);
  assert.notEqual(save.body.error, 'sequence mismatch', `${label}: sequence mismatch should not block legacy edit`);

  const after = await h.poll(
    jobId,
    (t) =>
      String(t.jobStore?.lifecycle?.VehicleType || '') === targetVehicleType &&
      String(t.firebase?.allbookings?.VehicleType || '') === targetVehicleType,
    { timeoutMs: 25000 },
  );
  assert.equal(String(after.jobStore?.lifecycle?.VehicleType || ''), targetVehicleType, `${label}: jobStore VehicleType`);
  assert.equal(String(after.firebase?.allbookings?.VehicleType || ''), targetVehicleType, `${label}: allbookings VehicleType`);
}

async function editVehicleTypeToAny(h, jobId, label) {
  await h.bookingUpdate(jobId, { VehicleType: 'Van' }, await h.readUpdateSeq(jobId));
  const seq = await h.readUpdateSeq(jobId);
  const save = await h.bookingUpdate(jobId, { VehicleType: 'Not Specified' }, seq);
  assert.equal(save.body.ok, true, `${label}: ${JSON.stringify(save.body)}`);
  const after = await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.VehicleType || '').toLowerCase() === 'not specified',
    { timeoutMs: 25000 },
  );
  assert.equal(
    String(after.jobStore?.lifecycle?.VehicleType || '').toLowerCase(),
    'not specified',
    `${label}: jobStore VehicleType cleared to Any`,
  );
}

test('Phase 3 edit: Pending job can save vehicle type back to Any', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);
  const jobId = await h.createAsapJob('edit-any-pending');
  await editVehicleTypeToAny(h, jobId, 'UA-Pending-Any');
  await h.cancelUnassigned(jobId);
});

test('Phase 3 edit-lock: U-A (Pending) edit does not corrupt status', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);
  const jobId = await h.createAsapJob('edit-ua');
  await editNotesWithoutStatusDrift(h, jobId, 'UA-Pending');
});

test('Phase 3 edit-lock: Assigned edit does not corrupt status', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);
  const driverId = h.driverIds[0];
  await h.ensureDriverReady(driverId);
  const jobId = await h.createAsapJob('edit-assigned');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await h.assignAccept(jobId, driverId);
      break;
    } catch (err) {
      if (attempt === 2) throw err;
      await h.ensureDriverReady(driverId);
    }
  }
  await editNotesWithoutStatusDrift(h, jobId, 'Assigned');
  await h.cancelAssigned(jobId);
});

test('Phase 3 legacy edit: Pending, Assigned, and Queued save vehicle type after seq drift', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);

  const pendingJobId = await h.createAsapJob('legacy-edit-pending');
  await editVehicleTypeAfterLegacySeqDrift(h, pendingJobId, 'UA-Pending', 'Van');
  await h.cancelUnassigned(pendingJobId);

  const assignedDriverId = h.driverIds[0];
  await h.ensureDriverReady(assignedDriverId);
  const assignedJobId = await h.createAsapJob('legacy-edit-assigned');
  await h.assignAccept(assignedJobId, assignedDriverId);
  await editVehicleTypeAfterLegacySeqDrift(h, assignedJobId, 'Assigned', 'WAV');
  await h.cancelAssigned(assignedJobId);
  await h.ensureDriverReady(assignedDriverId);

  const queuedDriverId = h.driverIds[2];
  const queuedJobId = await h.createAsapJob('legacy-edit-queued');
  await h.driverStatusChanged(queuedDriverId, 'Busy', { zonename: 'North' });
  const offerRes = await h.offerJob(queuedJobId, queuedDriverId);
  assert.equal(offerRes.status, 200, JSON.stringify(offerRes.body));
  const queueRes = await h.queueJob(queuedJobId, queuedDriverId);
  assert.equal(queueRes.status, 200, JSON.stringify(queueRes.body));
  await h.poll(
    queuedJobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Queued',
    { timeoutMs: 25000 },
  );
  await editVehicleTypeAfterLegacySeqDrift(h, queuedJobId, 'Queued', 'Minibus');
  await h.cancelAssigned(queuedJobId);
  await h.driverStatusChanged(queuedDriverId, 'Available', { zonename: 'Central' });
  await prepareCleanDispatch(h);
});

test('Phase 3 edit-lock: Active (on board) edit does not corrupt status', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);
  const driverId = h.driverIds[1];
  await h.ensureDriverReady(driverId);
  const jobId = await h.createAsapJob('edit-active');
  await h.assignAccept(jobId, driverId);
  await h.stageJob(jobId, driverId, 'Arrived');
  await h.stageJob(jobId, driverId, 'Active');
  await h.poll(jobId, (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Active', { timeoutMs: 25000 });
  await editNotesWithoutStatusDrift(h, jobId, 'Active');
  await h.cancelAssigned(jobId);
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
