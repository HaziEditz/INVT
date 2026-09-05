/**
 * Dispatch Console desk bookings must never enter the PIN group
 * (PIN verify / wrong-passenger / no-show timer / walk-up hail),
 * regardless of payment method.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { getHarness, prepareCleanDispatch } from '../lib/harness.mjs';
import { post } from '../lib/http.mjs';
import {
  ensurePickupPin,
  isDispatchCreatedBooking,
  needsPickupVerification,
  noShowDeadlineMs,
} from '../../lib/pickupResolution.cjs';

test('helpers: Dispatch Console Account/Card excluded from PIN group', () => {
  const deskAccount = {
    BookingSource: 'Dispatch Console',
    PaymentType: 'Account',
    isPrePaid: true,
  };
  assert.equal(isDispatchCreatedBooking(deskAccount), true);
  assert.equal(needsPickupVerification(deskAccount), false);
  assert.equal(ensurePickupPin({ ...deskAccount }), '');

  const deskCard = {
    BookingSource: 'Dispatch Console',
    PaymentType: 'Card',
    paymentStatus: 'paid',
    PickupPin: '4242',
  };
  assert.equal(needsPickupVerification(deskCard), false);

  const arrivedMs = Date.now() - 1000;
  const deskArrived = {
    ...deskAccount,
    ArrivedAt: new Date(arrivedMs).toISOString(),
  };
  assert.equal(noShowDeadlineMs(deskArrived), arrivedMs, 'desk: no 5-min no-show timer');

  // Website / PassengerApp unchanged
  assert.equal(
    needsPickupVerification({ BookingSource: 'Website', PaymentType: 'Card', paymentStatus: 'paid' }),
    true,
  );
  assert.equal(
    needsPickupVerification({ BookingSource: 'PassengerApp', CreatedBy: 'APP' }),
    true,
  );
});

test('Dispatch Console Account ASAP: Arrived skips PIN; Active not gated', async () => {
  requireFirebaseSecret();
  const h = await getHarness({ fresh: true });
  await prepareCleanDispatch(h);
  const driverId = h.driverIds[0];
  await h.ensureDriverReady(driverId);
  const jobId = await h.createAsapJob('desk-no-pin');
  // createAsapJob is Dispatch Console by default; stamp Account prepaid shape.
  await h.mutateJobStore(jobId, {
    BookingSource: 'Dispatch Console',
    Source: 'Dispatch Console',
    PaymentType: 'Account',
    paymentType: 'Account',
    PaymentMethod: 'Account',
    isPrePaid: true,
    PickupPin: '',
    pickupPin: '',
  });
  await h.assignAccept(jobId, driverId);

  const arrived = await h.stageJob(jobId, driverId, 'Arrived');
  assert.equal(arrived.body.ok, true, JSON.stringify(arrived.body));
  const pin = String(
    arrived.body.booking?.pickupPin || arrived.body.booking?.PickupPin || '',
  ).trim();
  assert.equal(pin, '', `desk Arrived must not stamp PIN, got "${pin}"`);
  assert.ok(
    !arrived.body.booking?.noShowDeadlineAt,
    'desk Arrived must not stamp noShowDeadlineAt',
  );

  // Wrong-passenger is a PIN-group action — forbidden on desk while still Arrived.
  const wrong = await h.driverCancel(jobId, driverId, {
    reason: 'Wrong passenger / uninvited',
    wrongPassenger: true,
  });
  assert.equal(wrong.body?.ok, false, JSON.stringify(wrong.body));
  assert.equal(wrong.body?.error_code, 'forbidden');

  const onboard = await h.stageJob(jobId, driverId, 'Active');
  assert.equal(
    onboard.body.ok,
    true,
    `desk Active must not require PIN verify: ${JSON.stringify(onboard.body)}`,
  );

  await prepareCleanDispatch(h);
});
