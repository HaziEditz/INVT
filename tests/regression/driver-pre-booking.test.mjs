import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { assertFirebaseHealthy, assertStatusSync, getHarness } from '../lib/harness.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test('Phase 3 driver pre-booking: /api/pre-booking → Scheduled in jobStore + Firebase', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await h.ensureDriverReady(h.driverIds[0]);
  await h.configureDriver(h.driverIds[0], { vehicletype: 'Taxi', seatCapacity: 4 });

  const { response } = await h.createPreBookingViaApi({
    minutesAhead: 240,
    notesSuffix: 'driver-api',
    vehicleType: 'Taxi',
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.ok, true, JSON.stringify(response.body));
  assert.equal(response.body.updateSeq, 1, JSON.stringify(response.body));

  const bookingId = Number(response.body.bookingId || response.body.jobId || 0);
  assert.ok(bookingId > 0, JSON.stringify(response.body));
  h.trackJob(bookingId);

  const trace = await h.poll(
    bookingId,
    (t) =>
      t.jobStore?.found === true &&
      String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Scheduled' &&
      t.firebase?.allbookings != null &&
      t.firebase?.pendingjobs != null,
    { timeoutMs: 25000 },
  );

  assertStatusSync(trace, 'Scheduled', 'after pre-booking create');
  assert.equal(Number(trace.jobStore.rawFlags?.updateSeq ?? trace.jobStore.lifecycle?.updateSeq), 1);

  const ab = trace.firebase.allbookings;
  const pj = trace.firebase.pendingjobs;
  assert.equal(String(ab.BookingSource || ''), 'Driver App');
  assert.equal(String(pj.BookingSource || ''), 'Driver App');
  assert.ok(Number(ab.ScheduledFor || ab.ScheduledForMs || 0) > Date.now(), 'ScheduledFor must be future');
  assert.equal(Number(ab.ScheduledFor || ab.ScheduledForMs || 0), Number(pj.ScheduledFor || pj.ScheduledForMs || 0));
  assert.ok(String(ab.DispatchTimebefore || pj.DispatchTimebefore || '0') !== '0', 'DispatchTimebefore should be set');
  assert.ok(ab.NotifyDispatchAt || pj.NotifyDispatchAt, 'NotifyDispatchAt should be set');
  assertFirebaseHealthy(trace, 'after pre-booking create');

  await h.triggerAutoDispatch();
  const stillSched = await h.jobTrace(bookingId);
  assertStatusSync(stillSched, 'Scheduled', 'before release window — no auto-dispatch');
});

test('Phase 3 driver pre-booking: rejects ineligible vehicle type for creating driver', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const driverId = h.driverIds[0];
  await h.configureDriver(driverId, { vehicletype: 'Sedan', seatCapacity: 4 });

  const { response } = await h.createPreBookingViaApi({
    driverId,
    vehicleType: 'Van',
    passengers: 2,
    minutesAhead: 240,
  });

  assert.equal(response.status, 400, JSON.stringify(response.body));
  assert.equal(response.body.ok, false);
  assert.match(String(response.body.error || ''), /vehicle|seat|service/i);
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
