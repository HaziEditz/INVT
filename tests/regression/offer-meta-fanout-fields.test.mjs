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
