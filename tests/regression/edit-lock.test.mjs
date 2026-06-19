import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { assertEditLockClear, assertFirebaseHealthy } from '../lib/harness.mjs';
import { getHarness } from '../lib/harness.mjs';

test('Phase 1 edit-lock: acquire and release without getting stuck', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const jobId = await h.createAsapJob('edit-lock');

  const lockOn = await h.editLock(jobId, true, { actorName: 'Regression-A' });
  assert.equal(lockOn.status, 200);
  assert.equal(lockOn.body.ok, true);

  const lockedTrace = await h.poll(
    jobId,
    (t) => {
      const ab = t.firebase?.allbookings;
      return ab && (ab.editLockActive === true || ab.jobEditing === true || ab.dispatcherEditing === true);
    },
    { timeoutMs: 15000 },
  );
  assert.ok(lockedTrace.firebase?.allbookings, 'allbookings should exist while locked');

  const lockOff = await h.editLock(jobId, false, { actorName: 'Regression-A', forceRelease: true });
  assert.equal(lockOff.status, 200);
  assert.equal(lockOff.body.ok, true);

  const unlockedTrace = await h.poll(
    jobId,
    (t) => {
      const ab = t.firebase?.allbookings;
      if (!ab) return false;
      return ab.editLockActive !== true && ab.jobEditing !== true && ab.dispatcherEditing !== true;
    },
    { timeoutMs: 15000 },
  );

  assertEditLockClear(unlockedTrace, 'after release');
  assertFirebaseHealthy(unlockedTrace, 'after release');
});

test('Phase 1 edit-lock: failed save path still releases on close (forceRelease)', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const jobId = await h.createAsapJob('edit-lock-fail');

  const sessionB = 'regtest-session-b-' + Date.now();
  const lockOn = await h.editLock(jobId, true, { actorName: 'Regression-B', sessionId: sessionB });
  assert.equal(lockOn.body.ok, true);

  // Simulate stale ifSeq save failure while lock held
  const badSave = await h.bookingUpdate(jobId, { Notes: 'regression stale save probe' }, 99999);
  assert.notEqual(badSave.body.ok, true);

  const lockOff = await h.editLock(jobId, false, {
    actorName: 'Regression-B',
    sessionId: sessionB,
    forceRelease: true,
  });
  assert.equal(lockOff.body.ok, true);

  const trace = await h.poll(
    jobId,
    (t) => {
      const ab = t.firebase?.allbookings;
      return ab && ab.editLockActive !== true && ab.jobEditing !== true;
    },
    { timeoutMs: 15000 },
  );
  assertEditLockClear(trace, 'after failed save + release');
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
