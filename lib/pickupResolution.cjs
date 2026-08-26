/**
 * Pickup-resolution helpers (PassengerApp PIN + name verify, no-show wait/charge).
 * Pure functions — safe to unit/regression-test without the full server.
 */

'use strict';

const NOSHOW_BASE_WAIT_MS = 5 * 60 * 1000;
const NOSHOW_EXTENSION_MS = 5 * 60 * 1000;

function generatePickupPin() {
  // 4 digits, avoid 0000
  const n = Math.floor(Math.random() * 9000) + 1000;
  return String(n);
}

function isPassengerAppBooking(job) {
  if (!job || typeof job !== 'object') return false;
  const src = String(
    job.BookingSource || job.bookingSource || job.Source || job.source || '',
  ).trim().toLowerCase();
  if (src === 'passengerapp' || src === 'passenger app' || src === 'passenger') return true;
  const created = String(job.CreatedBy || job.createdBy || '').trim().toUpperCase();
  return created === 'APP';
}

function jobPickupPin(job) {
  if (!job || typeof job !== 'object') return '';
  return String(job.PickupPin || job.pickupPin || '').trim();
}

/** PassengerApp jobs with a PIN (or expected to have one) must verify before On Board. */
function needsPickupVerification(job) {
  if (!job || typeof job !== 'object') return false;
  if (String(job.BookingSource || '').toLowerCase() === 'hail') return false;
  if (job.source === 'hail') return false;
  const pin = jobPickupPin(job);
  if (pin) return true;
  return isPassengerAppBooking(job);
}

function isPickupVerified(job) {
  return !!(job && (job.pickupVerifiedAt || job.PickupVerifiedAt));
}

/**
 * Absolute deadline (ms) after which No Show is allowed.
 * Base 5 minutes from ArrivedAt; one "I'm coming" adds another 5 minutes.
 */
function noShowDeadlineMs(job, nowMs) {
  const arrivedMs =
    Date.parse(String(job && (job.ArrivedAt || job.arrivedAt) || '')) || 0;
  if (!arrivedMs) return Infinity;
  let deadline = arrivedMs + NOSHOW_BASE_WAIT_MS;
  if (job.imComingAt || job.ImComingAt || job.noShowWaitExtended || job.NoShowWaitExtended) {
    deadline += NOSHOW_EXTENSION_MS;
  }
  // Test harness: BW_NOSHOW_MIN_WAIT_MS=0 disables the wall-clock gate.
  const override = process.env.BW_NOSHOW_MIN_WAIT_MS;
  if (override != null && String(override).trim() !== '') {
    const n = Number(override);
    if (Number.isFinite(n) && n <= 0) return arrivedMs;
    if (Number.isFinite(n) && n > 0) {
      let d = arrivedMs + n;
      if (job.imComingAt || job.ImComingAt || job.noShowWaitExtended || job.NoShowWaitExtended) {
        d += n;
      }
      return d;
    }
  }
  void nowMs;
  return deadline;
}

function canMarkNoShow(job, nowMs) {
  const now = nowMs != null ? nowMs : Date.now();
  const stage = String((job && (job.BookingStatus || job.Status)) || '');
  if (stage !== 'Arrived') {
    return { ok: false, error_code: 'forbidden', error: 'No Show is only allowed after marking Arrived at pickup' };
  }
  const deadline = noShowDeadlineMs(job, now);
  if (now < deadline) {
    const secs = Math.max(1, Math.ceil((deadline - now) / 1000));
    return {
      ok: false,
      error_code: 'too_early',
      error: `Wait ${secs}s more before marking No Show`,
      remainingMs: deadline - now,
      deadlineAt: new Date(deadline).toISOString(),
    };
  }
  return { ok: true, deadlineAt: new Date(deadline).toISOString() };
}

/**
 * Waiting-rate charge for curb wait (Arrived → No Show), including I'm-coming extension.
 * @param {number} waitingPerMin — tariff WaitingRate
 */
function computeNoShowWaitCharge(job, waitingPerMin, nowMs) {
  const now = nowMs != null ? nowMs : Date.now();
  const arrivedMs =
    Date.parse(String(job && (job.ArrivedAt || job.arrivedAt) || '')) || 0;
  const waitMs = arrivedMs > 0 ? Math.max(0, now - arrivedMs) : 0;
  const waitMinutes = Math.max(1, Math.ceil(waitMs / 60000));
  const rate = Number(waitingPerMin);
  const perMin = Number.isFinite(rate) && rate >= 0 ? rate : 0;
  const charge = Math.round(waitMinutes * perMin * 100) / 100;
  const reason = `No Show, waited ${waitMinutes} minute${waitMinutes === 1 ? '' : 's'}`;
  return {
    waitMinutes,
    waitMs,
    waitingPerMin: perMin,
    waitingCharge: charge,
    reason,
    extended: !!(job && (job.imComingAt || job.ImComingAt || job.noShowWaitExtended)),
  };
}

module.exports = {
  NOSHOW_BASE_WAIT_MS,
  NOSHOW_EXTENSION_MS,
  generatePickupPin,
  isPassengerAppBooking,
  jobPickupPin,
  needsPickupVerification,
  isPickupVerified,
  noShowDeadlineMs,
  canMarkNoShow,
  computeNoShowWaitCharge,
};
