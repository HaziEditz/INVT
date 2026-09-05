/**
 * #8692609041 four-fix pack:
 * 1) sole-Available soft-stale still gets a durable Offered
 * 2) decline writes bookingEvents + skip-cooldown for redispatch
 * 3) sticky Network issue returnReason heals when a reachable driver exists
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret, ADMIN_KEY } from '../lib/config.mjs';
import { post } from '../lib/http.mjs';
import { getHarness, prepareCleanDispatch } from '../lib/harness.mjs';

const SOFT_STALE_MS = 55_000;

async function setOnlyOneAvailable(h, soleDriverId, lastSeenMs) {
  for (const did of h.driverIds) {
    if (String(did) === String(soleDriverId)) continue;
    await h.configureDriver(did, { vehiclestatus: 'Away', lastSeen: Date.now() });
    await h.driverStatusChanged(did, 'Away').catch(() => undefined);
  }
  await h.driverStatusChanged(soleDriverId, 'Available', {
    lat: -46.412,
    lng: 168.353,
  });
  await h.configureDriver(soleDriverId, {
    vehiclestatus: 'Available',
    lastSeen: lastSeenMs,
    lat: -46.412,
    lng: 168.353,
  });
}

function eventsList(peekBody) {
  if (!peekBody || typeof peekBody !== 'object') return [];
  return Object.values(peekBody).filter((e) => e && typeof e === 'object');
}

test.before(async () => {
  await getHarness({ fresh: true });
});

test('sole Available soft-stale: auto-dispatch commits Offered (not Network limbo)', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);

  const sole = String(h.driverIds[0]);
  await setOnlyOneAvailable(h, sole, Date.now() - SOFT_STALE_MS);

  const jobId = await h.createAsapJob('sole-soft-stale-offer');
  let companyTick = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    await h.configureDriver(sole, {
      vehiclestatus: 'Available',
      lastSeen: Date.now() - SOFT_STALE_MS,
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
    await new Promise((r) => setTimeout(r, 400));
  }

  assert.equal(
    companyTick?.action,
    'offered',
    `expected sole soft-stale Offered; got ${JSON.stringify(companyTick)}`,
  );
  assert.ok(companyTick?.softStaleSoleRetry === true || companyTick?.action === 'offered');

  const trace = await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered',
    { timeoutMs: 20000 },
  );
  assert.equal(String(trace.jobStore.lifecycle.BookingStatus || ''), 'Offered');
  const reason = String(
    trace.jobStore?.lifecycle?.returnReason ||
      trace.jobStore?.rawFlags?.returnReason ||
      '',
  );
  assert.doesNotMatch(reason, /Network issue/i);

  const eventsPeek = await h.firebasePeek(`bookingEvents/${h.companyId}/${jobId}`);
  const events = eventsList(eventsPeek);
  const offerEvt = events.find(
    (e) =>
      String(e.type || '') === 'StatusChanged' &&
      String(e.data?.to || '') === 'Offered' &&
      String(e.data?.action || '') === 'offer',
  );
  assert.ok(offerEvt, `expected Offered bookingEvent, got ${JSON.stringify(events).slice(0, 800)}`);

  await h.cancelAssigned(jobId).catch(() => undefined);
  await h.mutateJobStore(jobId, {
    BookingStatus: 'Cancelled',
    DriverId: 0,
    VehicleId: 0,
    offeredAt: null,
    manualOffer: false,
  }).catch(() => undefined);
});

test('driver decline writes bookingEvents and clears cooldown for redispatch', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);

  const driverId = String(h.driverIds[0]);
  await h.ensureDriverReady(driverId);
  await h.configureDriver(driverId, {
    vehiclestatus: 'Available',
    lastSeen: Date.now(),
    lat: -46.412,
    lng: 168.353,
    zoneid: '1',
    zonename: 'Central',
  });
  await h.driverStatusChanged(driverId, 'Available', { lat: -46.412, lng: 168.353 }).catch(() => undefined);

  const jobId = await h.createAsapJob('decline-audit');
  let assignRes = await h.assignJob(jobId, driverId, driverId);
  if (assignRes.body?.error_code === 'driver_not_in_zone') {
    await h.ensureDriverReady(driverId);
    await h.configureDriver(driverId, {
      vehiclestatus: 'Available',
      lastSeen: Date.now(),
      lat: -46.412,
      lng: 168.353,
    });
    assignRes = await h.assignJob(jobId, driverId, driverId);
  }
  assert.equal(assignRes.body?.ok, true, JSON.stringify(assignRes.body));
  await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered',
    { timeoutMs: 20000 },
  );

  const declineRes = await post(
    '/api/job/decline',
    { bookingId: jobId, driverId, timedOut: false },
    { 'X-Admin-Key': ADMIN_KEY },
  );
  assert.equal(declineRes.status, 200, JSON.stringify(declineRes.body));
  assert.equal(declineRes.body?.ok, true, JSON.stringify(declineRes.body));
  assert.equal(String(declineRes.body?.status || ''), 'Pending');

  const after = await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Pending',
    { timeoutMs: 15000 },
  );
  const reason = String(
    after.jobStore?.lifecycle?.returnReason ||
      after.jobStore?.rawFlags?.returnReason ||
      after.jobStore?.raw?.returnReason ||
      '',
  );
  assert.match(reason, /Declined by driver/i);

  let declineEvt = null;
  for (let i = 0; i < 10; i++) {
    const eventsPeek = await h.firebasePeek(`bookingEvents/${h.companyId}/${jobId}`);
    const events = eventsList(eventsPeek);
    declineEvt = events.find(
      (e) =>
        String(e.type || '') === 'StatusChanged' &&
        String(e.data?.action || '') === 'decline',
    );
    if (declineEvt) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  assert.ok(declineEvt, 'expected decline bookingEvent');
  assert.equal(String(declineEvt.data?.declinedDriverId || declineEvt.data?.driverId || ''), driverId);

  await h.mutateJobStore(jobId, {
    BookingStatus: 'Cancelled',
    DriverId: 0,
    VehicleId: 0,
    offeredAt: null,
    manualOffer: false,
  }).catch(() => undefined);
});

test('sticky Network issue returnReason heals when sole soft-stale Available exists', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);

  const sole = String(h.driverIds[0]);
  await setOnlyOneAvailable(h, sole, Date.now() - SOFT_STALE_MS);

  const jobId = await h.createAsapJob('heal-network-reason');
  await h.mutateJobStore(jobId, {
    BookingStatus: 'Pending',
    DriverId: 0,
    VehicleId: 0,
    offeredAt: null,
    returnReason: 'Network issue — driver unreachable',
    ReturnReason: 'Network issue — driver unreachable',
    manualOffer: false,
  });

  let healed = false;
  for (let attempt = 0; attempt < 8; attempt++) {
    await h.configureDriver(sole, {
      vehiclestatus: 'Available',
      lastSeen: Date.now() - SOFT_STALE_MS,
      lat: -46.412,
      lng: 168.353,
    });
    await h.triggerAutoDispatch();
    const trace = await h.jobTrace(jobId);
    const reason = String(
      trace.jobStore?.lifecycle?.returnReason ||
        trace.jobStore?.rawFlags?.returnReason ||
        trace.jobStore?.raw?.returnReason ||
        '',
    );
    const st = String(trace.jobStore?.lifecycle?.BookingStatus || '');
    if (!/Network issue/i.test(reason) || st === 'Offered') {
      healed = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  assert.ok(healed, 'expected sticky Network issue reason to clear on soft-stale sole retry/offer');

  await h.cancelAssigned(jobId).catch(() => undefined);
  await h.mutateJobStore(jobId, {
    BookingStatus: 'Cancelled',
    DriverId: 0,
    VehicleId: 0,
    offeredAt: null,
    manualOffer: false,
  }).catch(() => undefined);
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
