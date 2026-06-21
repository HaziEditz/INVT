import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret, TEST_CID, DSR } from '../lib/config.mjs';
import { assertFirebaseHealthy, getHarness, prepareCleanDispatch } from '../lib/harness.mjs';
import { get, parseDataManager } from '../lib/http.mjs';
import { pollFirebasePeek } from '../lib/jobTrace.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test.beforeEach(async () => {
  const h = await getHarness();
  await prepareCleanDispatch(h);
});

test('Queue while busy: accept pool job during Hail trip syncs Queued to allbookings (no split-brain)', async () => {
  requireFirebaseSecret();
  const h = await getHarness();

  const hailDriver = h.driverIds[2];
  const otherDrivers = h.driverIds.filter((id) => id !== hailDriver);

  for (const id of otherDrivers) {
    await h.driverStatusChanged(id, 'Away', { zonename: 'Central' });
  }

  const busyRes = await h.driverStatusChanged(hailDriver, 'Busy', {
    zonename: 'Central',
    lat: -46.4121,
    lng: 168.3531,
  });
  assert.equal(busyRes.status, 200);

  await h.configureDriver(hailDriver, {
    vehiclestatus: 'Busy',
    lat: -46.4121,
    lng: 168.3531,
    zonename: 'Central',
  });

  const activeList = await pollActiveForDriver(h, hailDriver);
  assert.ok(activeList.length >= 1, 'expected Active Hail trip job after Busy status');
  const hailJobId = activeList[0].id;

  const poolJobId = await createPoolJobRelaxed(h, 'hail-busy-pool');
  await h.triggerAutoDispatch();

  await h.poll(
    poolJobId,
    (t) => {
      const st = String(t.jobStore?.lifecycle?.BookingStatus || '');
      const pj = t.firebase?.pendingjobs;
      return st === 'Pending' && pj && String(pj.BookingStatus || pj.Status || '') === 'Pending';
    },
    { timeoutMs: 45000 },
  );

  const hailStillActive = await h.poll(
    hailJobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Active',
    { timeoutMs: 10000 },
  );
  assert.equal(String(hailStillActive.jobStore.lifecycle.BookingStatus), 'Active');

  const acceptRes = await h.acceptJob(poolJobId, hailDriver);
  assert.equal(acceptRes.status, 200, JSON.stringify(acceptRes.body));
  assert.equal(acceptRes.body.ok, true, JSON.stringify(acceptRes.body));
  assert.equal(acceptRes.body.queued, true, JSON.stringify(acceptRes.body));

  const queued = await h.poll(
    poolJobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Queued',
    { timeoutMs: 25000 },
  );
  assert.equal(String(queued.jobStore.lifecycle.BookingStatus), 'Queued');
  assert.equal(String(queued.jobStore.lifecycle.DriverId), String(hailDriver));
  assert.equal(queued.splitBrainDiagnosis?.detected, false, JSON.stringify(queued.splitBrainDiagnosis));
  assertFirebaseHealthy(queued, 'after hail-busy accept');

  const ab = queued.firebase?.allbookings;
  assert.ok(ab, 'allbookings node should exist for Queued job');
  assert.equal(String(ab.BookingStatus || ab.Status), 'Queued');
  assert.equal(String(ab.DriverId), String(hailDriver));

  const dqPath = `driverQueue/${TEST_CID}/${hailDriver}/queued/${poolJobId}`;
  const dqNode = await pollFirebasePeek(
    dqPath,
    (n) => n && String(n.BookingId || n.jobId || '') === String(poolJobId),
    { timeoutMs: 20000 },
  );
  assert.ok(dqNode, `driverQueue node missing at ${dqPath}`);

  await h.recallQueuedJob(poolJobId);
  await h.poll(
    poolJobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Pending',
    { timeoutMs: 30000 },
  );

  for (const id of otherDrivers) {
    await h.driverStatusChanged(id, 'Available', { zonename: 'Central' });
  }
  await h.driverStatusChanged(hailDriver, 'Available', { zonename: 'Central' });
});

test.afterEach(async () => {
  const h = await getHarness();
  const hailDriver = h.driverIds[2];
  for (const status of ['Active', 'Queued', 'Assigned']) {
    const r = await get(
      `/admin/jobTrace?cid=${encodeURIComponent(TEST_CID)}&status=${status}`,
      h.adminHeaders,
    );
    if (r.status !== 200 || !Array.isArray(r.body.jobs)) continue;
    for (const j of r.body.jobs) {
      if (String(j.driverId) !== String(hailDriver)) continue;
      await h.cancelAssigned(j.id).catch(() => undefined);
    }
  }
  await prepareCleanDispatch(h);
});

async function pollActiveForDriver(h, driverId) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const r = await get(
      `/admin/jobTrace?cid=${encodeURIComponent(TEST_CID)}&status=Active`,
      h.adminHeaders,
    );
    assert.equal(r.status, 200);
    const jobs = (r.body.jobs || []).filter((j) => String(j.driverId) === String(driverId));
    if (jobs.length) return jobs;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`no Active job for driver ${driverId} within timeout`);
}

async function createPoolJobRelaxed(h, notesSuffix) {
  const marker = `REGTEST-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const r = await h.dpost(DSR, 'InsertBookingv4', [
    'PickLocation', '1 Dee St, Invercargill',
    'DropLocation', 'Invercargill Airport',
    'Name', 'Regression Passenger',
    'PassengerId', '021 555 0101',
    'PassengersNo', '1',
    'BagsNo', '0',
    'VehicleType', 'Any',
    'Dispatchbefore', '0',
    'DispatchTimebefore', '0',
    'DateTime', '',
    'DId', '0',
    'VId', '0',
    'bookstatus', 'Pending',
    'DispatcherName', 'Regression',
    'EntitiesDetails', `REGTEST ${marker} ${notesSuffix}`,
    'Source', 'Dispatch Console',
  ]);
  assert.equal(r.status, 200);
  const rows = parseDataManager(r.body);
  const row = Array.isArray(rows) ? rows[0] : rows;
  const bookingId = Number(row?.BookingId || row?.bookingId || 0);
  assert.ok(bookingId > 0, JSON.stringify(row));
  await h.poll(
    bookingId,
    (trace) =>
      trace.jobStore?.found === true &&
      (trace.firebase?.allbookings != null || trace.firebase?.pendingjobs != null),
    { timeoutMs: 45000 },
  );
  return bookingId;
}

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
