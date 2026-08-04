/**
 * Account payment Create Job — search dedupe + payment fanout defaults.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { dedupeBusinessAccountHits } = require('../../lib/accountSearchDedupe.cjs');

test('dedupeBusinessAccountHits collapses same display name to one row', () => {
  const hits = [
    { Id: 'c', Name: 'Invercargill taxis', AccountCode: '' },
    { Id: 'a', Name: 'Invercargill Taxis', AccountCode: 'INV1' },
    { Id: 'b', Name: 'Invercargill taxis', PhoneNo: '03' },
  ];
  const out = dedupeBusinessAccountHits(hits);
  assert.equal(out.length, 1);
  assert.equal(String(out[0].Id), 'a', 'prefer row with AccountCode');
  assert.match(String(out[0].Name), /Invercargill/i);
});

test('dedupeBusinessAccountHits keeps distinct names', () => {
  const out = dedupeBusinessAccountHits([
    { Id: '1', Name: 'Alpha Co' },
    { Id: '2', Name: 'Beta Co' },
  ]);
  assert.equal(out.length, 2);
});

/** Mirrors createJobForm paymentLabelFromType + insert payment params. */
function paymentLabelFromType(paymentType) {
  if (paymentType === 'cash') return 'Cash';
  if (paymentType === 'card') return 'Card';
  if (paymentType === 'eftpos') return 'EFTPOS';
  if (paymentType === 'account') return 'Account';
  if (paymentType === 'tm') return 'TM';
  if (paymentType === 'acc') return 'ACC';
  return '';
}

function buildInsertPaymentParams(form) {
  const paymentMethod = paymentLabelFromType(form.paymentType);
  return {
    Account_id: form.accountId || '',
    Bookingtype:
      form.paymentType === 'account' || form.accountId ? 'Account Ride' : 'Normal Ride',
    PaymentMethod: paymentMethod,
    PaymentType: paymentMethod,
  };
}

/** Mirrors server _offerPaymentTypeFromJob after create fix. */
function offerPaymentTypeFromJob(job) {
  let pm = String(job.PaymentMethod || job.paymentMethod || job.PaymentType || job.paymentType || '').toLowerCase();
  if (!pm) {
    const accountId = String(job.Account_id || job.AccountId || '').trim();
    const bookingType = String(job.Bookingtype || job.BookingType || job.bookingType || '').toLowerCase();
    if (accountId || bookingType.includes('account')) pm = 'account';
  }
  if (pm.includes('card') || pm.includes('stripe')) return 'card';
  if (pm.includes('account')) return 'account';
  if (pm.includes('eftpos')) return 'eftpos';
  if (pm.includes('tm')) return 'tm';
  if (pm.includes('acc')) return 'acc';
  if (pm.includes('cash')) return 'cash';
  return pm || 'cash';
}

test('create insert params include PaymentMethod Account (aligned with edit)', () => {
  const params = buildInsertPaymentParams({
    paymentType: 'account',
    accountId: '-Os7EhxblNgbMg2B0D6G',
    accountName: 'Invercargill taxis',
  });
  assert.equal(params.PaymentMethod, 'Account');
  assert.equal(params.PaymentType, 'Account');
  assert.equal(params.Bookingtype, 'Account Ride');
  assert.equal(params.Account_id, '-Os7EhxblNgbMg2B0D6G');
});

test('offer fanout uses Account when PaymentMethod set on create', () => {
  assert.equal(
    offerPaymentTypeFromJob({
      PaymentMethod: 'Account',
      PaymentType: 'Account',
      Account_id: 'x',
    }),
    'account',
  );
});

test('offer fanout infers Account from Account_id when PaymentMethod missing (legacy jobs)', () => {
  assert.equal(
    offerPaymentTypeFromJob({
      Account_id: '-Os7EhxblNgbMg2B0D6G',
      Bookingtype: 'Account Ride',
    }),
    'account',
  );
  assert.equal(offerPaymentTypeFromJob({}), 'cash');
});
