import '../lib/loadEnv.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { getHarness, prepareCleanDispatch } from '../lib/harness.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test.beforeEach(async () => {
  const h = await getHarness();
  await prepareCleanDispatch(h);
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

async function nudgeAutoDispatch(h, times = 2) {
  for (let i = 0; i < times; i++) {
    await h.triggerAutoDispatch();
    await new Promise((r) => setTimeout(r, 250));
  }
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
  await h.configureDriver(altDriver, {
    vehiclestatus: 'Available',
    lastSeen: Date.now(),
  });

  await nudgeAutoDispatch(h, 3);

  const after = await h.poll(
    jobId,
    (t) => {
      const st = String(t.jobStore?.lifecycle?.BookingStatus || '');
      const drv = String(t.jobStore?.lifecycle?.DriverId || '');
      return st === 'Offered' && drv === altDriver;
    },
    { timeoutMs: 60000 },
  );

  assert.equal(String(after.jobStore.lifecycle.BookingStatus), 'Offered');
  assert.equal(String(after.jobStore.lifecycle.DriverId), altDriver);
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
    lastSeen: Date.now() - 9_000,
  });

  await nudgeAutoDispatch(h, 2);

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

  await nudgeAutoDispatch(h, 3);

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
  });
  await h.driverStatusChanged(altDriver, 'Available');

  await nudgeAutoDispatch(h, 3);

  await h.poll(
    jobId,
    (t) =>
      String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered' &&
      String(t.jobStore?.lifecycle?.DriverId || '') === altDriver,
    { timeoutMs: 45000 },
  );
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
