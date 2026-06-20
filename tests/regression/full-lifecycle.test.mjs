import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { assertFirebaseHealthy, getHarness, prepareCleanDispatch } from '../lib/harness.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test('Phase 2 lifecycle: Create → auto-dispatch → Accept → Arrived → Active → Complete', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);
  const driverId = h.driverIds[0];
  const jobId = await h.createAsapJob('full-lifecycle');

  await h.triggerAutoDispatch();
  let offered = await h.jobTrace(jobId);
  if (String(offered.jobStore?.lifecycle?.BookingStatus || '') !== 'Offered') {
    await h.triggerAutoDispatch();
    offered = await h.poll(
      jobId,
      (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered',
      { timeoutMs: 30000 },
    );
  }
  assert.equal(String(offered.jobStore?.lifecycle?.BookingStatus || ''), 'Offered', 'after auto-dispatch jobStore');
  const offerDrv = String(offered.jobStore.lifecycle.DriverId);
  assert.ok(offerDrv && offerDrv !== '0', 'offered to a driver');

  const accept = await h.acceptJob(jobId, offerDrv);
  assert.equal(accept.status, 200);
  assert.equal(accept.body.ok, true, JSON.stringify(accept.body));

  await h.poll(jobId, (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Assigned', {
    timeoutMs: 25000,
  });

  const arrived = await h.stageJob(jobId, offerDrv, 'Arrived');
  assert.equal(arrived.body.ok, true);
  await h.poll(jobId, (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Arrived');

  const active = await h.stageJob(jobId, offerDrv, 'Active');
  assert.equal(active.body.ok, true);
  const onBoard = await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Active',
    { timeoutMs: 20000 },
  );
  assert.equal(String(onBoard.jobStore?.lifecycle?.BookingStatus || ''), 'Active', 'on board jobStore');

  const complete = await h.completeJob(jobId, offerDrv);
  assert.equal(complete.status, 200);
  assert.equal(complete.body.ok, true, JSON.stringify(complete.body));

  const terminal = await h.poll(
    jobId,
    (t) => t.jobStore?.closedFound === true || !t.jobStore?.found,
    { timeoutMs: 30000 },
  );
  assert.ok(terminal.jobStore?.closedFound || !terminal.jobStore?.found, 'job should be terminal');
  assert.equal(terminal.firebase?.pendingjobs, null, 'pendingjobs cleaned after complete');
  assertFirebaseHealthy(terminal, 'after complete');
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
