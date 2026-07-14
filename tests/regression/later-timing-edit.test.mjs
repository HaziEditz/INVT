/**
 * Later timing integrity + tariff round-trip on metadata-only edits.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { getHarness } from '../lib/harness.mjs';

function readFirebasePickupMs(node) {
  if (!node || typeof node !== 'object') return 0;
  const sched = Number(node.ScheduledFor ?? node.ScheduledForMs ?? 0);
  if (sched > 0) return sched;
  const raw = String(node.BookingDateTime ?? node.Pickingtime ?? '').trim();
  if (!raw) return 0;
  const ms = Date.parse(raw.replace(' ', 'T'));
  return Number.isNaN(ms) ? 0 : ms;
}

function readFirebaseTariffId(node) {
  if (!node || typeof node !== 'object') return '';
  return String(node.TarriffId ?? node.TariffId ?? node.tariffId ?? '').trim();
}

function readFirebaseTariffName(node) {
  if (!node || typeof node !== 'object') return '';
  return String(
    node.TarriffName ?? node.TariffName ?? node.TarriffType ?? node.tariffName ?? '',
  ).trim();
}

test.before(async () => {
  await getHarness({ fresh: true });
});

test('Phase 3 legacy Later: metadata edit preserves ScheduledFor and timing fields', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const { bookingId } = await h.createScheduledJob({
    minutesAhead: 240,
    dispatchBefore: 30,
    notesSuffix: 'legacy-later-meta',
  });

  const before = await h.jobTrace(bookingId);
  const beforeAb = before.firebase?.allbookings;
  const pickupMs = readFirebasePickupMs(beforeAb);
  assert.ok(pickupMs > Date.now(), 'scheduled pickup should be in the future');

  await h.mutateJobStore(bookingId, {
    DispatchTimebefore: '0',
    Dispatchbefore: '0',
    ScheduledFor: pickupMs,
    ScheduledForMs: pickupMs,
    BookingStatus: 'Scheduled',
    Status: 'Scheduled',
  });

  const seq = await h.readUpdateSeq(bookingId);
  const save = await h.bookingUpdate(
    bookingId,
    { VehicleType: 'Van', TarriffId: '2', TarriffName: 'Regression Tariff B' },
    seq,
  );
  assert.equal(save.body.ok, true, JSON.stringify(save.body));

  const after = await h.poll(
    bookingId,
    (t) => String(t.jobStore?.lifecycle?.VehicleType || '') === 'Van',
    { timeoutMs: 25000 },
  );

  const afterAb = after.firebase?.allbookings;
  const afterPickup = readFirebasePickupMs(afterAb);
  assert.ok(afterPickup > Date.now(), 'pickup time must survive metadata-only edit');
  assert.equal(
    String(after.jobStore?.lifecycle?.BookingStatus || ''),
    'Scheduled',
    'metadata edit must not demote Scheduled Later job to ASAP Pending',
  );

  await h.cancelUnassigned(bookingId);
});

test('Phase 3 tariff: ASAP job saves tariff id/name and round-trips on jobStore', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const jobId = await h.createAsapJob('tariff-roundtrip-asap');

  const seq = await h.readUpdateSeq(jobId);
  const save = await h.bookingUpdate(
    jobId,
    { TarriffId: '7', TarriffName: 'Regression Tariff Seven' },
    seq,
  );
  assert.equal(save.body.ok, true, JSON.stringify(save.body));

  const after = await h.poll(
    jobId,
    (t) => readFirebaseTariffId(t.firebase?.allbookings) === '7',
    { timeoutMs: 25000 },
  );

  assert.equal(readFirebaseTariffId(after.firebase?.allbookings), '7');
  assert.match(readFirebaseTariffName(after.firebase?.allbookings), /Regression Tariff Seven/i);

  await h.cancelUnassigned(jobId);
});

test('Phase 3 tariff: fresh create then tariff update round-trips through Firebase allbookings', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const jobId = await h.createAsapJob('tariff-roundtrip-fresh');

  let seq = await h.readUpdateSeq(jobId);
  let save = await h.bookingUpdate(
    jobId,
    { TarriffId: '3', TarriffName: 'Regression Tariff Three' },
    seq,
  );
  assert.equal(save.body.ok, true, JSON.stringify(save.body));

  seq = await h.readUpdateSeq(jobId);
  save = await h.bookingUpdate(
    jobId,
    { TarriffId: '5', TarriffName: 'Regression Tariff Five' },
    seq,
  );
  assert.equal(save.body.ok, true, JSON.stringify(save.body));

  const after = await h.poll(
    jobId,
    (t) => readFirebaseTariffId(t.firebase?.allbookings) === '5',
    { timeoutMs: 25000 },
  );

  assert.equal(readFirebaseTariffId(after.firebase?.allbookings), '5');
  assert.match(readFirebaseTariffName(after.firebase?.allbookings), /Regression Tariff Five/i);

  await h.cancelUnassigned(jobId);
});

test('Phase 3 Later: Pending/No One persist before dispatch window opens', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  // Far-future pickup + short window → still pre-dispatch at save time.
  const { bookingId } = await h.createScheduledJob({
    minutesAhead: 240,
    dispatchBefore: 15,
    notesSuffix: 'later-pool-prewindow',
  });

  const before = await h.jobTrace(bookingId);
  assert.equal(String(before.jobStore?.lifecycle?.BookingStatus || ''), 'Scheduled');

  const noOne = await h.setNoOne(bookingId);
  assert.equal(noOne.response.body.ok, true, JSON.stringify(noOne.response.body));

  const afterNoOne = await h.poll(
    bookingId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'No One',
    { timeoutMs: 20000 },
  );
  assert.equal(String(afterNoOne.jobStore?.lifecycle?.BookingStatus || ''), 'No One');
  assert.equal(String(afterNoOne.firebase?.allbookings?.DriverId ?? ''), '-1');

  const pending = await h.setPending(bookingId);
  assert.equal(pending.response.body.ok, true, JSON.stringify(pending.response.body));

  const afterPending = await h.poll(
    bookingId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Pending',
    { timeoutMs: 20000 },
  );
  assert.equal(String(afterPending.jobStore?.lifecycle?.BookingStatus || ''), 'Pending');

  await h.cancelUnassigned(bookingId);
});
