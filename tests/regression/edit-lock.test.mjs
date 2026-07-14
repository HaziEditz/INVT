import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { assertEditLockClear, assertFirebaseHealthy, getHarness } from '../lib/harness.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

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

test('Phase 1 edit-lock: lock does not wipe tariff or vehicle type on pendingjobs', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const jobId = await h.createAsapJob('edit-lock-tariff-vehicle');

  const seq = await h.readUpdateSeq(jobId);
  const save = await h.bookingUpdate(
    jobId,
    {
      VehicleType: 'Van',
      TarriffId: '2',
      TarriffName: 'Regression Tariff',
      TariffId: '2',
      TariffName: 'Regression Tariff',
      Notes: 'edit-lock field preserve',
    },
    seq,
  );
  assert.equal(save.body.ok, true, JSON.stringify(save.body));

  const before = await h.poll(
    jobId,
    (t) => {
      const ab = t.firebase?.allbookings;
      if (!ab) return false;
      const tid = String(ab.TarriffId ?? ab.TariffId ?? '');
      const vt = String(ab.VehicleType ?? '');
      return tid === '2' && /van/i.test(vt);
    },
    { timeoutMs: 20000 },
  );
  const beforeAb = before.firebase?.allbookings;
  assert.equal(String(beforeAb?.TarriffId ?? beforeAb?.TariffId ?? ''), '2');
  assert.match(String(beforeAb?.VehicleType ?? ''), /van/i);
  assert.match(String(beforeAb?.TarriffName ?? beforeAb?.TariffName ?? ''), /Regression Tariff/i);

  const lockOn = await h.editLock(jobId, true, { actorName: 'Regression-Preserve' });
  assert.equal(lockOn.body.ok, true);

  // Assert on allbookings (authoritative live record). Preferring pendingjobs when
  // it was a lock-only stub made this test fail even when allbookings was intact.
  const locked = await h.poll(
    jobId,
    (t) => {
      const ab = t.firebase?.allbookings;
      if (!ab) return false;
      const lockedFlag = ab.editLockActive === true || ab.jobEditing === true;
      const tid = String(ab.TarriffId ?? ab.TariffId ?? '');
      const vt = String(ab.VehicleType ?? '');
      const name = String(ab.TarriffName ?? ab.TariffName ?? '');
      return lockedFlag && tid === '2' && /van/i.test(vt) && /Regression Tariff/i.test(name);
    },
    { timeoutMs: 20000 },
  );
  const lockedAb = locked.firebase?.allbookings;
  assert.equal(String(lockedAb?.TarriffId ?? lockedAb?.TariffId ?? ''), '2', 'tariff id must survive lock');
  assert.match(String(lockedAb?.VehicleType ?? ''), /van/i, 'vehicle type must survive lock');
  assert.match(
    String(lockedAb?.TarriffName ?? lockedAb?.TariffName ?? ''),
    /Regression Tariff/i,
    'tariff name must survive lock',
  );
  assert.ok(String(lockedAb?.PickAddress ?? '').length > 0, 'pickup address must survive lock');
  // pendingjobs must either be absent or retain booking fields (never lock-only stub).
  const lockedPj = locked.firebase?.pendingjobs;
  if (lockedPj && typeof lockedPj === 'object') {
    const pjKeys = Object.keys(lockedPj);
    const hasBookingField =
      pjKeys.includes('TarriffId') ||
      pjKeys.includes('TariffId') ||
      pjKeys.includes('PickAddress') ||
      pjKeys.includes('VehicleType') ||
      pjKeys.includes('Status') ||
      pjKeys.includes('BookingStatus');
    assert.ok(
      hasBookingField,
      `pendingjobs must not be a lock-only sparse stub while locked, got keys=${pjKeys.join(',')}`,
    );
    if (pjKeys.includes('TarriffId') || pjKeys.includes('TariffId')) {
      assert.equal(String(lockedPj.TarriffId ?? lockedPj.TariffId ?? ''), '2');
    }
    if (pjKeys.includes('VehicleType')) {
      assert.match(String(lockedPj.VehicleType ?? ''), /van/i);
    }
  }

  const lockOff = await h.editLock(jobId, false, {
    actorName: 'Regression-Preserve',
    forceRelease: true,
  });
  assert.equal(lockOff.body.ok, true);

  const unlocked = await h.poll(
    jobId,
    (t) => {
      const ab = t.firebase?.allbookings;
      return ab && ab.editLockActive !== true && ab.jobEditing !== true;
    },
    { timeoutMs: 15000 },
  );
  assertEditLockClear(unlocked, 'after preserve check');
  const afterNode = unlocked.firebase?.allbookings;
  assert.equal(String(afterNode?.TarriffId ?? afterNode?.TariffId ?? ''), '2');
  assert.match(String(afterNode?.VehicleType ?? ''), /van/i);

  await h.cancelUnassigned(jobId);
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
