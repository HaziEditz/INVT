import '../lib/loadEnv.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_KEY, TEST_CID, requireFirebaseSecret } from '../lib/config.mjs';
import { get } from '../lib/http.mjs';
import { getHarness, prepareCleanDispatch } from '../lib/harness.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

async function forceClearOfferedJobs(h) {
  await h.cancelAllOffered();
  await h.cancelAllLiveJobs();
  // Cancel APIs / jobTrace lists can miss jobStore-only Offered rows. Mutate every
  // harness-tracked id and anything still listed as Offered.
  for (const id of [...h.createdJobIds]) {
    await h.mutateJobStore(id, {
      BookingStatus: 'Cancelled',
      DriverId: 0,
      VehicleId: 0,
      offeredAt: null,
      manualOffer: false,
    }).catch(() => undefined);
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await get(
      `/admin/jobTrace?cid=${encodeURIComponent(TEST_CID)}&status=Offered`,
      { 'X-Admin-Key': ADMIN_KEY },
    );
    const jobs = r.status === 200 && Array.isArray(r.body?.jobs) ? r.body.jobs : [];
    if (!jobs.length) return;
    for (const j of jobs) {
      await h.mutateJobStore(j.id, {
        BookingStatus: 'Cancelled',
        DriverId: 0,
        VehicleId: 0,
        offeredAt: null,
        manualOffer: false,
      }).catch(() => undefined);
    }
  }
}

test.beforeEach(async () => {
  const h = await getHarness();
  await prepareCleanDispatch(h);
  // One leftover Offered job blocks company auto-dispatch (mid-offer redispatch).
  await forceClearOfferedJobs(h);
  for (const did of h.driverIds) {
    await h.driverStatusChanged(did, 'Available').catch(() => undefined);
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

/** One heal+offer tick, with alt lastSeen refreshed immediately before the tick. */
async function tickRedispatch(h, freshDriverIds = []) {
  for (const did of freshDriverIds.map(String)) {
    await h.configureDriver(did, {
      vehiclestatus: 'Available',
      lastSeen: Date.now(),
      lat: -46.412,
      lng: 168.353,
    });
  }
  return h.triggerAutoDispatch();
}

test('C2: mid-offer driver quiet >10s releases and redispatches to another driver', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const staleDriver = String(h.driverIds[0]);
  const altDriver = String(h.driverIds[1]);

  await parkExtraDrivers(h, [staleDriver, altDriver]);
  await h.ensureDriverReady(staleDriver);
  await h.ensureDriverReady(altDriver);
  await h.configureDriver(staleDriver, { vehiclestatus: 'Available', lastSeen: Date.now() });
  await h.configureDriver(altDriver, { vehiclestatus: 'Available', lastSeen: Date.now() });

  const jobId = await h.createAsapJob('mid-offer-network-bounce');
  const assignRes = await h.assignJob(jobId, staleDriver, staleDriver);
  assert.equal(assignRes.body?.ok, true, `assign failed: ${JSON.stringify(assignRes.body)}`);

  await h.poll(
    jobId,
    (t) =>
      String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered' &&
      String(t.jobStore?.lifecycle?.DriverId || '') === staleDriver,
    { timeoutMs: 30000 },
  );

  await h.configureDriver(staleDriver, {
    vehiclestatus: 'Available',
    lastSeen: Date.now() - 11_000,
  });

  let lastTick = null;
  let lastSnap = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    lastTick = await tickRedispatch(h, [altDriver]);
    lastSnap = await h.jobTrace(jobId);
    const st = String(lastSnap.jobStore?.lifecycle?.BookingStatus || '');
    const drv = String(lastSnap.jobStore?.lifecycle?.DriverId || '');
    if (st === 'Offered' && drv === altDriver) break;
    await new Promise((r) => setTimeout(r, 400));
  }

  assert.equal(
    String(lastSnap?.jobStore?.lifecycle?.BookingStatus || ''),
    'Offered',
    `C2 expected Offered to ${altDriver} after mid-offer bounce; got ${JSON.stringify({
      lifecycle: lastSnap?.jobStore?.lifecycle,
      flags: lastSnap?.jobStore?.rawFlags,
      tick: lastTick?.lastAutoDispatchTick?.perCompany?.bwtest,
    })}`,
  );
  assert.equal(String(lastSnap.jobStore.lifecycle.DriverId), altDriver);
});

test('C2: mid-offer driver quiet <=10s keeps offer on same driver', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const driverId = String(h.driverIds[0]);
  await parkExtraDrivers(h, [driverId]);
  await h.ensureDriverReady(driverId);
  await h.configureDriver(driverId, { vehiclestatus: 'Available', lastSeen: Date.now() });

  const jobId = await h.createAsapJob('mid-offer-network-fresh');
  const assignRes = await h.assignJob(jobId, driverId, driverId);
  assert.equal(assignRes.body?.ok, true, `assign failed: ${JSON.stringify(assignRes.body)}`);

  await h.poll(
    jobId,
    (t) =>
      String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered' &&
      String(t.jobStore?.lifecycle?.DriverId || '') === driverId,
    { timeoutMs: 30000 },
  );

  await h.configureDriver(driverId, {
    vehiclestatus: 'Available',
    lastSeen: Date.now() - 5_000,
  });

  await h.triggerAutoDispatch();
  await h.triggerAutoDispatch();

  const trace = await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered',
    { timeoutMs: 20000 },
  );
  assert.equal(String(trace.jobStore.lifecycle.DriverId), driverId);
});

