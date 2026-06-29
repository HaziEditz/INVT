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
