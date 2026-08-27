import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret, TEST_CID } from '../lib/config.mjs';
import { assertTerminalClean, getHarness, prepareCleanDispatch } from '../lib/harness.mjs';
import { post } from '../lib/http.mjs';
import {
  generatePickupPin,
  needsPickupVerification,
  computeNoShowWaitCharge,
  resolveFanoutBookingSource,
} from '../../lib/pickupResolution.cjs';

test('pickupResolution helpers: pin + no-show wait charge', () => {
  const pin = generatePickupPin();
  assert.match(pin, /^\d{4}$/);
  assert.equal(needsPickupVerification({ BookingSource: 'passenger', PickupPin: '1234' }), true);
  assert.equal(needsPickupVerification({ BookingSource: 'Hail', source: 'hail' }), false);
  assert.equal(needsPickupVerification({ BookingSource: 'Dispatch Console' }), false);

  const charge = computeNoShowWaitCharge(
    { ArrivedAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(), imComingAt: true },
    0.8,
  );
  assert.ok(charge.waitMinutes >= 7);
  assert.match(charge.reason, /No Show, waited \d+ minutes/);
  assert.equal(charge.waitingCharge, Math.round(charge.waitMinutes * 0.8 * 100) / 100);
  assert.equal(charge.extended, true);
});

test('resolveFanoutBookingSource: never invents DESK for passenger/PIN jobs', () => {
  assert.equal(
    resolveFanoutBookingSource({ BookingSource: 'PassengerApp' }),
    'PassengerApp',
  );
  assert.equal(
    resolveFanoutBookingSource({ BookingSource: 'passenger' }),
    'PassengerApp',
  );
  assert.equal(resolveFanoutBookingSource({ CreatedBy: 'APP' }), 'PassengerApp');
  assert.equal(
    resolveFanoutBookingSource({ PickupPin: '4242' }),
    'PassengerApp',
  );
  assert.equal(
    resolveFanoutBookingSource({}),
    'Dispatch Console',
  );
  assert.equal(
    resolveFanoutBookingSource({ BookingSource: 'Dispatch Console' }),
    'Dispatch Console',
  );
  // Must not prefer /api/complete junk over real passenger source
  assert.equal(
    resolveFanoutBookingSource({
      BookingSource: '/api/job/complete',
      Source: 'PassengerApp',
    }),
    'PassengerApp',
  );
});

test('accept/offer fanout preserves BookingSource+PickupPin onto allbookings', async () => {
  requireFirebaseSecret();
  const h = await getHarness({ fresh: true });
  await prepareCleanDispatch(h);
  const driverId = h.driverIds[0];
  await h.ensureDriverReady(driverId);
  const jobId = await h.createAsapJob('src-pin-fanout');
  await h.mutateJobStore(jobId, {
    BookingSource: 'PassengerApp',
    CreatedBy: 'APP',
    PickupPin: '7373',
    pickupPin: '7373',
  });
  await h.assignAccept(jobId, driverId);

  const ab = await h.firebasePeek(`allbookings/${h.companyId}/${jobId}`);
  assert.ok(ab && typeof ab === 'object', 'allbookings row missing');
  const src = String(ab.BookingSource || ab.Source || '');
  const pin = String(ab.PickupPin || ab.pickupPin || '');
  assert.match(src, /passenger/i, `expected passenger source, got ${src}`);
  assert.equal(pin, '7373', `expected PIN 7373, got ${pin}`);
  assert.ok(!/dispatch/i.test(src), `must not be DESK/dispatch: ${src}`);
  await prepareCleanDispatch(h);
});

test('dispatch jobs without pin: On Board still works (no gate)', async () => {
  requireFirebaseSecret();
  const h = await getHarness({ fresh: true });
  await prepareCleanDispatch(h);
  const driverId = h.driverIds[0];
  await h.ensureDriverReady(driverId);
  const jobId = await h.createAsapJob('pickup-no-pin');
  await h.assignAccept(jobId, driverId);
  assert.equal((await h.stageJob(jobId, driverId, 'Arrived')).body.ok, true);
  const active = await h.stageJob(jobId, driverId, 'Active');
  assert.equal(active.body.ok, true, JSON.stringify(active.body));
  await prepareCleanDispatch(h);
});

