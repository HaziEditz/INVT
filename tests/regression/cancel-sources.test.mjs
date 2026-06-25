import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { assertTerminalClean, getHarness, prepareCleanDispatch } from '../lib/harness.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test('Phase 2 cancel: dispatcher → terminal Cancelled', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const jobId = await h.createAsapJob('cancel-dispatcher');
  const res = await h.cancel(jobId, 'dispatcher', { dispatcherName: 'Regression' });
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true, JSON.stringify(res.body));
  const trace = await h.poll(
    jobId,
    (t) => t.jobStore?.closedFound === true || !t.jobStore?.found,
    { timeoutMs: 25000 },
  );
  assertTerminalClean(trace, 'Cancelled', 'dispatcher cancel');
});

test('Phase 2 cancel: website (admin key) → terminal Cancelled', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const jobId = await h.createAsapJob('cancel-website');
  const res = await h.cancel(jobId, 'website', { reason: 'Cancelled via website test' });
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true, JSON.stringify(res.body));
  const trace = await h.poll(
    jobId,
    (t) => t.jobStore?.closedFound === true || !t.jobStore?.found,
    { timeoutMs: 25000 },
  );
  assertTerminalClean(trace, 'Cancelled', 'website cancel');
});

test('Phase 2 cancel: driver recall on Assigned → Pending (not terminal)', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);
  const driverId = h.driverIds[1];
  await h.ensureDriverReady(driverId);
  const jobId = await h.createAsapJob('cancel-driver-recall');
  await h.assignJob(jobId, driverId, driverId);
  await h.poll(jobId, (t) => ['Offered', 'Assigned'].includes(String(t.jobStore?.lifecycle?.BookingStatus || '')));
  await h.acceptJob(jobId, driverId);
  await h.poll(jobId, (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Assigned');

  const res = await h.driverCancel(jobId, driverId, { reason: 'Recalled by driver' });
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true, JSON.stringify(res.body));

  const trace = await h.poll(
    jobId,
    (t) =>
      t.jobStore?.found === true &&
      String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Pending',
    { timeoutMs: 45000 },
  );
  assert.equal(String(trace.jobStore.lifecycle.BookingStatus), 'Pending');
  assert.equal(trace.firebase?.pendingjobs != null || trace.firebase?.allbookings != null, true);
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
