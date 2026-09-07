/**
 * Exclusive-offer fanout must stamp CreatedAt / CreatedBy / VehicleType onto
 * notification + pendingjobs so driver Offer/Current/Queue meta strip can render.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const src = readFileSync(join(root, 'server.js'), 'utf8');

const writeOfferFn = src.slice(
  src.indexOf('async function _writeManualDriverOffer'),
  src.indexOf('async function assignBooking'),
);

test('_writeManualDriverOffer notification includes CreatedAt + CreatedBy', () => {
  assert.match(writeOfferFn, /_createdMsOffer/);
  assert.match(writeOfferFn, /_createdByOffer/);
  assert.match(writeOfferFn, /CreatedBy:\s*_createdByOffer/);
  assert.match(writeOfferFn, /createdAt:\s*_createdMsOffer/);
  assert.match(writeOfferFn, /CreatedAt:\s*_createdMsOffer/);
});

test('_writeManualDriverOffer pendingjobs patch includes VehicleType + CreatedAt', () => {
  assert.match(writeOfferFn, /_vtOffer/);
  assert.match(writeOfferFn, /VehicleType:\s*_vtOffer/);
  assert.match(writeOfferFn, /vehicleType:\s*_vtOffer/);
  assert.match(
    writeOfferFn,
    /Driver Offer\/Current\/Queue meta strip — must survive exclusive-offer patch/,
  );
  assert.match(writeOfferFn, /firebaseDbPatch\(`pendingjobs\/\$\{cid\}\/\$\{bookingId\}`/);
});

test('_writeManualDriverOffer writes allbookings Offered before notification (#9063)', () => {
  const pendingIdx = writeOfferFn.indexOf('firebaseDbPatch(`pendingjobs/${cid}/${bookingId}`');
  const allbookingsIdx = writeOfferFn.indexOf('_writeAllbookingsLiveAwait(cid, bookingId, _pjPatch');
  const notifIdx = writeOfferFn.indexOf('firebaseDbSet(`notification/${did}`');
  assert.ok(pendingIdx >= 0, 'pendingjobs patch missing');
  assert.ok(allbookingsIdx >= 0, 'allbookings write missing');
  assert.ok(notifIdx >= 0, 'notification write missing');
  assert.ok(
    pendingIdx < notifIdx && allbookingsIdx < notifIdx,
    'notification must not precede pendingjobs/allbookings Offered (first re-offer blink)',
  );
  assert.match(writeOfferFn, /returnReason:\s*''/);
});
