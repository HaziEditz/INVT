import '../lib/loadEnv.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_KEY, TEST_CID, requireFirebaseSecret } from '../lib/config.mjs';
import { post } from '../lib/http.mjs';
import { getHarness, prepareCleanDispatch } from '../lib/harness.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test.beforeEach(async () => {
  const h = await getHarness();
  await prepareCleanDispatch(h);
});

function sotBody(h, jobId, driverId, extra = {}) {
  return {
    jobId,
    companyId: TEST_CID,
    driverId: String(driverId),
    vehicleId: String(driverId),
    events: [
      { type: 'Arrived', timestamp: new Date(Date.now() - 120_000).toISOString() },
      { type: 'OnBoard', timestamp: new Date(Date.now() - 60_000).toISOString() },
      { type: 'Completed', timestamp: new Date().toISOString() },
    ],
    tripSummary: {
      distance_km: 3.2,
      duration_mins: 12,
      fare: { base: 5, distanceCharge: 8, timeCharge: 2, extras: 0, total: 15, currency: 'NZD' },
      payment: { method: 'cash', received: 15, change: 0 },
    },
    ...extra,
  };
}

async function seedAssignedJob(h, driverId) {
  await h.ensureDriverReady(driverId);
  // Keep lastSeen fresh so NETWORK_OFFER_STALE_MS does not block assign.
  await h.configureDriver(driverId, {
    vehiclestatus: 'Available',
    lastSeen: Date.now(),
    lat: -46.412,
    lng: 168.353,
  });
  const jobId = await h.createAsapJob('sot-auth');
  await h.assignAccept(jobId, driverId);
  await h.poll(
    jobId,
    (t) => ['Assigned', 'Picking', 'Arrived', 'Active'].includes(String(t.jobStore?.lifecycle?.BookingStatus || '')),
    { timeoutMs: 30000 },
  );
  return jobId;
}

test('Phase 5a syncOfflineTrip: rejects missing auth', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const driverId = String(h.driverIds[0]);
  const jobId = await seedAssignedJob(h, driverId);

  const res = await post('/api/syncOfflineTrip', sotBody(h, jobId, driverId), {
    'Content-Type': 'application/json',
  });
  assert.equal(res.status, 401, JSON.stringify(res.body));
  assert.match(String(res.body?.error || ''), /X-User-Key|Admin/i);
});

test('Phase 5a syncOfflineTrip: accepts X-User-Key driver session', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const driverId = String(h.driverIds[0]);
  const jobId = await seedAssignedJob(h, driverId);

  const res = await post('/api/syncOfflineTrip', sotBody(h, jobId, driverId), {
    'Content-Type': 'application/json',
    'X-User-Key': `regtest-key-${driverId}`,
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body?.success, true);
  assert.ok(
    ['Completed', 'AlreadyClosed'].includes(String(res.body?.status || '')),
    JSON.stringify(res.body),
  );
});

test('Phase 5a syncOfflineTrip: rejects wrong driver ownership', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const ownerId = String(h.driverIds[0]);
  const otherId = String(h.driverIds[1]);
  const jobId = await seedAssignedJob(h, ownerId);

  await h.ensureDriverReady(otherId);

  const res = await post('/api/syncOfflineTrip', sotBody(h, jobId, otherId), {
    'Content-Type': 'application/json',
    'X-User-Key': `regtest-key-${otherId}`,
  });
  assert.equal(res.status, 403, JSON.stringify(res.body));
  assert.equal(res.body?.error_code, 'forbidden');
});

test('Phase 5a syncOfflineTrip: rejects body driverId spoof vs X-User-Key', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const ownerId = String(h.driverIds[0]);
  const otherId = String(h.driverIds[1]);
  const jobId = await seedAssignedJob(h, ownerId);

  await h.ensureDriverReady(otherId);

  // Session is otherId, but body claims ownerId — must refuse before ownership merge.
  const res = await post('/api/syncOfflineTrip', sotBody(h, jobId, ownerId), {
    'Content-Type': 'application/json',
    'X-User-Key': `regtest-key-${otherId}`,
  });
  assert.equal(res.status, 403, JSON.stringify(res.body));
  assert.equal(res.body?.error_code, 'forbidden');
});

test('Phase 5a syncOfflineTrip: admin key + driverId still works for tools', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const driverId = String(h.driverIds[1]);
  const jobId = await seedAssignedJob(h, driverId);

  const res = await post('/api/syncOfflineTrip', sotBody(h, jobId, driverId), {
    'Content-Type': 'application/json',
    'X-Admin-Key': ADMIN_KEY,
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body?.success, true);
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
