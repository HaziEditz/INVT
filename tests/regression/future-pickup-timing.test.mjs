/**
 * Future pickup vs ASAP/Later timing — guards, classification, repair.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { getHarness } from '../lib/harness.mjs';

const FUTURE_PICKUP_LEAD_MS = 60_000;

function jobScheduledTime(job) {
  if (job.scheduledFor && job.scheduledFor > 0) {
    const d = new Date(job.scheduledFor);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const raw = String(job.bookingDateTime ?? '').trim();
  if (!raw) return null;
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isMissingLaterMetadata(job) {
  const status = String(job.status || 'Pending');
  return (
    (job.dispatchBeforeMinutes ?? 0) === 0 &&
    !job.notifyDispatchAt &&
    !(job.scheduledFor != null && job.scheduledFor > 0) &&
    status !== 'Scheduled'
  );
}

function isFuturePickupTime(job, now = new Date()) {
  const pickup = jobScheduledTime(job);
  return !!(pickup && pickup.getTime() > now.getTime() + FUTURE_PICKUP_LEAD_MS);
}

function isPreBookedJob(job, now = new Date()) {
  const dispatchBefore = job.dispatchBeforeMinutes ?? 0;
  const status = String(job.status || 'Pending');
  if (dispatchBefore > 0) return true;
  if (job.notifyDispatchAt) return true;
  if (status === 'Scheduled') return true;
  const pickup = jobScheduledTime(job);
  if (pickup && pickup.getTime() > now.getTime() + FUTURE_PICKUP_LEAD_MS) return true;
  if (dispatchBefore === 0 && !job.notifyDispatchAt && !job.scheduledFor && status !== 'Scheduled') {
    return false;
  }
  if (!pickup) return false;
  if (pickup.getTime() > now.getTime()) return true;
  if (job.createdAt && pickup.getTime() - job.createdAt > FUTURE_PICKUP_LEAD_MS) return true;
  return false;
}

function jobPickupTypeLabel(job) {
  if (!isPreBookedJob(job) && String(job.bookingType || '').toUpperCase() !== 'SCHEDULED') {
    return 'ASAP';
  }
  return 'LATER';
}

function parseBookingDateTime(dt) {
  if (!dt.trim()) return { date: '2026-07-14', hour: '16', min: '37' };
  const normalized = dt.includes('T') ? dt : dt.trim().replace(' ', 'T');
  const d = new Date(normalized);
  const sv = d.toLocaleString('sv', { timeZone: 'Pacific/Auckland' });
  return { date: sv.slice(0, 10), hour: sv.slice(11, 13), min: sv.slice(14, 16) };
}

function jobToFormTiming(job, now = new Date()) {
  const bookingDt = job.bookingDateTime || '';
  const parsed = parseBookingDateTime(bookingDt);
  const inferredLaterFromFuturePickup = isMissingLaterMetadata(job) && isFuturePickupTime(job, now);
  const isLater =
    (job.dispatchBeforeMinutes ?? 0) > 0 ||
    job.status === 'Scheduled' ||
    isPreBookedJob(job, now) ||
    inferredLaterFromFuturePickup;
  let dispatchBeforeMin = job.dispatchBeforeMinutes ?? 10;
  if (isLater && (dispatchBeforeMin ?? 0) <= 0) dispatchBeforeMin = 10;
  return { timing: isLater ? 'later' : 'now', laterDate: parsed.date, dispatchBeforeMin };
}

function validateLaterPickupDispatch(form, nowMs = Date.now()) {
  if (form.timing !== 'later') return null;
  const pickup = new Date(`${form.laterDate}T${form.laterHour}:${form.laterMin}:00`);
  if (Number.isNaN(pickup.getTime())) return 'invalid';
  if (pickup.getTime() > nowMs + FUTURE_PICKUP_LEAD_MS && (form.dispatchBeforeMin ?? 0) <= 0) {
    return 'dispatch required';
  }
  return null;
}

test('isPreBookedJob: future bookingDateTime only classifies as LATER (not ASAP)', () => {
  const future = new Date(Date.now() + 86_400_000);
  const bookingDateTime = future.toISOString().replace('T', ' ').slice(0, 19);
  const job = {
    status: 'Pending',
    bookingDateTime,
    dispatchBeforeMinutes: 0,
    scheduledFor: undefined,
    notifyDispatchAt: undefined,
  };
  assert.equal(isPreBookedJob(job), true);
  assert.equal(jobPickupTypeLabel(job), 'LATER');
});

test('isPreBookedJob: explicit Later→Now with past pickup stays ASAP', () => {
  const past = new Date(Date.now() - 3_600_000);
  const job = {
    status: 'Pending',
    bookingDateTime: past.toISOString().replace('T', ' ').slice(0, 19),
    dispatchBeforeMinutes: 0,
    createdAt: Date.now(),
  };
  assert.equal(isPreBookedJob(job), false);
  assert.equal(jobPickupTypeLabel(job), 'ASAP');
});

test('jobToForm: contradictory future pickup infers timing later with default dispatch window', () => {
  const bookingDateTime = '2026-07-14 16:37:00';
  const form = jobToFormTiming({
    status: 'Pending',
    bookingDateTime,
    dispatchBeforeMinutes: 0,
  });
  assert.equal(form.timing, 'later');
  assert.equal(form.dispatchBeforeMin, 10);
  assert.equal(form.laterDate, '2026-07-14');
});

test('validateLaterPickupForm: future pickup rejects dispatch=0', () => {
  const future = new Date(Date.now() + 86_400_000);
  const err = validateLaterPickupDispatch({
    timing: 'later',
    laterDate: future.toISOString().slice(0, 10),
    laterHour: '16',
    laterMin: '37',
    dispatchBeforeMin: 0,
  });
  assert.equal(err, 'dispatch required');
});

function readDispatchBefore(trace) {
  const ab = trace.firebase?.allbookings;
  return Number(ab?.DispatchTimebefore ?? ab?.Dispatchbefore ?? 0);
}

function readScheduledFor(trace) {
  const ab = trace.firebase?.allbookings;
  return Number(ab?.ScheduledFor ?? ab?.ScheduledForMs ?? 0);
}

test.before(async () => {
  await getHarness({ fresh: true });
});

test('Phase 3 timing: future pickup with dispatch=0 auto-promotes to Scheduled (not Pending/ASAP)', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const jobId = await h.createAsapJob('future-pickup-autopromote');
  const future = new Date(Date.now() + 26 * 3600_000);
  const dateTime = future.toLocaleString('sv-SE', { timeZone: 'Pacific/Auckland' }).replace('T', ' ');

  const seq = await h.readUpdateSeq(jobId);
  const save = await h.bookingUpdate(
    jobId,
    {
      BookingDateTime: dateTime,
      Pickingtime: dateTime,
      DispatchTimebefore: '0',
      Dispatchbefore: '0',
    },
    seq,
  );
  assert.equal(save.body.ok, true, JSON.stringify(save.body));

  const after = await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Scheduled',
    { timeoutMs: 25000 },
  );
  assert.equal(String(after.jobStore?.lifecycle?.BookingStatus || ''), 'Scheduled');
  assert.ok(readDispatchBefore(after) > 0);
  assert.ok(readScheduledFor(after) > 0);

  await h.cancelUnassigned(jobId);
});

test('Phase 3 timing: repair contradictory job restores Scheduled Later metadata', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const jobId = await h.createAsapJob('future-pickup-repair');
  const futureMs = Date.now() + 26 * 3600_000;
  const dateTime = new Date(futureMs).toLocaleString('sv-SE', { timeZone: 'Pacific/Auckland' }).replace('T', ' ');

  await h.mutateJobStore(jobId, {
    BookingDateTime: dateTime,
    Pickingtime: dateTime,
    DispatchTimebefore: '0',
    Dispatchbefore: '0',
    ScheduledFor: 0,
    ScheduledForMs: 0,
    NotifyDispatchAt: '',
    BookingStatus: 'Pending',
    Status: 'Pending',
  });

  const repair = await h.repairBooking(jobId, 'future_pickup');
  assert.equal(repair.body.ok, true, JSON.stringify(repair.body));

  const after = await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Scheduled',
    { timeoutMs: 25000 },
  );
  assert.equal(String(after.jobStore?.lifecycle?.BookingStatus || ''), 'Scheduled');
  assert.ok(readDispatchBefore(after) > 0);

  await h.cancelUnassigned(jobId);
});

test('Phase 3 timing: known contradiction shape #8692607136 reloads as LATER after repair', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const jobId = await h.createAsapJob('future-pickup-known-shape');
  const bookingDateTime = '2026-07-14 16:37:00';
  const futureMs = Date.parse(bookingDateTime.replace(' ', 'T'));

  await h.mutateJobStore(jobId, {
    BookingDateTime: bookingDateTime,
    Pickingtime: bookingDateTime,
    DispatchTimebefore: '0',
    Dispatchbefore: '0',
    ScheduledFor: 0,
    ScheduledForMs: 0,
    NotifyDispatchAt: '',
    BookingStatus: 'Pending',
    Status: 'Pending',
  });

  const broken = await h.jobTrace(jobId);
  const brokenJob = {
    status: 'Pending',
    bookingDateTime,
    dispatchBeforeMinutes: 0,
    scheduledFor: undefined,
    notifyDispatchAt: undefined,
  };
  assert.equal(isPreBookedJob(brokenJob), true, 'classification should be LATER after P1 fix');
  assert.equal(jobToFormTiming(brokenJob, new Date(futureMs - 3600_000)).timing, 'later');

  const repair = await h.repairBooking(jobId, 'future_pickup');
  assert.equal(repair.body.ok, true, JSON.stringify(repair.body));

  const after = await h.jobTrace(jobId);
  assert.equal(String(after.jobStore?.lifecycle?.BookingStatus || ''), 'Scheduled');
  assert.ok(readDispatchBefore(after) > 0);

  await h.cancelUnassigned(jobId);
});
