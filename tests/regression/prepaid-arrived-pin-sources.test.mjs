/**
 * Prepaid Arrived must stamp a real 4-digit PIN for Website AND PassengerApp.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { getHarness, prepareCleanDispatch } from '../lib/harness.mjs';
import { post } from '../lib/http.mjs';
import {
  ensurePickupPin,
  needsPickupVerification,
  resolveFanoutBookingSource,
} from '../../lib/pickupResolution.cjs';

test('helpers: Website prepaid needs PIN; Website+PIN stays Website', () => {
  assert.equal(
    needsPickupVerification({ BookingSource: 'Website', paymentStatus: 'paid' }),
    true,
  );
  assert.equal(
    needsPickupVerification({ BookingSource: 'Website', PaymentType: 'Cash' }),
    false,
  );
  const j = { BookingSource: 'Website', paymentStatus: 'paid' };
  const pin = ensurePickupPin(j);
  assert.match(pin, /^\d{4}$/);
  assert.equal(
    resolveFanoutBookingSource({
      BookingSource: 'Website',
      CreatedBy: 'WEB',
      WebBooking: true,
      PickupPin: pin,
    }),
    'Website',
  );
});

async function provePrepaidArrivedPin(label, mutate) {
  requireFirebaseSecret();
  const h = await getHarness({ fresh: true });
  await prepareCleanDispatch(h);
  const driverId = h.driverIds[0];
  await h.ensureDriverReady(driverId);
  const jobId = await h.createAsapJob(`prepaid-pin-${label}`);
  await h.mutateJobStore(jobId, { ...mutate, PickupPin: '', pickupPin: '' });
  await h.assignAccept(jobId, driverId);

  const arrived = await h.stageJob(jobId, driverId, 'Arrived');
  assert.equal(arrived.body.ok, true, JSON.stringify(arrived.body));
  const pin = String(
    arrived.body.booking?.pickupPin || arrived.body.booking?.PickupPin || '',
  ).trim();
  assert.match(pin, /^\d{4}$/, `${label} Arrived must return real PIN, got "${pin}"`);

  const blocked = await h.stageJob(jobId, driverId, 'Active');
  assert.equal(blocked.body.ok, false);
  assert.equal(blocked.body.error_code, 'pickup_unverified');

  const verify = await post(
    '/api/job/verify-pickup',
    { bookingId: jobId, driverId, nameConfirmed: true, pinConfirmed: true },
    h.adminHeaders,
  );
  assert.equal(verify.body.ok, true, JSON.stringify(verify.body));

  const onboard = await h.stageJob(jobId, driverId, 'Active');
  assert.equal(onboard.body.ok, true, JSON.stringify(onboard.body));
  await prepareCleanDispatch(h);
  return { label, jobId, pin };
}

test('Website prepaid Card ASAP: Arrived stamps PIN; Active gated until verify', async () => {
  const r = await provePrepaidArrivedPin('website', {
    BookingSource: 'Website',
    CreatedBy: 'WEB',
    WebBooking: true,
    paymentStatus: 'paid',
    PaymentType: 'Card',
    paymentType: 'Card',
    PaymentMethod: 'card',
    isPrePaid: true,
  });
  console.log('[evidence] Website prepaid Arrived PIN', r);
});

test('PassengerApp prepaid Card ASAP: Arrived stamps PIN; Active gated until verify', async () => {
  const r = await provePrepaidArrivedPin('pax', {
    BookingSource: 'PassengerApp',
    CreatedBy: 'APP',
    paymentStatus: 'paid',
    PaymentType: 'Card',
    paymentType: 'Card',
    PaymentMethod: 'card',
    isPrePaid: true,
  });
  console.log('[evidence] PassengerApp prepaid Arrived PIN', r);
});
