import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { assertTerminalClean, getHarness, prepareCleanDispatch } from '../lib/harness.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test('Phase 2 outcomes: driver recall (Assigned) → Pending with recall reason', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);
  const driverId = h.driverIds[0];
  const jobId = await h.createAsapJob('outcome-recall');
  await h.assignAccept(jobId, driverId);

  await h.configureDriver(driverId, { passforlink: `regtest-key-${driverId}`, vehiclestatus: 'Available' });
  const res = await h.jobCommand(
    jobId,
    'recall',
    'driver',
    { driverId: String(driverId), reason: 'Recalled by driver' },
    h.driverHeaders(driverId),
  );
  assert.equal(res.body.ok, true, JSON.stringify(res.body));

  const trace = await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Pending',
    { timeoutMs: 25000 },
  );
  assert.match(String(trace.jobStore.lifecycle.returnReason || ''), /recall/i);
  assert.equal(trace.jobStore.closedFound, false);
});

test('Phase 2 outcomes: No Show (post-Arrived) → terminal No Show', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);
  const driverId = h.driverIds[1];
  await h.ensureDriverReady(driverId);
  const jobId = await h.createAsapJob('outcome-noshow');
  await h.assignAccept(jobId, driverId);
  await h.stageJob(jobId, driverId, 'Arrived');
  await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Arrived',
    { timeoutMs: 30000 },
  );

  const ns = await h.driverCancel(jobId, driverId, { noShow: true });
  assert.equal(ns.body.ok, true, JSON.stringify(ns.body));
  const nsTrace = await h.poll(
    jobId,
    (t) =>
      t.jobStore?.closedFound === true &&
      String(t.jobStore?.lifecycle?.BookingStatus || '') === 'No Show',
    { timeoutMs: 45000 },
  );
  assertTerminalClean(nsTrace, 'No Show', 'no show');
});

test('Phase 2 outcomes: Cancel (post-Arrived) → terminal Cancelled', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);
  const driverId = h.driverIds[0];
  await h.ensureDriverReady(driverId);
  const jobId = await h.createAsapJob('outcome-cancel');
  await h.assignAccept(jobId, driverId);
  await h.stageJob(jobId, driverId, 'Arrived');
  await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Arrived',
    { timeoutMs: 30000 },
  );

  const cx = await h.driverCancel(jobId, driverId, {
    forceTerminal: true,
    reason: 'Passenger cancelled at pickup',
  });
  assert.equal(cx.body.ok, true, JSON.stringify(cx.body));
  const cxTrace = await h.poll(
    jobId,
    (t) =>
      t.jobStore?.closedFound === true &&
      String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Cancelled',
    { timeoutMs: 45000 },
  );
  assertTerminalClean(cxTrace, 'Cancelled', 'driver terminal cancel');
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
