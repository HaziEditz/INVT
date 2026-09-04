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

test('exclusive: Sedan job rejects Van driver (no silent substitute)', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);
  const sedanDriver = h.driverIds[0];
  const vanDriver = h.driverIds[2];

  await ensureDriverInZone(h, sedanDriver, { vehicletype: 'Sedan', seatCapacity: 4 });
  await ensureDriverInZone(h, vanDriver, { vehicletype: 'Van', seatCapacity: 8 });

  const jobId = await h.createJobViaInsert({ vehicleType: 'Sedan', passengers: 1, notesSuffix: 'excl-sedan' });
  const seq0 = await h.readUpdateSeq(jobId);
  await h.bookingUpdate(jobId, { VehicleType: 'Sedan', vehicleType: 'Sedan', PassengersNo: '1' }, seq0);

  await ensureDriverInZone(h, vanDriver, { vehicletype: 'Van', seatCapacity: 8 });
  const badAssign = await h.assignJob(jobId, vanDriver, vanDriver);
  assert.notEqual(badAssign.body.ok, true, JSON.stringify(badAssign.body));
  assert.ok(
    badAssign.body.error_code === 'driver_ineligible' || badAssign.status >= 400,
    `expected ineligible van on sedan job, got ${badAssign.status} ${JSON.stringify(badAssign.body)}`,
  );

  await ensureDriverInZone(h, sedanDriver, { vehicletype: 'Sedan', seatCapacity: 4 });
  let goodAssign;
  for (let attempt = 0; attempt < 3; attempt++) {
    goodAssign = await h.assignJob(jobId, sedanDriver, sedanDriver);
    if (goodAssign.body.ok) break;
    if (goodAssign.body.error_code !== 'driver_not_in_zone') break;
    await ensureDriverInZone(h, sedanDriver, { vehicletype: 'Sedan', seatCapacity: 4 });
  }
  assert.equal(goodAssign.body.ok, true, JSON.stringify(goodAssign.body));
  await h.cancelAssigned(jobId);
});

test.afterEach(async () => {
  const h = await getHarness();
  await prepareCleanDispatch(h);
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
