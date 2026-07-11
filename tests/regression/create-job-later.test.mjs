import test from 'node:test';
import assert from 'node:assert/strict';
import { DSR } from '../lib/config.mjs';
import { parseDataManager } from '../lib/http.mjs';
import { getHarness } from '../lib/harness.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

function futureNzDateTime(minutesAhead = 180) {
  const d = new Date(Date.now() + minutesAhead * 60_000);
  const sv = d.toLocaleString('sv', { timeZone: 'Pacific/Auckland' });
  return `${sv.slice(0, 10)} ${sv.slice(11, 13)}:${sv.slice(14, 16)}:00`;
}

function pastNzDateTime(minutesAgo = 180) {
  const d = new Date(Date.now() - minutesAgo * 60_000);
  const sv = d.toLocaleString('sv', { timeZone: 'Pacific/Auckland' });
  return `${sv.slice(0, 10)} ${sv.slice(11, 13)}:${sv.slice(14, 16)}:00`;
}

test('Create Job Later: InsertBookingv4 stores future pickup + dispatch window', async () => {
  const h = await getHarness();
  const dateTime = futureNzDateTime(240);
  const r = await h.dpost(DSR, 'InsertBookingv4', [
    'PickLocation', '122 Tweed Street, Invercargill',
    'DropLocation', '123 Elles Road, Invercargill',
    'Name', 'Later Regression',
    'PassengerId', '021 555 0199',
    'PassengersNo', '1',
    'VehicleType', 'Any',
    'Dispatchbefore', '30',
    'DispatchTimebefore', '30',
    'DateTime', dateTime,
    'DId', '0',
    'VId', '0',
    'DispatcherName', 'Regression',
    'EntitiesDetails', `REGTEST later ${Date.now()}`,
    'Source', 'Dispatch Console',
  ]);
  assert.equal(r.status, 200);
  const row = parseDataManager(r.body)[0];
  assert.equal(row?.Result, 'Booking Information Successfully Submitted');
  const bookingId = Number(row?.BookingId || 0);
  assert.ok(bookingId > 0);
  h.trackJob(bookingId);

  const trace = await h.poll(
    bookingId,
    (t) => t.jobStore?.found === true && t.firebase?.allbookings != null,
    { timeoutMs: 25000 },
  );
  const ab = trace.firebase.allbookings;
  assert.match(String(ab.BookingDateTime || ab.Pickingtime || ''), /^\d{4}-\d{2}-\d{2}/);
  assert.equal(String(ab.DispatchTimebefore || ab.Dispatchbefore || ''), '30');
  assert.ok(Number(ab.ScheduledFor || ab.ScheduledForMs || 0) > Date.now());
});

test('Create Job Later: past pickup is rejected by InsertBookingv4', async () => {
  const h = await getHarness();
  const dateTime = pastNzDateTime(120);
  const r = await h.dpost(DSR, 'InsertBookingv4', [
    'PickLocation', 'Past Pickup St, Invercargill',
    'DropLocation', 'Past Drop St, Invercargill',
    'Name', 'Past Regression',
    'PassengerId', '021 555 0188',
    'PassengersNo', '1',
    'VehicleType', 'Any',
    'Dispatchbefore', '30',
    'DispatchTimebefore', '30',
    'DateTime', dateTime,
    'DId', '0',
    'VId', '0',
    'DispatcherName', 'Regression',
    'EntitiesDetails', `REGTEST past ${Date.now()}`,
    'Source', 'Dispatch Console',
  ]);
  assert.equal(r.status, 200);
  const row = parseDataManager(r.body)[0];
  assert.equal(row?.Error, true);
  assert.match(String(row?.Result || ''), /past/i);
});
