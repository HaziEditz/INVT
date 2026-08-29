/**
 * Live harness: passenger-edit → updateBooking → DropAddress + editHistory.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { post } from '../lib/http.mjs';
import { getHarness, prepareCleanDispatch } from '../lib/harness.mjs';

test('passenger-edit: DropoffAddress aliases → DropAddress + editHistory + fare', async () => {
  requireFirebaseSecret();
  const h = await getHarness({ fresh: true });
  await prepareCleanDispatch(h);
  const jobId = await h.createAsapJob('pax-edit');

  const before = await h.jobTrace(jobId);
  const dropBefore = String(before.jobStore?.lifecycle?.DropAddress || before.firebase?.allbookings?.DropAddress || '');

  const r = await post('/api/job/passenger-edit', {
    bookingId: jobId,
    companyId: h.companyId,
    changes: {
      DropoffAddress: '99 Test Drop Rd, Invercargill',
      dropoffLat: -46.413,
      dropoffLng: 168.353,
      estimatedFare: 19.75,
    },
    actorName: 'passenger_app',
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.ok(Array.isArray(r.body.eventTypes) && r.body.eventTypes.length > 0, 'eventTypes expected');

  const after = await h.poll(
    jobId,
    (t) => {
      const drop = String(t.jobStore?.lifecycle?.DropAddress || t.firebase?.allbookings?.DropAddress || '');
      const hist = t.jobStore?.lifecycle?.editHistory || t.firebase?.allbookings?.editHistory || [];
      return drop.includes('99 Test Drop') && Array.isArray(hist) && hist.length > 0;
    },
    { timeoutMs: 25000 },
  );

  const dropAfter = String(after.jobStore?.lifecycle?.DropAddress || after.firebase?.allbookings?.DropAddress || '');
  assert.match(dropAfter, /99 Test Drop/);
  assert.notEqual(dropAfter, dropBefore);
  const fare = String(
    after.jobStore?.lifecycle?.EstimatedFare ??
      after.firebase?.allbookings?.EstimatedFare ??
      '',
  );
  assert.ok(fare.includes('19.75') || fare === '19.75', `fare=${fare}`);
  const hist = after.jobStore?.lifecycle?.editHistory || after.firebase?.allbookings?.editHistory || [];
  assert.ok(Array.isArray(hist) && hist.length > 0, 'editHistory required');
  const last = hist[hist.length - 1];
  assert.equal(String(last.by || '').toLowerCase(), 'passenger');

  await h.cancelUnassigned(jobId);
});

test('passenger-edit: blocked after Arrived', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);
  const jobId = await h.createAsapJob('pax-edit-arrived');
  const drv = h.driverIds[0];
  await h.ensureDriverReady(drv);
  await h.assignAccept(jobId, drv);
  assert.equal((await h.stageJob(jobId, drv, 'Arrived')).body.ok, true);

  const r = await post('/api/job/passenger-edit', {
    bookingId: jobId,
    companyId: h.companyId,
    changes: { DropAddress: 'Should Not Apply' },
  });
  assert.equal(r.status, 409, JSON.stringify(r.body));
  assert.equal(r.body.error_code, 'invalid_transition');

  await h.cancel(jobId, 'dispatcher', { forceTerminal: true });
});
