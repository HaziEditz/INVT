import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { getHarness, prepareCleanDispatch } from '../lib/harness.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

async function ensureDriverInZone(h, driverId, props = {}) {
  await h.configureDriver(driverId, {
    passforlink: `regtest-key-${driverId}`,
    vehiclestatus: 'Available',
    lat: -46.412,
    lng: 168.353,
    zoneid: '1',
    zonename: 'Central',
    vehicletype: 'Sedan',
    seatCapacity: 4,
    ...props,
  });
  await h.driverStatusChanged(driverId, 'Available', {
    zonename: 'Central',
    vehiclenumber: String(driverId),
  });
}

test('Phase 3 eligibility: Van job rejects Sedan manual assign; Van driver succeeds', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);
  const sedanDriver = h.driverIds[0];
  const vanDriver = h.driverIds[2];

  await ensureDriverInZone(h, sedanDriver, { vehicletype: 'Sedan', seatCapacity: 4 });
  await ensureDriverInZone(h, vanDriver, { vehicletype: 'Van', seatCapacity: 8 });

  const jobId = await h.createJobViaInsert({ vehicleType: 'Van', passengers: 2, notesSuffix: 'van-job' });
  const seq0 = await h.readUpdateSeq(jobId);
  const vanUpdate = await h.bookingUpdate(
    jobId,
    { VehicleType: 'Van', vehicleType: 'Van', PassengersNo: '2' },
    seq0,
  );
  assert.equal(vanUpdate.body.ok, true, JSON.stringify(vanUpdate.body));

  await ensureDriverInZone(h, sedanDriver, { vehicletype: 'Sedan', seatCapacity: 4 });
  await ensureDriverInZone(h, vanDriver, { vehicletype: 'Van', seatCapacity: 8 });

  const badAssign = await h.assignJob(jobId, sedanDriver, sedanDriver);
  assert.notEqual(badAssign.body.ok, true, JSON.stringify(badAssign.body));
  assert.ok(
    badAssign.body.error_code === 'driver_ineligible' || badAssign.status >= 400,
    `expected ineligible assign, got ${badAssign.status} ${JSON.stringify(badAssign.body)}`,
  );

  await ensureDriverInZone(h, vanDriver, { vehicletype: 'Van', seatCapacity: 8 });
  let goodAssign;
  for (let attempt = 0; attempt < 3; attempt++) {
    goodAssign = await h.assignJob(jobId, vanDriver, vanDriver);
    if (goodAssign.body.ok) break;
    if (goodAssign.body.error_code !== 'driver_not_in_zone') break;
    await ensureDriverInZone(h, vanDriver, { vehicletype: 'Van', seatCapacity: 8 });
  }
  assert.equal(goodAssign.body.ok, true, JSON.stringify(goodAssign.body));

  const trace = await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered',
    { timeoutMs: 20000 },
  );
  assert.equal(String(trace.jobStore.lifecycle.DriverId), String(vanDriver));
  await h.cancelAssigned(jobId);
});

test.afterEach(async () => {
  const h = await getHarness();
  await prepareCleanDispatch(h);
});

test('Phase 3 eligibility: seat capacity blocks assign when passengers exceed capacity', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);
  const driverId = h.driverIds[1];
  await ensureDriverInZone(h, driverId, { vehicletype: 'Sedan', seatCapacity: 4 });

  const jobId = await h.createJobViaInsert({ vehicleType: 'Sedan', passengers: 6, notesSuffix: 'seats' });
  await ensureDriverInZone(h, driverId, { vehicletype: 'Sedan', seatCapacity: 4 });

  const res = await h.assignJob(jobId, driverId, driverId);
  assert.notEqual(res.body.ok, true, JSON.stringify(res.body));
  assert.equal(res.body.error_code, 'driver_ineligible');
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