test('passenger pin job: Active blocked until verify-pickup', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);
  const driverId = h.driverIds[1];
  await h.ensureDriverReady(driverId);
  const jobId = await h.createAsapJob('pickup-pax-pin');
  await h.assignAccept(jobId, driverId);
  await h.mutateJobStore(jobId, {
    BookingSource: 'passenger',
    PickupPin: '4242',
    pickupPin: '4242',
  });
  assert.equal((await h.stageJob(jobId, driverId, 'Arrived')).body.ok, true);

  const blocked = await h.stageJob(jobId, driverId, 'Active');
  assert.equal(blocked.body.ok, false, JSON.stringify(blocked.body));
  assert.equal(blocked.body.error_code, 'pickup_unverified');

  const verify = await post(
    '/api/job/verify-pickup',
    { bookingId: jobId, driverId, nameConfirmed: true, pinConfirmed: true },
    h.adminHeaders,
  );
  assert.equal(verify.status, 200, JSON.stringify(verify.body));
  assert.equal(verify.body.ok, true);

  const onboard = await h.stageJob(jobId, driverId, 'Active');
  assert.equal(onboard.body.ok, true, JSON.stringify(onboard.body));
  await prepareCleanDispatch(h);
});

test('wrong-passenger recall at Arrived returns job to Pending', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);
  const driverId = h.driverIds[2];
  await h.ensureDriverReady(driverId);
  const jobId = await h.createAsapJob('wrong-pax-recall');
  await h.assignAccept(jobId, driverId);
  assert.equal((await h.stageJob(jobId, driverId, 'Arrived')).body.ok, true);

  const res = await post(
    '/api/cancel',
    {
      bookingId: jobId,
      companyId: TEST_CID,
      cancelledBy: 'driver',
      driverId,
      wrongPassenger: true,
      reason: 'Wrong passenger / uninvited — returned to pool',
    },
    h.adminHeaders,
  );
  assert.equal(res.body.ok, true, JSON.stringify(res.body));
  assert.equal(res.body.recalled, true);

  const trace = await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Pending',
    { timeoutMs: 25000 },
  );
  assert.equal(String(trace.jobStore.lifecycle.BookingStatus), 'Pending');
  assert.match(String(trace.jobStore.lifecycle.returnReason || ''), /wrong|uninvited|recall/i);
  assert.equal(trace.jobStore.closedFound, false);
  await prepareCleanDispatch(h);
});

test('No Show: I\'m coming + honest waited reason on closed job', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);
  const driverId = h.driverIds[0];
  await h.ensureDriverReady(driverId);
  const jobId = await h.createAsapJob('noshow-wait-charge');
  await h.assignAccept(jobId, driverId);
  assert.equal((await h.stageJob(jobId, driverId, 'Arrived')).body.ok, true);

  const im = await post(
    '/api/job/im-coming',
    { bookingId: jobId, companyId: TEST_CID },
    h.adminHeaders,
  );
  assert.equal(im.body.ok, true, JSON.stringify(im.body));

  const ns = await h.driverCancel(jobId, driverId, { noShow: true });
  assert.equal(ns.body.ok, true, JSON.stringify(ns.body));

  const finalTrace = await h.poll(
    jobId,
    (t) => t.jobStore?.closedFound === true || String(t.jobStore?.lifecycle?.BookingStatus || '') === 'No Show',
    { timeoutMs: 150000 },
  );
  assertTerminalClean(finalTrace, 'No Show', 'no show');
  const closed = finalTrace.jobStore?.lifecycle || {};
  const reason = String(closed.CancelReason || closed.NoShowReason || '');
  assert.match(reason, /No Show, waited \d+ minutes?/i);
  await prepareCleanDispatch(h);
});
