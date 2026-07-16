import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { getHarness } from '../lib/harness.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test('P3 network offer: assign to pre-stale driver bounces with Network issue reason', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const driverId = String(h.driverIds[0]);

  await h.ensureDriverReady(driverId);
  // lastSeen 10s ago → past NETWORK_OFFER_STALE_MS (3s). Must set AFTER ensureDriverReady.
  await h.configureDriver(driverId, {
    vehiclestatus: 'Available',
    lastSeen: Date.now() - 10_000,
  });

  const jobId = await h.createAsapJob('network-offer-stale');
  const assignRes = await h.assignJob(jobId, driverId, driverId);
  assert.equal(assignRes.body?.ok, false, `expected assign failure, got ${JSON.stringify(assignRes.body)}`);
  assert.equal(assignRes.body?.error_code, 'driver_unreachable');
  assert.match(String(assignRes.body?.error || ''), /Network issue/i);

  const trace = await h.poll(
    jobId,
    (t) =>
      t.jobStore?.found === true &&
      String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Pending',
    { timeoutMs: 20000 },
  );
  assert.equal(String(trace.jobStore.lifecycle.BookingStatus || ''), 'Pending');
  // returnReason is stamped on jobStore for UA visibility (may be in rawFlags).
  const reason = String(
    trace.jobStore?.lifecycle?.returnReason ||
      trace.jobStore?.rawFlags?.returnReason ||
      trace.jobStore?.raw?.returnReason ||
      assignRes.body?.error ||
      '',
  );
  assert.match(reason, /Network issue/i);
});

test('P3 network offer: fresh lastSeen still allows assign', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const driverId = String(h.driverIds[1]);

  await h.ensureDriverReady(driverId);
  await h.configureDriver(driverId, {
    vehiclestatus: 'Available',
    lastSeen: Date.now(),
  });

  const jobId = await h.createAsapJob('network-offer-fresh');
  const assignRes = await h.assignJob(jobId, driverId, driverId);
  assert.equal(assignRes.body?.ok, true, `expected assign ok, got ${JSON.stringify(assignRes.body)}`);
  await h.poll(
    jobId,
    (t) => ['Offered', 'Assigned'].includes(String(t.jobStore?.lifecycle?.BookingStatus || '')),
    { timeoutMs: 20000 },
  );
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
