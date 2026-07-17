import '../lib/loadEnv.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { getHarness, prepareCleanDispatch } from '../lib/harness.mjs';
import { post } from '../lib/http.mjs';
import { ADMIN_KEY } from '../lib/config.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test.beforeEach(async () => {
  const h = await getHarness();
  await prepareCleanDispatch(h);
  for (const did of h.driverIds) {
    await h.driverStatusChanged(did, 'Available').catch(() => undefined);
    await h.ensureDriverReady(did);
    await h.configureDriver(did, {
      vehiclestatus: 'Available',
      lastSeen: Date.now(),
      lat: -46.412,
      lng: 168.353,
    });
  }
});

async function parkExtraDrivers(h, keepIds) {
  const keep = new Set(keepIds.map(String));
  for (const did of h.driverIds) {
    if (keep.has(String(did))) continue;
    await h.configureDriver(did, { vehiclestatus: 'Away', lastSeen: Date.now() });
    await h.driverStatusChanged(did, 'Away').catch(() => undefined);
  }
}

test('accept ownership: Offered to other driver rejects with offer_not_yours', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const owner = String(h.driverIds[0]);
  const stale = String(h.driverIds[1]);

  await parkExtraDrivers(h, [owner, stale]);
  await h.ensureDriverReady(owner);
  await h.ensureDriverReady(stale);
  await h.configureDriver(owner, { vehiclestatus: 'Available', lastSeen: Date.now() });
  await h.configureDriver(stale, { vehiclestatus: 'Available', lastSeen: Date.now() });

  const jobId = await h.createAsapJob('accept-own-other');
  const assign = await h.assignJob(jobId, owner, owner);
  assert.equal(assign.body?.ok, true, `assign failed: ${JSON.stringify(assign.body)}`);

  await h.poll(
    jobId,
    (t) =>
      String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered' &&
      String(t.jobStore?.lifecycle?.DriverId || '') === owner,
    { timeoutMs: 30000 },
  );

  const accept = await h.acceptJob(jobId, stale);
  assert.equal(accept.body?.ok, false, `expected reject, got ${JSON.stringify(accept.body)}`);
  assert.equal(accept.body?.error_code, 'offer_not_yours');
  assert.equal(accept.status, 409);

  const still = await h.poll(
    jobId,
    (t) =>
      String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered' &&
      String(t.jobStore?.lifecycle?.DriverId || '') === owner,
    { timeoutMs: 15000 },
  );
  assert.equal(String(still.jobStore.lifecycle.DriverId), owner);
});

test('accept ownership: Offered holder can still accept', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const owner = String(h.driverIds[0]);
  await parkExtraDrivers(h, [owner]);
  await h.ensureDriverReady(owner);
  await h.configureDriver(owner, { vehiclestatus: 'Available', lastSeen: Date.now() });

  const jobId = await h.createAsapJob('accept-own-holder');
  const assign = await h.assignJob(jobId, owner, owner);
  assert.equal(assign.body?.ok, true, `assign failed: ${JSON.stringify(assign.body)}`);

  await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered',
    { timeoutMs: 30000 },
  );

  const accept = await h.acceptJob(jobId, owner);
  assert.equal(accept.body?.ok, true, `accept failed: ${JSON.stringify(accept.body)}`);
  assert.ok(['Assigned', 'Queued'].includes(String(accept.body?.status || '')));

  await h.poll(
    jobId,
    (t) => ['Assigned', 'Queued'].includes(String(t.jobStore?.lifecycle?.BookingStatus || '')),
    { timeoutMs: 30000 },
  );
});

test('accept ownership: wrong offerSeq is rejected even for holder', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const owner = String(h.driverIds[0]);
  await parkExtraDrivers(h, [owner]);
  await h.ensureDriverReady(owner);
  await h.configureDriver(owner, { vehiclestatus: 'Available', lastSeen: Date.now() });

  const jobId = await h.createAsapJob('accept-own-version');
  const assign = await h.assignJob(jobId, owner, owner);
  assert.equal(assign.body?.ok, true, `assign failed: ${JSON.stringify(assign.body)}`);
  await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered',
    { timeoutMs: 30000 },
  );
  const seq = await h.readUpdateSeq(jobId);
  assert.ok(seq > 0, `expected offered updateSeq > 0, got ${seq}`);

  const accept = await post(
    '/api/job/accept',
    {
      bookingId: jobId,
      jobId,
      driverId: owner,
      ifVersion: seq - 1,
    },
    { 'X-Admin-Key': ADMIN_KEY },
  );
  assert.equal(accept.body?.ok, false, `expected version reject: ${JSON.stringify(accept.body)}`);
  assert.equal(accept.body?.error_code, 'version_conflict');
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
