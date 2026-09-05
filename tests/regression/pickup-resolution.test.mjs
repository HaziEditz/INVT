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
  // Prepaid Website / Card / paid — any source — needs verify (visible PIN)
  assert.equal(
    needsPickupVerification({ BookingSource: 'Website', paymentStatus: 'paid' }),
    true,
  );
  assert.equal(
    needsPickupVerification({ BookingSource: 'Website', PaymentType: 'Card' }),
    true,
  );
  assert.equal(
    needsPickupVerification({ BookingSource: 'Dispatch Console', PaymentType: 'Account' }),
    true,
  );
  // Cash website still skips
  assert.equal(
    needsPickupVerification({
      BookingSource: 'Website',
      PaymentType: 'Cash',
      paymentStatus: '',
    }),
    false,
  );

  const charge = computeNoShowWaitCharge(
    { ArrivedAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(), imComingAt: true },
    0.8,
  );
  assert.ok(charge.waitMinutes >= 7);
  assert.match(charge.reason, /No Show, waited \d+ minutes/);
  assert.equal(charge.waitingCharge, Math.round(charge.waitMinutes * 0.8 * 100) / 100);
  assert.equal(charge.extended, true);
});

test('resolveFanoutBookingSource: Website+PIN stays Website (not PassengerApp)', () => {
  assert.equal(
    resolveFanoutBookingSource({
      BookingSource: 'Website',
      CreatedBy: 'WEB',
      WebBooking: true,
      PickupPin: '4242',
    }),
    'Website',
  );
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
  // Simulate passenger Card booking that only stamped PaymentType (no PaymentMethod).
  await h.mutateJobStore(jobId, {
    PaymentType: 'Card',
    paymentType: 'Card',
    PaymentMethod: '',
    paymentMethod: '',
    paymentStatus: 'paid',
    isPrePaid: true,
    isFixedPrice: true,
    TarriffId: '-1',
    BookingSource: 'PassengerApp',
  });
  // Also stamp allbookings so pool_restore preserve cannot resurrect a stale Cash default.
  await h.setFirebaseBooking(jobId, {
    PaymentType: 'Card',
    paymentType: 'Card',
    PaymentMethod: '',
    paymentMethod: '',
    paymentStatus: 'paid',
    PaymentStatus: 'paid',
    isPrePaid: true,
    isFixedPrice: true,
    TarriffId: '-1',
    BookingSource: 'PassengerApp',
  });
  await h.assignAccept(jobId, driverId);
  assert.equal((await h.stageJob(jobId, driverId, 'Arrived')).body.ok, true);

  const res = await post(
    '/api/cancel',
    {
      bookingId: jobId,
      companyId: TEST_CID,
      cancelledBy: 'driver',
      driverId: String(driverId),
      wrongPassenger: true,
      reason: 'Wrong passenger / uninvited — returned to pool',
    },
    h.driverHeaders(driverId),
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

  // Pool restore must strip assignment lifecycle + keep Card (not force Cash).
  const ab = await h.firebasePeek(`allbookings/${h.companyId}/${jobId}`);
  assert.ok(ab && typeof ab === 'object', 'allbookings row after wrong-pax recall');
  assert.equal(String(ab.BookingStatus || ab.Status || ''), 'Pending');
  assert.ok(!ab.ArrivedAt && !ab.arrivedAt, 'ArrivedAt cleared on pool_restore');
  assert.ok(!ab.PickupVerifiedAt && !ab.pickupVerifiedAt, 'PickupVerifiedAt cleared on pool_restore');
  assert.ok(!ab.OnBoardAt && !ab.onBoardAt && !ab.ActiveAt, 'OnBoard/Active cleared on pool_restore');
  const pay = String(ab.PaymentType || ab.PaymentMethod || ab.paymentType || '').toLowerCase();
  assert.match(pay, /card/, `payment preserved as Card (got ${pay || 'empty'})`);

  const rs = await h.firebasePeek(`rideStatus/${h.companyId}/${jobId}`);
  assert.equal(String(rs?.RecallStatus || ''), 'Recalled', 'passenger rideStatus RecallStatus written');

  await prepareCleanDispatch(h);
});

test('wrong-passenger recall → re-accept clears RecallStatus and allows re-Arrived', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);
  const driverId = h.driverIds[2];
  await h.ensureDriverReady(driverId);
  const jobId = await h.createAsapJob('wrong-pax-reaccept');
  // Firebase Auth-style uid so Passengerjobs mirror + clear paths engage.
  const paxUid = 'ZtHI905QFqZU4Wj4RcZYY7nnV793';
  await h.mutateJobStore(jobId, {
    PaymentType: 'Card',
    paymentType: 'Card',
    PaymentMethod: '',
    paymentMethod: '',
    paymentStatus: 'paid',
    isPrePaid: true,
    isFixedPrice: true,
    TarriffId: '-1',
    TarriffType: 'Fixed',
    CustomeRate: 9.34,
    BookingSource: 'PassengerApp',
    passengerUid: paxUid,
    PassengerUid: paxUid,
    passengerId: paxUid,
  });
  await h.setFirebaseBooking(jobId, {
    PaymentType: 'Card',
    paymentType: 'Card',
    paymentStatus: 'paid',
    PaymentStatus: 'paid',
    isPrePaid: true,
    isFixedPrice: true,
    TarriffId: '-1',
    TarriffType: 'Fixed',
    CustomeRate: 9.34,
    BookingSource: 'PassengerApp',
    passengerUid: paxUid,
    PassengerUid: paxUid,
    passengerId: paxUid,
  });

  await h.assignAccept(jobId, driverId);
  assert.equal((await h.stageJob(jobId, driverId, 'Arrived')).body.ok, true);

  const recallRes = await h.driverCancel(jobId, driverId, {
    wrongPassenger: true,
    reason: 'Wrong passenger / uninvited — returned to pool',
  });
  assert.equal(recallRes.body.ok, true, JSON.stringify(recallRes.body));
  assert.equal(recallRes.body.recalled, true);

  await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Pending',
    { timeoutMs: 25000 },
  );

  const rsRecalled = await h.firebasePeek(`rideStatus/${h.companyId}/${jobId}`);
  assert.equal(String(rsRecalled?.RecallStatus || ''), 'Recalled');
  assert.match(String(rsRecalled?.message || ''), /another driver|taken by someone|finding/i);

  // Passengerjobs must carry the SAME RecallStatus field the app listens for.
  let pjRecalled = null;
  for (let i = 0; i < 20; i++) {
    pjRecalled = await h.firebasePeek(`Passengerjobs/${paxUid}/${jobId}`);
    if (String(pjRecalled?.RecallStatus || '') === 'Recalled') break;
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.equal(
    String(pjRecalled?.RecallStatus || ''),
    'Recalled',
    'Passengerjobs RecallStatus must match rideStatus (field agreement)',
  );
  assert.ok(
    pjRecalled?.recallNotification && typeof pjRecalled.recallNotification === 'object',
    'recallNotification nested payload present',
  );

  // Same driver re-accepts from the offer pool (corruption path from #8692609048).
  await h.assignAccept(jobId, driverId);

  let rsCleared = null;
  for (let i = 0; i < 30; i++) {
    rsCleared = await h.firebasePeek(`rideStatus/${h.companyId}/${jobId}`);
    const st = String(rsCleared?.Status || rsCleared?.BookingStatus || rsCleared?.status || '');
    const recallGone =
      rsCleared?.RecallStatus == null ||
      rsCleared?.RecallStatus === '' ||
      String(rsCleared?.RecallStatus) === 'null';
    if (/assigned/i.test(st) && recallGone) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.match(
    String(rsCleared?.Status || rsCleared?.BookingStatus || ''),
    /assigned/i,
    'rideStatus Status Assigned after re-accept',
  );
  assert.ok(
    rsCleared?.RecallStatus == null || String(rsCleared?.RecallStatus || '') === '',
    `RecallStatus must clear on re-accept (got ${JSON.stringify(rsCleared?.RecallStatus)})`,
  );
  assert.ok(
    rsCleared?.recalledAt == null || String(rsCleared?.recalledAt || '') === '',
    'recalledAt cleared on re-accept',
  );

  let pjCleared = null;
  for (let i = 0; i < 20; i++) {
    pjCleared = await h.firebasePeek(`Passengerjobs/${paxUid}/${jobId}`);
    const recallGone =
      pjCleared?.RecallStatus == null ||
      pjCleared?.RecallStatus === '' ||
      String(pjCleared?.RecallStatus) === 'null';
    if (recallGone) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(
    pjCleared?.RecallStatus == null || String(pjCleared?.RecallStatus || '') === '',
    `Passengerjobs RecallStatus cleared (got ${JSON.stringify(pjCleared?.RecallStatus)})`,
  );
  assert.ok(
    pjCleared?.recallNotification == null,
    'Passengerjobs recallNotification cleared on re-accept',
  );

  // Re-Arrive must succeed — UI recovery path (second Arrived after wrong-pax).
  const reArrived = await h.stageJob(jobId, driverId, 'Arrived');
  assert.equal(reArrived.body.ok, true, JSON.stringify(reArrived.body));

  const afterArrived = await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Arrived',
    { timeoutMs: 25000 },
  );
  assert.equal(String(afterArrived.jobStore.lifecycle.BookingStatus), 'Arrived');

  const rsFinal = await h.firebasePeek(`rideStatus/${h.companyId}/${jobId}`);
  assert.ok(
    rsFinal?.RecallStatus == null || String(rsFinal?.RecallStatus || '') === '',
    'RecallStatus still clear after re-Arrived',
  );

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
