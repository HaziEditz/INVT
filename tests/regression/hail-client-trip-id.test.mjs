import '../lib/loadEnv.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { TEST_CID, requireFirebaseSecret } from '../lib/config.mjs';
import { post } from '../lib/http.mjs';
import { getHarness, prepareCleanDispatch } from '../lib/harness.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test.beforeEach(async () => {
  const h = await getHarness();
  await prepareCleanDispatch(h);
});

function hailCreateBody(h, driverId, clientTripId, extra = {}) {
  return {
    companyId: TEST_CID,
    source: 'hail',
    driverId: String(driverId),
    vehicleId: String(driverId),
    tariffId: 'regtest-tariff',
    clientTripId,
    pickup: {
      address: '1 Dee St, Invercargill',
      lat: -46.4121,
      lng: 168.3531,
    },
    dropoff: {
      address: '1 Dee St, Invercargill',
      lat: -46.4121,
      lng: 168.3531,
    },
    passengers: 1,
    ...extra,
  };
}

test('Phase 5b hail create: clientTripId create-or-get is idempotent', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const driverId = String(h.driverIds[0]);
  await h.ensureDriverReady(driverId);
  await h.configureDriver(driverId, {
    vehiclestatus: 'Available',
    lastSeen: Date.now(),
    lat: -46.4121,
    lng: 168.3531,
  });

  const clientTripId = randomUUID();
  const body = hailCreateBody(h, driverId, clientTripId);

  const first = await post('/api/job/create', body, { 'Content-Type': 'application/json' });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body?.ok, true);
  assert.equal(String(first.body?.clientTripId), clientTripId);
  assert.equal(first.body?.idempotent, false);
  assert.ok(!first.body?.existing);
  const jobId = String(first.body?.jobId ?? first.body?.bookingId ?? '');
  assert.match(jobId, /^\d+$/);

  const second = await post('/api/job/create', body, { 'Content-Type': 'application/json' });
  assert.equal(second.status, 200, JSON.stringify(second.body));
  assert.equal(second.body?.ok, true);
  assert.equal(String(second.body?.jobId ?? second.body?.bookingId), jobId);
  assert.equal(String(second.body?.clientTripId), clientTripId);
  assert.equal(second.body?.idempotent, true);
  assert.equal(second.body?.existing, true);

  const third = await post('/api/job/create', body, { 'Content-Type': 'application/json' });
  assert.equal(third.status, 200, JSON.stringify(third.body));
  assert.equal(String(third.body?.jobId ?? third.body?.bookingId), jobId);
  assert.equal(third.body?.existing, true);
});

test('Phase 5b hail create: different clientTripId allocates a new job', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const driverId = String(h.driverIds[0]);
  await h.ensureDriverReady(driverId);
  await h.configureDriver(driverId, {
    vehiclestatus: 'Available',
    lastSeen: Date.now(),
    lat: -46.4121,
    lng: 168.3531,
  });

  const a = await post(
    '/api/job/create',
    hailCreateBody(h, driverId, randomUUID()),
    { 'Content-Type': 'application/json' },
  );
  const b = await post(
    '/api/job/create',
    hailCreateBody(h, driverId, randomUUID()),
    { 'Content-Type': 'application/json' },
  );
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(b.status, 200, JSON.stringify(b.body));
  const idA = String(a.body?.jobId ?? '');
  const idB = String(b.body?.jobId ?? '');
  assert.match(idA, /^\d+$/);
  assert.match(idB, /^\d+$/);
  assert.notEqual(idA, idB);
});

test('Phase 5b hail create: invalid clientTripId rejected', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const driverId = String(h.driverIds[0]);
  await h.ensureDriverReady(driverId);

  const res = await post(
    '/api/job/create',
    hailCreateBody(h, driverId, 'bad id with spaces'),
    { 'Content-Type': 'application/json' },
  );
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(String(res.body?.error || ''), /clientTripId/i);
});