test('C3: network bounce bypasses release cooldown when alt driver becomes available', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const staleDriver = String(h.driverIds[0]);
  const altDriver = String(h.driverIds[1]);

  await parkExtraDrivers(h, [staleDriver, altDriver]);
  await h.ensureDriverReady(staleDriver);
  await h.ensureDriverReady(altDriver);
  await h.configureDriver(staleDriver, { vehiclestatus: 'Available', lastSeen: Date.now() });

  const jobId = await h.createAsapJob('mid-offer-cooldown-bypass');
  const assignRes = await h.assignJob(jobId, staleDriver, staleDriver);
  assert.equal(assignRes.body?.ok, true, `assign failed: ${JSON.stringify(assignRes.body)}`);
  await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered',
    { timeoutMs: 30000 },
  );

  await h.configureDriver(altDriver, { vehiclestatus: 'Away', lastSeen: Date.now() });
  await h.driverStatusChanged(altDriver, 'Away');

  await h.configureDriver(staleDriver, {
    vehiclestatus: 'Available',
    lastSeen: Date.now() - 12_000,
  });

  await h.triggerAutoDispatch();

  const released = await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Pending',
    { timeoutMs: 45000 },
  );
  assert.match(
    String(
      released.jobStore?.lifecycle?.returnReason ||
        released.jobStore?.rawFlags?.returnReason ||
        '',
    ),
    /Network issue/i,
  );

  await h.configureDriver(altDriver, {
    vehiclestatus: 'Available',
    lastSeen: Date.now(),
    lat: -46.412,
    lng: 168.353,
  });
  await h.driverStatusChanged(altDriver, 'Available');

  let lastTick = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    lastTick = await tickRedispatch(h, [altDriver]);
    const trace = await h.jobTrace(jobId);
    const st = String(trace.jobStore?.lifecycle?.BookingStatus || '');
    const drv = String(trace.jobStore?.lifecycle?.DriverId || '');
    if (st === 'Offered' && drv === altDriver) break;
    await new Promise((r) => setTimeout(r, 400));
  }

  const after = await h.poll(
    jobId,
    (t) =>
      String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered' &&
      String(t.jobStore?.lifecycle?.DriverId || '') === altDriver,
    { timeoutMs: 45000 },
  );
  assert.equal(
    String(after.jobStore.lifecycle.DriverId),
    altDriver,
    `lastTick=${JSON.stringify(lastTick?.lastAutoDispatchTick?.perCompany?.bwtest)}`,
  );
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
