/**
 * #8692609056 — shared decline/timeout flicker root:
 * After decline/timeout, do not instantly re-offer the same driver (causes Offer
 * flicker → mid-offer Network bounce with false "Network issue" label).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireFirebaseSecret, ADMIN_KEY } from '../lib/config.mjs';
import { post } from '../lib/http.mjs';
import { getHarness, prepareCleanDispatch } from '../lib/harness.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const src = readFileSync(join(root, 'server.js'), 'utf8');

test('decline/timeout stamps same-driver offer cooldown (shared with network bounce)', () => {
  assert.match(src, /function _stampSameDriverOfferCooldown\s*\(/);
  assert.match(src, /OFFER_SAME_DRIVER_COOLDOWN_MS/);
  assert.match(src, /_stampSameDriverOfferCooldown\(job,\s*driverId/);
  assert.match(src, /same-driver offer cooldown/);
  assert.match(src, /_allAvailableOnlySameDriverCooldown/);
});

test('after decline, auto-dispatch does not re-offer same driver within cooldown', async () => {
  requireFirebaseSecret();
  const h = await getHarness({ fresh: true });
  await prepareCleanDispatch(h);

  const sole = String(h.driverIds[0]);
  for (const did of h.driverIds) {
    if (String(did) === sole) continue;
    await h.configureDriver(did, { vehiclestatus: 'Away', lastSeen: Date.now() });
    await h.driverStatusChanged(did, 'Away').catch(() => undefined);
  }
  await h.ensureDriverReady(sole);
  await h.driverStatusChanged(sole, 'Available', { lat: -46.412, lng: 168.353 }).catch(() => undefined);
  await h.configureDriver(sole, {
    vehiclestatus: 'Available',
    lastSeen: Date.now(),
    lat: -46.412,
    lng: 168.353,
    zoneid: '1',
    zonename: 'Central',
  });

  const jobId = await h.createAsapJob('decline-no-instant-reoffer');
  let assignRes = await h.assignJob(jobId, sole, sole);
  if (assignRes.body?.error_code === 'driver_not_in_zone') {
    await h.ensureDriverReady(sole);
    assignRes = await h.assignJob(jobId, sole, sole);
  }
  assert.equal(assignRes.body?.ok, true, JSON.stringify(assignRes.body));
  await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered',
    { timeoutMs: 20000 },
  );

  const declineRes = await post(
    '/api/job/decline',
    { bookingId: jobId, driverId: sole, timedOut: false },
    { 'X-Admin-Key': ADMIN_KEY },
  );
  assert.equal(declineRes.body?.ok, true, JSON.stringify(declineRes.body));

  // Re-park extras each tick — suite pollution can flip them Available.
  let companyTick = null;
  for (let i = 0; i < 4; i++) {
    for (const did of h.driverIds) {
      if (String(did) === sole) continue;
      await h.configureDriver(did, { vehiclestatus: 'Away', lastSeen: Date.now() });
    }
    await h.configureDriver(sole, {
      vehiclestatus: 'Available',
      lastSeen: Date.now(),
      lat: -46.412,
      lng: 168.353,
    });
    const tick = await h.triggerAutoDispatch();
    companyTick =
      tick?.lastAutoDispatchTick?.perCompany?.[h.companyId] ||
      tick?.lastAutoDispatchTick?.perCompany?.bwtest ||
      null;
    if (companyTick?.action === 'offered' && Number(companyTick?.targetJobId) === Number(jobId)) {
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  assert.notEqual(
    companyTick?.action,
    'offered',
    `must not instantly re-offer same driver after decline; got ${JSON.stringify(companyTick)}`,
  );

  const trace = await h.jobTrace(jobId);
  const st = String(trace.jobStore?.lifecycle?.BookingStatus || '');
  assert.equal(st, 'Pending', `expected stay Pending on U-A, got ${st}`);
  const reason = String(
    trace.jobStore?.lifecycle?.returnReason ||
      trace.jobStore?.rawFlags?.returnReason ||
      '',
  );
  assert.match(reason, /Declined by driver/i);
  assert.doesNotMatch(reason, /Network issue/i);

  await h.mutateJobStore(jobId, {
    BookingStatus: 'Cancelled',
    DriverId: 0,
    VehicleId: 0,
    offeredAt: null,
    manualOffer: false,
    _networkFailedDriverUntil: 0,
    _offerBlockedDriverUntil: 0,
  }).catch(() => undefined);
  await h.cleanupAll().catch(() => undefined);
});

test('after decline cooldown, other Available driver can be offered immediately', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);

  const declined = String(h.driverIds[0]);
  const alt = String(h.driverIds[1]);
  for (const did of h.driverIds) {
    if (did === declined || did === alt) continue;
    await h.configureDriver(did, { vehiclestatus: 'Away', lastSeen: Date.now() });
    await h.driverStatusChanged(did, 'Away').catch(() => undefined);
  }

  await h.ensureDriverReady(declined);
  await h.ensureDriverReady(alt);
  await h.configureDriver(declined, {
    vehiclestatus: 'Available',
    lastSeen: Date.now(),
    lat: -46.412,
    lng: 168.353,
  });
  await h.configureDriver(alt, {
    vehiclestatus: 'Available',
    lastSeen: Date.now(),
    lat: -46.413,
    lng: 168.354,
  });

  const jobId = await h.createAsapJob('decline-alt-driver');
  let assignRes = await h.assignJob(jobId, declined, declined);
  if (!assignRes.body?.ok) {
    await h.ensureDriverReady(declined);
    assignRes = await h.assignJob(jobId, declined, declined);
  }
  assert.equal(assignRes.body?.ok, true, JSON.stringify(assignRes.body));
  await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered',
    { timeoutMs: 20000 },
  );

  const declineRes = await post(
    '/api/job/decline',
    { bookingId: jobId, driverId: declined, timedOut: false },
    { 'X-Admin-Key': ADMIN_KEY },
  );
  assert.equal(declineRes.body?.ok, true, JSON.stringify(declineRes.body));

  let offeredTo = null;
  for (let i = 0; i < 8; i++) {
    await h.configureDriver(alt, {
      vehiclestatus: 'Available',
      lastSeen: Date.now(),
      lat: -46.413,
      lng: 168.354,
    });
    await h.configureDriver(declined, {
      vehiclestatus: 'Available',
      lastSeen: Date.now(),
      lat: -46.412,
      lng: 168.353,
    });
    const tick = await h.triggerAutoDispatch();
    const companyTick =
      tick?.lastAutoDispatchTick?.perCompany?.[h.companyId] ||
      tick?.lastAutoDispatchTick?.perCompany?.bwtest ||
      null;
    if (companyTick?.action === 'offered' && Number(companyTick?.targetJobId) === Number(jobId)) {
      offeredTo = String(companyTick.targetDriverId || '');
      break;
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  assert.ok(offeredTo, 'expected alt driver offer after decline');
  assert.notEqual(offeredTo, declined, `must offer alt driver, not declined ${declined}; got ${offeredTo}`);

  await h.cancelAssigned(jobId).catch(() => undefined);
  await h.mutateJobStore(jobId, {
    BookingStatus: 'Cancelled',
    DriverId: 0,
    VehicleId: 0,
    offeredAt: null,
    manualOffer: false,
  }).catch(() => undefined);
});
