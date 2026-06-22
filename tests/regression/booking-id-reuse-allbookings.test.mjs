import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret, DSR } from '../lib/config.mjs';
import { assertFirebaseHealthy, getHarness, prepareCleanDispatch } from '../lib/harness.mjs';
import {
  mergeStoreWithFirebaseCaches,
  staleTerminalAllbookingsSuperseded,
} from '../lib/jobPoolSync.mjs';

test('dispatch UI: stale terminal allbookings does not evict live Offered in pendingjobs', () => {
  const jobId = 8692606221;
  const pending = new Map([
    [
      jobId,
      {
        id: jobId,
        status: 'Offered',
        driverId: 'D001',
        updateSeq: 5,
        pickAddress: 'Live offer',
      },
    ],
  ]);
  const bookings = new Map();
  const abRec = { BookingId: String(jobId), BookingStatus: 'Completed', Status: 'Completed', updateSeq: 2 };

  assert.equal(
    staleTerminalAllbookingsSuperseded(jobId, abRec, pending, bookings, []),
    true,
    'newer Offered in pendingjobs must supersede stale Completed allbookings',
  );

  const merged = mergeStoreWithFirebaseCaches([], pending, bookings);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].status, 'Offered');
});

test('booking id reuse: complete then re-insert same Id clears stale terminal allbookings on offer', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);

  const driverId = h.driverIds[0];
  const reusedId = await h.createAsapJob('id-reuse-complete-first');
  await h.assignAccept(reusedId, driverId);
  await h.completeJob(reusedId, driverId, { fare: '18.00' });
  await h.poll(
    reusedId,
    (t) => t.jobStore?.closedFound === true || !t.jobStore?.found,
    { timeoutMs: 30000 },
  );

  const afterComplete = await h.jobTrace(reusedId);
  assert.equal(
    String(afterComplete.firebase?.allbookings?.BookingStatus || afterComplete.firebase?.allbookings?.Status),
    'Completed',
  );

  const marker = `REGTEST-reuse-${Date.now()}`;
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
      String(t.firebase?.allbookings?.BookingStatus || t.firebase?.allbookings?.Status) === 'Pending',
    { timeoutMs: 30000 },
  );

  // Simulate stale terminal row left behind (production bug shape).
  await h.setFirebaseBooking(reusedId, {
    BookingStatus: 'Completed',
    Status: 'Completed',
    updateSeq: 1,
  });

  await h.triggerAutoDispatch();
  const offered = await h.waitForAutoOffer(reusedId, driverId, { timeoutMs: 45000 });
  assert.equal(String(offered.jobStore.lifecycle.BookingStatus), 'Offered');
  assert.equal(
    String(offered.firebase?.allbookings?.BookingStatus || offered.firebase?.allbookings?.Status),
    'Offered',
    'offer fanout must SET over stale Completed allbookings on id reuse',
  );
  assert.notEqual(offered.dispatchUiHint?.jobStoreVsAllbookingsMismatch, true);
  assertFirebaseHealthy(offered, 'after id-reuse offer');

  await h.cancelAssigned(reusedId);
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
