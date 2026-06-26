import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { assertFirebaseHealthy, getHarness } from '../lib/harness.mjs';
import { parseDataManager } from '../lib/http.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test('Phase 3 queue-while-busy: offer → Queue → Recall → clean Pending pool', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const driverId = h.driverIds[2];
  const poolJobId = await h.createAsapJob('queue-pool');

  await h.driverStatusChanged(driverId, 'Busy', { zonename: 'North' });
  await h.offerJob(poolJobId, driverId);

  const queueRes = await h.queueJob(poolJobId, driverId);
  assert.equal(queueRes.status, 200);
  const queueBody = parseDataManager(queueRes.body);
  assert.equal(queueBody.ok, true, JSON.stringify(queueBody));

  const queued = await h.poll(
    poolJobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Queued',
    { timeoutMs: 25000 },
  );
  assert.equal(String(queued.jobStore.lifecycle.BookingStatus), 'Queued');
  const hint = queued.dispatchUiHint || {};
  const syncLag =
    hint.jobStoreVsAllbookingsMismatch === true ||
    hint.jobStoreVsPendingMismatch === true ||
    hint.pendingVsAllbookingsMismatch === true;
  assert.equal(queued.splitBrainDiagnosis?.detected, false, JSON.stringify(queued.splitBrainDiagnosis));
  if (!syncLag) {
    assertFirebaseHealthy(queued, 'after QueueJob');
  }
  assert.equal(String(queued.jobStore.lifecycle.DriverId), String(driverId), 'Queued job tied to busy driver');

  const recallRes = await h.recallQueuedJob(poolJobId);
  assert.equal(recallRes.status, 200);
  const recallBody = parseDataManager(recallRes.body);
  assert.equal(recallBody.ok, true, JSON.stringify(recallBody));

  const recalled = await h.poll(
    poolJobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Pending',
    { timeoutMs: 45000 },
  );
  assert.equal(String(recalled.jobStore.lifecycle.BookingStatus), 'Pending');
  const recalledDrv = recalled.jobStore.lifecycle.DriverId;
  const recalledDrvStr =
    recalledDrv === null || recalledDrv === undefined ? '' : String(recalledDrv);
  assert.ok(
    recalledDrvStr === '0' || recalledDrvStr === '-2',
    `DriverId after recall: ${recalledDrvStr}`,
  );

  await h.driverStatusChanged(driverId, 'Available', { zonename: 'North' });
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
