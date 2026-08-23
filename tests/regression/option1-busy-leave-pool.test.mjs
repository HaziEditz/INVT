/**
 * Option 1: assign/offer to a Busy driver leaves job Pending in pool
 * (no exclusive Offered / ticking expiry).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret, TEST_CID } from '../lib/config.mjs';
import { assertFirebaseHealthy, getHarness, prepareCleanDispatch } from '../lib/harness.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test.beforeEach(async () => {
  const h = await getHarness();
  await prepareCleanDispatch(h);
});

test('Option 1: assign to Busy driver leaves Pending in pool (no Offered)', async () => {
  requireFirebaseSecret();
  const h = await getHarness();

  const busyDriver = h.driverIds[2];
  const others = h.driverIds.filter((id) => id !== busyDriver);
  for (const id of others) {
    await h.driverStatusChanged(id, 'Away', { zonename: 'Central' });
  }

  await h.ensureDriverReady(busyDriver);
  await h.driverStatusChanged(busyDriver, 'Busy', {
    zonename: 'Central',
    lat: -46.4121,
    lng: 168.3531,
  });
  await h.configureDriver(busyDriver, {
    vehiclestatus: 'Busy',
    lat: -46.4121,
    lng: 168.3531,
    zonename: 'Central',
  });

  const jobId = await h.createJobViaInsert({
    notesSuffix: 'option1-busy-pool',
    bookstatus: 'Pending',
    dispatchBefore: 0,
  });
  assert.ok(jobId);

  const assign = await h.assignJob(jobId, busyDriver, busyDriver);
  assert.equal(assign.status, 200, JSON.stringify(assign.body));
  assert.equal(assign.body.ok, true, JSON.stringify(assign.body));
  assert.equal(
    String(assign.body.status || ''),
    'Pending',
    `expected Pending leftInPool, got ${JSON.stringify(assign.body)}`,
  );
  assert.ok(assign.body.leftInPool || assign.body.busyPool, JSON.stringify(assign.body));

  const traced = await h.poll(
    jobId,
    (t) => {
      const st = String(t.jobStore?.lifecycle?.BookingStatus || '');
      const pj = t.firebase?.pendingjobs;
      return (
        st === 'Pending' &&
        pj &&
        String(pj.BookingStatus || pj.Status || '') === 'Pending'
      );
    },
    { timeoutMs: 30000 },
  );
  assert.equal(String(traced.jobStore.lifecycle.BookingStatus), 'Pending');
  assert.notEqual(String(traced.jobStore.lifecycle.BookingStatus), 'Offered');
  assertFirebaseHealthy(traced, 'after busy assign→Pending');
});
