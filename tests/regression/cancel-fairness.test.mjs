/**
 * Cancellation fairness engine — pure unit coverage (no Firebase).
 * Pins Card 50/100, Account binary, TM council-never, GPS-missing ≠ free,
 * cash abuse window, and self-serve lock after Arrived.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const F = require('../../lib/cancelFairness.cjs');

function card(partial) {
  return F.computeCancelFairness({
    paymentMethod: 'card',
    fare: 40,
    ...partial,
  });
}

test('card: not assigned → full wallet credit, no card refund language', () => {
  const r = card({ status: 'Pending' });
  assert.equal(r.outcome, 'refund');
  assert.equal(r.chargeAmount, 0);
  assert.equal(r.creditAmount, 40);
  assert.equal(r.canSelfServe, true);
  assert.match(r.passengerMessage, /wallet/i);
  assert.match(r.passengerMessage, /not refunded to your card/i);
});

test('card: assigned + early (<60%) → 50% charge + 50% wallet', () => {
  const r = card({ status: 'Assigned', progressPct: 0.2, gpsUnknown: false });
  assert.equal(r.chargeFraction, 0.5);
  assert.equal(r.chargeAmount, 20);
  assert.equal(r.creditAmount, 20);
  assert.equal(r.outcome, 'partial_charge');
  assert.equal(r.canSelfServe, true);
});

test('card: assigned + 60%+ → 100% charge', () => {
  const r = card({ status: 'Assigned', progressPct: 0.6, gpsUnknown: false });
  assert.equal(r.chargeFraction, 1);
  assert.equal(r.chargeAmount, 40);
  assert.equal(r.creditAmount, 0);
  assert.equal(r.outcome, 'charge');
});

test('card: assigned + missing GPS is NOT 0% / free — uses 50% assigned-early', () => {
  const r = card({ status: 'Assigned', progressPct: 0, gpsUnknown: true });
  assert.equal(r.gpsUnknown, true);
  assert.notEqual(r.chargeAmount, 0);
  assert.equal(r.chargeFraction, 0.5);
  assert.equal(r.creditAmount, 20);
  assert.match(r.passengerMessage, /not a free cancel/i);
});

test('card: arrived / no-show → 100%, self-serve locked', () => {
  const arrived = card({ status: 'Arrived', forSelfServePreview: true });
  assert.equal(arrived.canSelfServe, false);
  assert.equal(arrived.chargeFraction, 1);
  const ns = card({ status: 'Assigned', isNoShow: true });
  assert.equal(ns.stage, 'no_show');
  assert.equal(ns.chargeAmount, 40);
  assert.equal(ns.canSelfServe, false);
});

test('account/ACC: not assigned = no charge; any assigned+ = full bill', () => {
  const pending = F.computeCancelFairness({ status: 'Pending', paymentMethod: 'account', fare: 55 });
  assert.equal(pending.chargeAmount, 0);
  assert.equal(pending.chargeTarget, 'none');
  const assigned = F.computeCancelFairness({ status: 'Assigned', paymentMethod: 'account', fare: 55, gpsUnknown: true });
  assert.equal(assigned.chargeAmount, 55);
  assert.equal(assigned.chargeTarget, 'account_bill');
  assert.equal(assigned.creditAmount, 0);
  const acc = F.computeCancelFairness({ status: 'Picking', paymentMethod: 'acc', fare: 30, gpsUnknown: true });
  assert.equal(acc.chargeAmount, 30);
  assert.equal(acc.chargeTarget, 'acc_bill');
});

test('TM: council never charged; remainder follows card / account / cash', () => {
  const cardTm = F.computeCancelFairness({
    status: 'Pending', paymentMethod: 'card', isTM: true, fare: 20, tmPassengerAmount: 10, remainderPayment: 'card',
  });
  assert.equal(cardTm.councilCharged, false);
  assert.equal(cardTm.creditAmount, 10);
  assert.match(cardTm.passengerMessage, /council/i);

  const late = F.computeCancelFairness({
    status: 'Assigned', paymentMethod: 'card', isTM: true, tmPassengerAmount: 10, remainderPayment: 'card',
    progressPct: 0.7, gpsUnknown: false,
  });
  assert.equal(late.chargeAmount, 10);
  assert.equal(late.councilCharged, false);

  const accTm = F.computeCancelFairness({
    status: 'Assigned', isTM: true, tmPassengerAmount: 12, remainderPayment: 'account', gpsUnknown: true,
  });
  assert.equal(accTm.chargeAmount, 12);
  assert.equal(accTm.chargeTarget, 'account_bill');

  const cashTm = F.computeCancelFairness({
    status: 'Assigned', isTM: true, tmPassengerAmount: 12, remainderPayment: 'cash', gpsUnknown: false, progressPct: 0.9,
  });
  assert.equal(cashTm.chargeAmount, 0);
  assert.equal(cashTm.outcome, 'free');
});

test('Offered is not-assigned (driver has not accepted) — full card wallet credit', () => {
  const r = card({ status: 'Offered', hasDriver: true });
  assert.equal(r.stage, 'not_assigned');
  assert.equal(r.creditAmount, 40);
});

test('self-serve allowed until Arrived; on-trip locked', () => {
  assert.equal(F.selfServeAllowedStatus('Assigned'), true);
  assert.equal(F.selfServeAllowedStatus('Picking'), true);
  assert.equal(F.selfServeAllowedStatus('Arrived'), false);
  assert.equal(F.selfServeAllowedStatus('Active'), false);
  assert.equal(F.selfServeAllowedStatus('OnTrip'), false);
});

test('missing GPS computeDriverProgress → gpsUnknown, never 0% progress as known', () => {
  const missing = F.computeDriverProgress({ pickup: { lat: -46.4, lng: 168.3 }, driver: null, startDistanceKm: 5 });
  assert.equal(missing.gpsUnknown, true);
  assert.equal(missing.progressPct, null);
  const ok = F.computeDriverProgress({
    pickup: { lat: -46.4, lng: 168.3 },
    driver: { lat: -46.4, lng: 168.3 },
    startDistanceKm: 5,
  });
  assert.equal(ok.gpsUnknown, false);
  assert.ok(ok.progressPct >= 0.99);
});

test('cash abuse: 3 in 30 days warns; 4th forces card-only', () => {
  const t0 = Date.now();
  let state = {};
  state = F.recordCashCancelState(state, t0);
  state = F.recordCashCancelState(state, t0 + 1000);
  assert.equal(state.warning, false);
  state = F.recordCashCancelState(state, t0 + 2000);
  assert.equal(state.count, 3);
  assert.equal(state.warning, true);
  assert.equal(state.justWarned, true);
  assert.equal(state.cardOnly, false);
  state = F.recordCashCancelState(state, t0 + 3000);
  assert.equal(state.cardOnly, true);
  assert.equal(state.justCardOnly, true);
});

test('dispatcher and self-serve share the same charge numbers', () => {
  const self = card({ status: 'Assigned', progressPct: 0.1, gpsUnknown: false });
  const disp = card({ status: 'Assigned', progressPct: 0.1, gpsUnknown: false, dispatcherTriggered: true });
  assert.equal(self.chargeAmount, disp.chargeAmount);
  assert.equal(self.creditAmount, disp.creditAmount);
  assert.match(disp.passengerMessage, /Dispatch cancelled/i);
  assert.doesNotMatch(self.passengerMessage, /Dispatch cancelled/i);
});

test('passenger messages never mention a 3-minute grace', () => {
  const r = card({ status: 'Assigned', progressPct: 0.1, gpsUnknown: false });
  assert.doesNotMatch(r.passengerMessage, /3.?minute/i);
  assert.doesNotMatch(r.confirmMessage, /3.?minute/i);
  assert.doesNotMatch(F.bookingTimeCancelRules('card', false), /3.?minute/i);
});

test('wallet and gift_card follow card tiers', () => {
  const w = F.computeCancelFairness({ status: 'Assigned', paymentMethod: 'wallet', fare: 10, progressPct: 0.1, gpsUnknown: false });
  assert.equal(w.chargeAmount, 5);
  const g = F.computeCancelFairness({ status: 'Pending', paymentMethod: 'gift_card', fare: 10 });
  assert.equal(g.creditAmount, 10);
});
