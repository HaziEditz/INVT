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

/**
 * Resolve BookingSource for Firebase fanout / mirrors.
 * Never invent "dispatch" / "Dispatch Console" when passenger-app origin is known
 * (PassengerApp, passenger, CreatedBy=APP, or a pickup PIN is present).
 *
 * @param {object|null} job
 * @param {{ bookingSource?: string, fallback?: string, deskFallback?: string }} [opts]
 * @returns {string}
 */
function resolveFanoutBookingSource(job, opts) {
  opts = opts || {};
  const deskFallback =
    opts.deskFallback != null && String(opts.deskFallback).trim() !== ''
      ? String(opts.deskFallback).trim()
      : 'Dispatch Console';
  const candidates = [
    opts.bookingSource,
    job && job.BookingSource,
    job && job.bookingSource,
    job && job.Source,
    job && job.source,
    job && job.CreatedBy,
    job && job.createdBy,
  ];
  for (const c of candidates) {
    const t = String(c ?? '').trim();
    if (!t) continue;
    if (t.includes('/api/') || /dispatch_complete/i.test(t) || /completebooking/i.test(t)) {
      continue;
    }
    if (/^APP$/i.test(t)) return 'PassengerApp';
    if (/^WEB$/i.test(t)) return 'Website';
    // Canonicalize lowercase ingest tag without losing APP badge mapping
    if (t.toLowerCase() === 'passenger') return 'PassengerApp';
    return t;
  }
  // PIN alone must not rewrite Website/WEB bookings to PassengerApp (prepaid
  // Website jobs now also carry a PickupPin for Arrived verify).
  const _created = String((job && (job.CreatedBy || job.createdBy)) || '').trim();
  const _isWeb =
    !!(job && (job.WebBooking || job.webBooking)) ||
    /^WEB$/i.test(_created) ||
    /^website$/i.test(String((job && (job.BookingSource || job.bookingSource)) || ''));
  if (job && isPassengerAppBooking(job)) {
    return 'PassengerApp';
  }
  if (job && jobPickupPin(job) && !_isWeb) {
    return 'PassengerApp';
  }
  if (opts.fallback != null && String(opts.fallback).trim() !== '') {
    return String(opts.fallback).trim();
  }
  return deskFallback;
}

/**
 * Prepaid upfront (Card / Account / ACC / TM / already-paid) — any booking source.
 * Cash / hail are not prepaid; those skip PIN + Arrived verify group.
 */
function isPrepaidUpfrontJob(job) {
  if (!job || typeof job !== 'object') return false;
  if (
    job.isPrePaid ||
    job.isPrepaid ||
    job.IsPrePaid ||
    job.prepaid ||
    job.isAcc ||
    job.IsAcc ||
    job.isACC ||
    job.isTotalMobility ||
    job.isTM ||
    job.IsTM ||
    job.tmUsed
  ) {
    return true;
  }
  if (String(job.paymentStatus || job.PaymentStatus || '').toLowerCase() === 'paid') {
    return true;
  }
  const pay = String(
    job.PaymentType || job.paymentType || job.PaymentMethod || job.paymentMethod || '',
  )
    .trim()
    .toLowerCase();
  return /card|stripe|account|\bacc\b|tm/.test(pay);
}

/**
 * Stamp a 4-digit PickupPin when verification is required and none exists yet.
 * Mutates job in place. Safe no-op when pin already present or verify not needed.
 */
function ensurePickupPin(job) {
  if (!job || typeof job !== 'object') return '';
  const existing = jobPickupPin(job);
  if (existing) return existing;
  if (!needsPickupVerification(job)) return '';
  const pin = generatePickupPin();
  job.PickupPin = pin;
  job.pickupPin = pin;
  return pin;
}

/**
 * PassengerApp OR any prepaid (Card/Account/ACC/TM/paid) from any source
 * (Website / Dispatch / Passenger App) must verify before On Board.
 * Cash and hail do not.
 */
function needsPickupVerification(job) {
  if (!job || typeof job !== 'object') return false;
  if (String(job.BookingSource || '').toLowerCase() === 'hail') return false;
  if (job.source === 'hail') return false;
  const pin = jobPickupPin(job);
  if (pin) return true;
  if (isPassengerAppBooking(job)) return true;
  return isPrepaidUpfrontJob(job);
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
  isPrepaidUpfrontJob,
  jobPickupPin,
  ensurePickupPin,
  resolveFanoutBookingSource,
  needsPickupVerification,
  isPickupVerified,
  noShowDeadlineMs,
  canMarkNoShow,
  computeNoShowWaitCharge,
};
