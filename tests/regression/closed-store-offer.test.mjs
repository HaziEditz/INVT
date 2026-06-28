import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret, DSR } from '../lib/config.mjs';
import { assertFirebaseHealthy, getHarness, prepareCleanDispatch } from '../lib/harness.mjs';

test('booking id reuse: stale closedJobStore must not purge live Offered on auto-dispatch reconcile', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);

  const driverId = h.driverIds[0];
  await h.ensureDriverReady(driverId);
  const reusedId = await h.createAsapJob('closed-store-offer-first');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await h.assignAccept(reusedId, driverId);
      break;
    } catch (err) {
      if (attempt === 2) throw err;
      await h.ensureDriverReady(driverId);
    }
  }
  await h.completeJob(reusedId, driverId, { fare: '18.00' });
  await h.poll(
    reusedId,
    (t) => t.jobStore?.closedFound === true || !t.jobStore?.found,
    { timeoutMs: 30000 },
  );

  const marker = `REGTEST-closed-offer-${Date.now()}`;
  const insert = await h.dpost(DSR, 'InsertBookingv4', [
    'ExternalJobId', String(reusedId),
    'PickLocation', '3 Dee St, Invercargill',
    'DropLocation', 'Invercargill Hospital',
    'Name', 'Reuse Passenger',
    'PassengerId', '021 555 0888',
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
    'EntitiesDetails', marker,
    'Source', 'Dispatch Console',
  ]);
  assert.equal(insert.status, 200, JSON.stringify(insert.body).slice(0, 400));

  await h.poll(
    reusedId,
    (t) =>
      t.jobStore?.found === true &&
      String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Pending' &&
      (t.closedStoreDiagnosis?.staleClosedEntryCount ?? 0) === 0,
    { timeoutMs: 30000 },
  );

  // Stale terminal allbookings from prior completion (production bug shape).
  await h.setFirebaseBooking(reusedId, {
    BookingStatus: 'Completed',
    Status: 'Completed',
    updateSeq: 1,
  });

  await h.triggerAutoDispatch();
  const offered = await h.waitForAutoOffer(reusedId, driverId, { timeoutMs: 90000 });
  assert.equal(String(offered.jobStore.lifecycle.BookingStatus), 'Offered');
  assert.equal(offered.jobStore?.found, true, 'live Offered must survive auto-dispatch reconcile');
  assert.equal(
    offered.closedStoreDiagnosis?.staleClosedEntryCount ?? 0,
    0,
    'stale closedJobStore history must be evicted on offer',
  );
  assert.equal(offered.closedStoreDiagnosis?.updateBookingBug, false);
  assert.equal(
    String(offered.firebase?.allbookings?.BookingStatus || offered.firebase?.allbookings?.Status),
    'Offered',
    'offer fanout must heal stale Completed allbookings on id reuse',
  );
  assertFirebaseHealthy(offered, 'after closed-store offer heal');

  await h.cancelAssigned(reusedId);
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
