import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { getHarness, prepareCleanDispatch } from '../lib/harness.mjs';

const HARD_STALE_MS = 16 * 60 * 1000; // past NETWORK_OFFER_HARD_STALE_MS (15m)

test.before(async () => {
  await getHarness({ fresh: true });
});

test('P3 network offer: assign to pre-stale driver bounces with Network issue reason', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);

  const driverId = String(h.driverIds[0]);
  const other = String(h.driverIds[1]);

  // Keep a second Available fresh so soft-stale sole-retry does not apply.
  await h.ensureDriverReady(other);
  await h.configureDriver(other, {
    vehiclestatus: 'Available',
    lastSeen: Date.now(),
    lat: -46.412,
    lng: 168.353,
    zoneid: '1',
    zonename: 'Central',
  });
  await h.driverStatusChanged(other, 'Available', { lat: -46.412, lng: 168.353 }).catch(() => undefined);

  await h.ensureDriverReady(driverId);
  // lastSeen 55s ago → past NETWORK_OFFER_STALE_MS (45s). Must set AFTER ensureDriverReady.
  await h.configureDriver(driverId, {
    vehiclestatus: 'Available',
    lastSeen: Date.now() - 55_000,
    lat: -46.412,
    lng: 168.353,
    zoneid: '1',
    zonename: 'Central',
  });

  const jobId = await h.createAsapJob('network-offer-stale');
  let assignRes = await h.assignJob(jobId, driverId, driverId);
  // Full-suite isolation can drop ZONE_DRIVERS mid-run — re-seed once then retry.
  if (assignRes.body?.error_code === 'driver_not_in_zone') {
    await h.ensureDriverReady(other);
    await h.configureDriver(other, {
      vehiclestatus: 'Available',
      lastSeen: Date.now(),
      lat: -46.412,
      lng: 168.353,
    });
    await h.ensureDriverReady(driverId);
    await h.configureDriver(driverId, {
      vehiclestatus: 'Available',
      lastSeen: Date.now() - 55_000,
      lat: -46.412,
      lng: 168.353,
    });
    assignRes = await h.assignJob(jobId, driverId, driverId);
  }
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
  // Do not leave an in-flight Offered job for later suites (blocks company auto-dispatch).
  await h.cancelAssigned(jobId).catch(() => undefined);
  await h.mutateJobStore(jobId, {
    BookingStatus: 'Cancelled',
    DriverId: 0,
    VehicleId: 0,
    offeredAt: null,
    manualOffer: false,
  }).catch(() => undefined);
});

test('P3 network offer: all Available hard-stale still busy-pool broadcasts', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);

  const staleAvailable = String(h.driverIds[0]);
  const busyDriver = String(h.driverIds[1]);

  for (const did of h.driverIds) {
    if (did === staleAvailable || did === busyDriver) continue;
    await h.configureDriver(did, { vehiclestatus: 'Away', lastSeen: Date.now() });
    await h.driverStatusChanged(did, 'Away').catch(() => undefined);
  }

  // StatusChanged first (clears away-lock / queue), then freeze lastSeen HARD-stale so
  // sole soft-stale retry does not apply — Available collected but filtered unreachable.
  await h.driverStatusChanged(staleAvailable, 'Available', {
    lat: -46.412,
    lng: 168.353,
  });
  await h.configureDriver(staleAvailable, {
    vehiclestatus: 'Available',
    lastSeen: Date.now() - HARD_STALE_MS,
    lat: -46.412,
    lng: 168.353,
  });

  await h.driverStatusChanged(busyDriver, 'Busy', {
    lat: -46.412,
    lng: 168.353,
  });
  await h.configureDriver(busyDriver, {
    vehiclestatus: 'Busy',
    lastSeen: Date.now(),
    lat: -46.412,
    lng: 168.353,
  });

  const jobId = await h.createAsapJob('network-stale-busy-pool');
  let tick = null;
  let companyTick = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    // Re-freeze hard-stale lastSeen each attempt — DriverStatusChanged / other ticks can refresh it.
    await h.configureDriver(staleAvailable, {
      vehiclestatus: 'Available',
      lastSeen: Date.now() - HARD_STALE_MS,
      lat: -46.412,
      lng: 168.353,
    });
    await h.configureDriver(busyDriver, {
      vehiclestatus: 'Busy',
      lastSeen: Date.now(),
      lat: -46.412,
      lng: 168.353,
    });
    tick = await h.triggerAutoDispatch();
    companyTick =
      tick?.lastAutoDispatchTick?.perCompany?.[h.companyId] ||
      tick?.lastAutoDispatchTick?.perCompany?.bwtest ||
      null;
    if (
      companyTick?.action === 'busy_pool_broadcast' &&
      /network-stale/i.test(String(companyTick?.skipReason || ''))
    ) {
      break;
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  assert.ok(
    companyTick,
    `missing company tick report: ${JSON.stringify(tick?.lastAutoDispatchTick)}`,
  );
  assert.equal(
    companyTick.action,
    'busy_pool_broadcast',
    `expected busy_pool_broadcast when Available are hard network-stale; got ${JSON.stringify(companyTick)}`,
  );
  assert.match(
    String(companyTick.skipReason || ''),
    /network-stale/i,
    `expected network-stale busy-pool path, got ${JSON.stringify(companyTick)}`,
  );
  assert.ok(
    Number(companyTick.availableDrivers) >= 1,
    `expected Available candidates present but unreachable; got ${JSON.stringify(companyTick)}`,
  );

  const trace = await h.poll(
    jobId,
    (t) => t.firebase?.pendingjobs != null,
    { timeoutMs: 20000 },
  );
  assert.ok(trace.firebase?.pendingjobs, 'pendingjobs must exist for busy Offer tab');
  const reason = String(
    trace.jobStore?.lifecycle?.returnReason ||
      trace.jobStore?.rawFlags?.returnReason ||
      trace.firebase?.pendingjobs?.returnReason ||
      trace.firebase?.pendingjobs?.ReturnReason ||
      '',
  );
  assert.match(reason, /Network issue/i);

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
