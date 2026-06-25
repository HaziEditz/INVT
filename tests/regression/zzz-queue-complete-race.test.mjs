import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret, TEST_CID, DSR } from '../lib/config.mjs';
import { assertFirebaseHealthy, getHarness, prepareCleanDispatch } from '../lib/harness.mjs';
import { get, post, parseDataManager } from '../lib/http.mjs';
import { pollFirebasePeek } from '../lib/jobTrace.mjs';
import { driverBlockedFromAutoDispatch } from '../lib/queuePromotionHold.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test('queue promotion hold blocks auto-dispatch while Queued job exists', () => {
  const jobs = [
    { Id: 100, companyId: 'co', DriverId: 'D1', BookingStatus: 'Queued' },
    { Id: 200, companyId: 'co', DriverId: 'D2', BookingStatus: 'Pending' },
  ];
  const driver = { driverid: 'D1', vehiclestatus: 'Available', lat: 1, lng: 2, companyId: 'co' };
  const r = driverBlockedFromAutoDispatch(jobs, new Map(), driver, 'co');
  assert.equal(r.blocked, true);
  assert.equal(r.reason, 'queued_job_pending');
});

test('complete → queue promotion wins over competing auto-dispatch offer', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);

  const hailDriver = h.driverIds[2];
  const otherDrivers = h.driverIds.filter((id) => id !== hailDriver);
  for (const id of otherDrivers) {
    await h.driverStatusChanged(id, 'Away', { zonename: 'Central' });
  }

  const busyRes = await h.driverStatusChanged(hailDriver, 'Busy', {
    zonename: 'Central',
    lat: -46.4121,
    lng: 168.3531,
    vehiclenumber: String(hailDriver),
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
  const activeJobId = activeList[0].id;

  const queuedJobId = await createPoolJobRelaxed(h, 'race-queued');
  await h.triggerAutoDispatch();
  await h.poll(
    queuedJobId,
    (t) => {
      const st = String(t.jobStore?.lifecycle?.BookingStatus || '');
      return st === 'Pending' || st === 'Offered' || st === 'No One';
    },
    { timeoutMs: 45000 },
  );

  const queueAccept = await h.acceptJob(queuedJobId, hailDriver);
  assert.equal(queueAccept.status, 200, JSON.stringify(queueAccept.body));
  assert.equal(queueAccept.body.queued, true, JSON.stringify(queueAccept.body));

  await h.poll(
    queuedJobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Queued',
    { timeoutMs: 25000 },
  );

  const anyVehicleJobId = await createPoolJobRelaxed(h, 'race-any-vehicle');
  await h.poll(
    anyVehicleJobId,
    (t) => {
      const st = String(t.jobStore?.lifecycle?.BookingStatus || '');
      return st === 'Pending' || st === 'No One';
    },
    { timeoutMs: 30000 },
  );

  const completeRes = await h.completeJob(activeJobId, hailDriver, { fare: '30.00' });
  assert.equal(completeRes.body?.ok, true, JSON.stringify(completeRes.body));

  await h.poll(
    activeJobId,
    (t) => t.jobStore?.closedFound === true || !t.jobStore?.found,
    { timeoutMs: 30000 },
  );

  await h.configureDriver(hailDriver, {
    vehiclestatus: 'Available',
    lat: -46.4121,
    lng: 168.3531,
    zonename: 'Central',
  });

  for (let i = 0; i < 3; i++) {
    await h.triggerAutoDispatch();
  }

  const anyTrace = await h.poll(
    anyVehicleJobId,
    (t) => {
      const st = String(t.jobStore?.lifecycle?.BookingStatus || '');
      if (st === 'Offered') {
        const offeredDrv = String(t.jobStore?.lifecycle?.DriverId || '');
        return offeredDrv !== String(hailDriver);
      }
      return st === 'Pending' || st === 'No One';
    },
    { timeoutMs: 20000 },
  );
  const anySt = String(anyTrace.jobStore?.lifecycle?.BookingStatus || '');
  const anyDrv = String(anyTrace.jobStore?.lifecycle?.DriverId || '');
  assert.ok(
    anySt !== 'Offered' || anyDrv !== String(hailDriver),
    `competing any-vehicle job must not be Offered to queue driver; got status=${anySt} driver=${anyDrv}`,
  );

  const queuedStill = await h.poll(
    queuedJobId,
    (t) => t.jobStore?.found === true && String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Queued',
    { timeoutMs: 15000 },
  );
  assert.equal(String(queuedStill.jobStore.lifecycle.DriverId), String(hailDriver));

  await h.configureDriver(hailDriver, {
    vehiclestatus: 'Available',
    lat: -46.4121,
    lng: 168.3531,
    zonename: 'Central',
  });
  await h.driverStatusChanged(hailDriver, 'Available', {
    zonename: 'Central',
    vehiclenumber: String(hailDriver),
  });

  let promoteRes;
  for (let attempt = 0; attempt < 4; attempt++) {
    promoteRes = await post(
      '/api/job/promote-queued',
      { bookingId: queuedJobId, driverId: String(hailDriver), companyId: TEST_CID },
      h.adminHeaders,
    );
    if (promoteRes.status === 200 && promoteRes.body?.ok) break;
    const retryable = promoteRes.body?.error_code === 'presence_attach_failed';
    if (!retryable || attempt === 3) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  assert.equal(promoteRes.status, 200, JSON.stringify(promoteRes.body));
  assert.equal(promoteRes.body.ok, true, JSON.stringify(promoteRes.body));

  const promoted = await h.poll(
    queuedJobId,
    (t) => {
      if (String(t.jobStore?.lifecycle?.BookingStatus || '') !== 'Assigned') return false;
      const nodes = t.firebase?.jobsDriverNode || {};
      const jobsLinked = Object.values(nodes).some(
        (n) => n && String(n.BookingStatus || n.Status || '') === 'Assigned',
      );
      const ab = t.firebase?.allbookings;
      const abAssigned = ab && String(ab.BookingStatus || ab.Status) === 'Assigned';
      return jobsLinked && abAssigned;
    },
    { timeoutMs: 60000 },
  );
  assert.equal(String(promoted.jobStore.lifecycle.DriverId), String(hailDriver));
  assertFirebaseHealthy(promoted, 'after queue promote');

  const onlinePath = resolveOnlineCurrentPath(promoted, hailDriver);
  const onlineNode = await pollFirebasePeek(
    onlinePath,
    (n) => n && String(n.currentJobId || n.jobId || '') === String(queuedJobId),
    { timeoutMs: 45000 },
  );
  assert.ok(onlineNode, `online/current must reference promoted job #${queuedJobId} at ${onlinePath}`);

  await h.recallQueuedJob(queuedJobId).catch(() => undefined);
  await h.cancelAssigned(queuedJobId).catch(() => undefined);
  await h.cancelAssigned(anyVehicleJobId).catch(() => undefined);
  for (const id of otherDrivers) {
    await h.driverStatusChanged(id, 'Available', { zonename: 'Central' });
  }
  await h.driverStatusChanged(hailDriver, 'Available', { zonename: 'Central', vehiclenumber: String(hailDriver) });
});

test.afterEach(async () => {
  const h = await getHarness();
  const hailDriver = h.driverIds[2];
  for (const status of ['Active', 'Queued', 'Assigned', 'Offered']) {
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

/** Match online/{cid}/{vid}/current to the vehicle id used in jobs/{cid}/{vid}/… fanout. */
function resolveOnlineCurrentPath(trace, driverId, companyId = TEST_CID) {
  const jobsNodes = trace.firebase?.jobsDriverNode || {};
  for (const [path, node] of Object.entries(jobsNodes)) {
    if (!node || String(node.BookingStatus || node.Status || '') !== 'Assigned') continue;
    const m = path.match(/^jobs\/[^/]+\/([^/]+)\/[^/]+\/\d+$/);
    if (m) return `online/${companyId}/${m[1]}/current`;
  }
  return `online/${companyId}/${String(driverId)}/current`;
}

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
