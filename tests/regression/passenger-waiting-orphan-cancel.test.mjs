/**
 * Passenger-app Waiting ghost cancel:
 * - allbookings already Cancelled (often only lowercase `status`)
 * - pendingjobs still Waiting with PickupAddress schema (never entered jobStore)
 * CancelUnAssigned must still clear pendingjobs (orphan Firebase cleanup).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { getHarness, prepareCleanDispatch } from '../lib/harness.mjs';
import { post } from '../lib/http.mjs';

const BID = 86081999901;

test.before(async () => {
  await getHarness({ fresh: true });
});

test.afterEach(async () => {
  const h = await getHarness();
  await prepareCleanDispatch(h);
});

test('orphan Waiting pendingjobs cancels when not in jobStore (passenger PickupAddress schema)', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);
  const cid = h.companyId;
  const createdAt = Date.now() - 40 * 60_000;

  // Mirror live bug shape for #8607057799718
  const passengerShape = {
    CompanyId: cid,
    companyId: cid,
    CreatedAt: createdAt,
    createdAt,
    DropoffAddress: '110 Bowmont Street',
    DropoffLat: -46.4135,
    DropoffLng: 168.3478,
    EstimatedFare: 16,
    Id: String(BID),
    jobId: String(BID),
    PassengerName: 'Audit ASAP Pax Ghost',
    Name: 'Audit ASAP Pax Ghost',
    PaymentMethod: 'cash',
    PhoneNo: '0210008603',
    PickupAddress: '177H Tweed Street',
    PickupLat: -46.4183,
    PickupLng: 168.3615,
    Source: 'PassengerApp',
    Status: 'Waiting',
    status: 'Waiting',
    VehicleType: 'Sedan',
    WebBooking: false,
    BookingSource: 'PassengerApp',
  };

  // pendingjobs Waiting ghost
  const pendWrite = await post(
    '/dev/loadtest/set-firebase-booking',
    {
      bookingId: BID,
      companyId: cid,
      alsoPending: true,
      preserveTimestamps: true,
      patch: passengerShape,
    },
    h.adminHeaders,
  );
  assert.equal(pendWrite.body?.ok, true, JSON.stringify(pendWrite.body));

  // allbookings half-cancelled (Watchdog-Pax lowercase-only) — do not overwrite pendingjobs
  const abWrite = await post(
    '/dev/loadtest/set-firebase-booking',
    {
      bookingId: BID,
      companyId: cid,
      alsoPending: false,
      preserveTimestamps: true,
      patch: {
        ...passengerShape,
        Status: 'Waiting',
        status: 'Cancelled',
        cancelReason: 'No driver available — auto-cancelled after 33 min',
        cancelledAt: new Date().toISOString(),
      },
    },
    h.adminHeaders,
  );
  assert.equal(abWrite.body?.ok, true, JSON.stringify(abWrite.body));

  const pjBefore = await h.firebasePeek(`pendingjobs/${cid}/${BID}`);
  assert.ok(pjBefore, 'pendingjobs ghost must exist before cancel');
  assert.equal(String(pjBefore.Status || pjBefore.status), 'Waiting');

  const cancel = await h.cancelUnassigned(BID);
  assert.equal(
    cancel.body?.d,
    'Operation Successfully Performed',
    `cancel response: ${JSON.stringify(cancel.body)}`,
  );

  let pjAfter = 'present';
  for (let i = 0; i < 25; i++) {
    try {
      pjAfter = await h.firebasePeek(`pendingjobs/${cid}/${BID}`);
    } catch {
      pjAfter = null;
    }
    if (pjAfter == null) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  assert.equal(pjAfter, null, `pendingjobs ghost still present: ${JSON.stringify(pjAfter)}`);

  const ab = await h.firebasePeek(`allbookings/${cid}/${BID}`);
  const abSt = String(ab?.BookingStatus || ab?.Status || ab?.status || '');
  assert.match(abSt, /cancel/i, `allbookings should be Cancelled, got ${abSt}`);
});
