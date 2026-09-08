'use strict';

/**
 * BookaWaka cancellation fairness — single source of truth.
 * Used by Dispatch cancelBooking for real money outcomes.
 * Website + Passenger App copies must stay in sync (see cancelFairness.ts).
 *
 * 3-minute grace: NOT implemented. Distance tiers below are the live rule.
 * Missing GPS after assignment is NEVER treated as 0% / free.
 */

const FULL_PROGRESS_THRESHOLD = 0.6;
const SUPPORT_EMAIL = 'info@bookawaka.com';
const CASH_CANCEL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const CASH_CANCEL_WARN_AT = 3;

const NOT_ASSIGNED = new Set([
  'pending', 'waiting', 'scheduled', 'no one', 'noone',
  'offered', 'offer', 'offering', 'pendingpayment', 'paymentpending',
  'unreached', 'reject', 'searching',
]);
const ASSIGNED = new Set([
  'assigned', 'accepted', 'picking', 'enroute', 'en route', 'on_the_way', 'ontheway',
  'queued', 'confirmed',
]);
const ARRIVED = new Set(['arrived']);
const ON_TRIP = new Set(['active', 'ontrip', 'on trip', 'onboard', 'started', 'in_progress']);
const NO_SHOW = new Set(['no show', 'noshow', 'no_show']);

function parseMoney(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, v);
  const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function formatMoney(n) {
  return `$${roundMoney(n).toFixed(2)}`;
}

function haversineKm(a, b) {
  if (!a || !b) return null;
  const lat1 = Number(a.lat);
  const lng1 = Number(a.lng);
  const lat2 = Number(b.lat);
  const lng2 = Number(b.lng);
  if (![lat1, lng1, lat2, lng2].every((n) => Number.isFinite(n))) return null;
  if (Math.abs(lat1) < 0.0001 && Math.abs(lng1) < 0.0001) return null;
  if (Math.abs(lat2) < 0.0001 && Math.abs(lng2) < 0.0001) return null;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

function normalizeStatus(raw) {
  let s = String(raw || '').trim().toLowerCase();
  s = s.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (s === 'noone') return 'no one';
  if (s === 'on trip') return 'ontrip';
  if (s === 'en route') return 'enroute';
  if (s === 'payment pending') return 'pendingpayment';
  return s;
}

function classifyStage(status, opts) {
  const s = normalizeStatus(status);
  if (opts && opts.isNoShow) return 'no_show';
  if (NO_SHOW.has(s)) return 'no_show';
  if (ARRIVED.has(s)) return 'arrived';
  if (ON_TRIP.has(s)) return 'on_trip';
  if (ASSIGNED.has(s)) return 'assigned';
  if (NOT_ASSIGNED.has(s) || !s) {
    if (!s && opts && opts.hasDriver) return 'assigned';
    return 'not_assigned';
  }
  // Unknown live status with a driver attached is treated as assigned, not free.
  if (opts && opts.hasDriver) return 'assigned';
  return 'assigned';
}

function isSelfServeLocked(stage) {
  return stage === 'arrived' || stage === 'on_trip' || stage === 'no_show';
}

function normalizePaymentKind(raw) {
  const s = String(raw || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (!s || s === 'cash') return 'cash';
  if (s === 'card' || s === 'creditcard' || s === 'stripe' || s === 'credit') return 'card';
  if (s === 'wallet') return 'wallet';
  if (s === 'giftcard' || s === 'gift') return 'gift_card';
  if (s === 'account' || s === 'businessaccount' || s === 'business') return 'account';
  if (s === 'acc') return 'acc';
  if (s === 'tm' || s === 'totalmobility' || s === 'totalmob') return 'tm';
  return s || 'cash';
}

function isPrepaidKind(kind) {
  return kind === 'card' || kind === 'wallet' || kind === 'gift_card';
}

function isAccountKind(kind) {
  return kind === 'account' || kind === 'acc';
}

function jobLooksTM(job) {
  if (!job || typeof job !== 'object') return false;
  if (job.isTM === true || job.IsTM === true || job.isTotalMobility === true || job.tmUsed === true) return true;
  const pay = String(job.PaymentMethod || job.paymentMethod || job.PaymentType || job.paymentType || '').toLowerCase();
  return sIncludesTm(pay);
}

function sIncludesTm(s) {
  return /\btm\b|total\s*mobility|totalmobility/.test(String(s || '').toLowerCase());
}

function remainderKindFromJob(job) {
  if (!job || typeof job !== 'object') return 'cash';
  const explicit = job.tmRemainderPaymentType || job.TmRemainderPaymentType || job.tmRemainder || job.remainderPayment;
  if (explicit) return normalizePaymentKind(explicit);
  const pay = normalizePaymentKind(job.PaymentMethod || job.paymentMethod || job.PaymentType || job.paymentType);
  if (pay === 'tm') return 'cash';
  return pay || 'cash';
}

function passengerStakeFromJob(job) {
  if (!job || typeof job !== 'object') return 0;
  const tmAmt = parseMoney(
    job.tmPassengerPays != null ? job.tmPassengerPays
      : (job.tmPassengerAmount != null ? job.tmPassengerAmount
        : (job.passengerPays != null ? job.passengerPays
          : (job.PassengerPays != null ? job.PassengerPays : job.tmPassengerShare))),
  );
  const fare = parseMoney(
    job.EstimatedFare != null ? job.EstimatedFare
      : (job.estimatedFare != null ? job.estimatedFare
        : (job.Fare != null ? job.Fare
          : (job.fare != null ? job.fare
            : (job.CustomeRate != null ? job.CustomeRate
              : (job.RideCost != null ? job.RideCost : job.FareSnapshot))))),
  );
  if (jobLooksTM(job) && tmAmt > 0) return tmAmt;
  return fare;
}

function computeDriverProgress(opts) {
  const pickup = opts && opts.pickup;
  const driver = opts && opts.driver;
  const startKmRaw = opts && opts.startDistanceKm;
  const startKm = Number(startKmRaw);
  const currentKm = haversineKm(driver, pickup);
  const hasPickup = !!(pickup && Number.isFinite(Number(pickup.lat)) && Number.isFinite(Number(pickup.lng))
    && (Math.abs(Number(pickup.lat)) > 0.0001 || Math.abs(Number(pickup.lng)) > 0.0001));
  const hasDriver = currentKm != null;
  if (!hasPickup || !hasDriver || !(startKm > 0)) {
    return { progressPct: null, gpsUnknown: true, currentKm: currentKm, startKm: startKm > 0 ? startKm : null };
  }
  const pct = Math.min(1, Math.max(0, 1 - currentKm / startKm));
  return { progressPct: pct, gpsUnknown: false, currentKm, startKm };
}

function cardChargeFraction(stage, progressPct, gpsUnknown) {
  if (stage === 'not_assigned') return 0;
  if (stage === 'arrived' || stage === 'on_trip' || stage === 'no_show') return 1;
  // Assigned. Missing GPS must not look free.
  if (gpsUnknown || progressPct == null || !Number.isFinite(progressPct)) return 0.5;
  if (progressPct >= FULL_PROGRESS_THRESHOLD) return 1;
  return 0.5;
}

function accountChargeFraction(stage) {
  if (stage === 'not_assigned') return 0;
  return 1;
}

function computeCancelFairness(input) {
  const status = input && input.status;
  const isNoShow = !!(input && (input.isNoShow || input.terminalKind === 'No Show' || input.terminalKind === 'NoShow'));
  const stage = classifyStage(status, { isNoShow, hasDriver: !!(input && input.hasDriver) });
  const isTM = !!(input && input.isTM);
  const paymentKind = normalizePaymentKind(input && input.paymentMethod);
  const remainderKind = isTM
    ? normalizePaymentKind(input && (input.remainderPayment || input.paymentMethod))
    : paymentKind;
  const billableKind = isTM ? remainderKind : (paymentKind === 'tm' ? 'cash' : paymentKind);
  const fare = roundMoney(parseMoney(input && input.fare));
  const stake = roundMoney(
    isTM
      ? (parseMoney(input && input.tmPassengerAmount) || fare)
      : fare,
  );
  const gpsUnknown = !!(input && input.gpsUnknown);
  const progressPct = input && Number.isFinite(Number(input.progressPct)) ? Number(input.progressPct) : null;
  const canSelfServe = !isSelfServeLocked(stage);
  const dispatcherTriggered = !!(input && input.dispatcherTriggered);

  let chargeFraction = 0;
  let chargeTarget = 'none';
  if (billableKind === 'cash') {
    chargeFraction = 0;
    chargeTarget = 'none';
  } else if (isPrepaidKind(billableKind)) {
    chargeFraction = cardChargeFraction(stage, progressPct, gpsUnknown);
    chargeTarget = chargeFraction > 0 ? 'card_retain' : 'none';
  } else if (isAccountKind(billableKind)) {
    chargeFraction = accountChargeFraction(stage);
    chargeTarget = chargeFraction > 0 ? (billableKind === 'acc' ? 'acc_bill' : 'account_bill') : 'none';
  }

  const chargeAmount = roundMoney(stake * chargeFraction);
  const creditAmount = isPrepaidKind(billableKind) ? roundMoney(stake - chargeAmount) : 0;

  let outcome = 'free';
  if (!canSelfServe && input && input.forSelfServePreview) outcome = 'locked';
  else if (billableKind === 'cash') outcome = 'free';
  else if (chargeAmount <= 0 && creditAmount > 0) outcome = 'refund';
  else if (chargeAmount > 0 && creditAmount > 0) outcome = 'partial_charge';
  else if (chargeAmount > 0) outcome = 'charge';
  else outcome = 'free';

  const messages = buildPassengerMessages({
    outcome,
    stage,
    isTM,
    billableKind,
    stake,
    chargeAmount,
    creditAmount,
    gpsUnknown,
    progressPct,
    canSelfServe,
    dispatcherTriggered,
  });

  return {
    canSelfServe,
    stage,
    gpsUnknown: stage === 'assigned' ? gpsUnknown : false,
    progressPct: gpsUnknown ? null : progressPct,
    fullProgressThreshold: FULL_PROGRESS_THRESHOLD,
    paymentKind,
    billableKind,
    isTM,
    councilCharged: false,
    stakeAmount: stake,
    fareAmount: fare,
    chargeFraction,
    chargeAmount,
    creditAmount,
    chargeTarget,
    outcome,
    title: messages.title,
    detail: messages.detail,
    passengerMessage: messages.after,
    confirmMessage: messages.confirm,
    supportEmail: SUPPORT_EMAIL,
  };
}

function buildPassengerMessages(f) {
  const stake = formatMoney(f.stake);
  const charge = formatMoney(f.chargeAmount);
  const credit = formatMoney(f.creditAmount);
  const prefix = f.dispatcherTriggered ? 'Dispatch cancelled this booking. ' : '';
  const tm = f.isTM ? ' The council subsidy is never charged on cancel.' : '';
  const gpsNote = f.gpsUnknown && f.stage === 'assigned'
    ? ' Driver location was not available, so this is treated as an assigned trip — not a free cancel.'
    : '';

  if (f.outcome === 'locked' || (!f.canSelfServe && f.outcome === 'locked')) {
    return {
      title: 'Cannot cancel',
      detail: 'The driver has arrived — self-serve cancel is no longer available. Please call the company if you need help.',
      confirm: 'The driver has arrived — you cannot cancel from the app. Call the company.',
      after: prefix + 'The driver had arrived, so this booking cannot be self-serve cancelled.',
    };
  }

  if (f.billableKind === 'cash') {
    return {
      title: 'Cancel ride?',
      detail: 'Cash booking — cancelled at no charge. Your driver will be notified.',
      confirm: 'This cash booking will be cancelled at no charge.',
      after: prefix + 'Your cash booking was cancelled at no charge.',
    };
  }

  if (f.stage === 'not_assigned') {
    if (isPrepaidKind(f.billableKind)) {
      const after = `${prefix}Cancelled before a driver was assigned. ${stake} has been credited to your BookaWaka wallet (not refunded to your card). Use it on your next trip. For a real card refund, email ${SUPPORT_EMAIL} with this booking ID.${tm}`;
      return {
        title: 'Cancel ride?',
        detail: `No driver assigned yet — ${stake} will be credited to your BookaWaka wallet, not back to your card.${tm}`,
        confirm: after,
        after,
      };
    }
    const after = `${prefix}Cancelled before a driver was assigned. No charge to your monthly account.${tm}`;
    return {
      title: 'Cancel ride?',
      detail: 'No driver assigned yet — your booking will be cancelled at no charge.',
      confirm: after,
      after,
    };
  }

  if (f.outcome === 'partial_charge') {
    const after = `${prefix}A driver was assigned.${gpsNote} ${charge} (50% of ${stake}) is charged. ${credit} has been credited to your BookaWaka wallet.${tm}`;
    return {
      title: 'Cancellation charge applies',
      detail: `Driver is still early.${gpsNote} 50% of ${stake} (${charge}) will be charged. ${credit} goes to your BookaWaka wallet.${tm}`,
      confirm: after,
      after,
    };
  }

  if (f.outcome === 'charge' && isPrepaidKind(f.billableKind)) {
    const why = f.stage === 'no_show'
      ? 'This was recorded as a no-show.'
      : f.stage === 'arrived' || f.stage === 'on_trip'
        ? 'The driver had arrived.'
        : (f.gpsUnknown ? 'Driver location was not available.' : 'The driver was 60% or more of the way to pickup.');
    const after = `${prefix}${why} The full ${stake} has been charged. No wallet credit applies at this stage.${tm}`;
    return {
      title: 'Full fare charged',
      detail: `${why} The full ${stake} will be charged.${tm}`,
      confirm: after,
      after,
    };
  }

  if (f.outcome === 'charge' && isAccountKind(f.billableKind)) {
    const bill = f.billableKind === 'acc' ? 'ACC account' : 'monthly account bill';
    const after = `${prefix}A driver was assigned, so the full ${stake} will be charged to your ${bill}.${tm}`;
    return {
      title: 'Account charge applies',
      detail: `A driver has been assigned. The full ${stake} will be charged to your ${bill}.${tm}`,
      confirm: after,
      after,
    };
  }

  const after = `${prefix}Your booking was cancelled.${tm}`;
  return {
    title: 'Cancel ride?',
    detail: 'Your booking will be cancelled.',
    confirm: after,
    after,
  };
}

function bookingTimeCancelRules(kind, isTM) {
  const k = normalizePaymentKind(kind);
  if (isTM) {
    return 'Cancel any time until the driver arrives. The council subsidy is never charged on cancel. Your remainder follows Card rules if you pay by card (wallet credit before assignment; 50% then 100% after assignment), Account/ACC rules if that, or no charge if cash. Missing GPS is not treated as a free cancel.';
  }
  if (k === 'cash') {
    return 'Cash bookings can be cancelled at no charge until the driver arrives. Repeated cash cancellations may require card payment in future.';
  }
  if (isPrepaidKind(k)) {
    return 'Cancel any time until the driver arrives. Before a driver is assigned, the fare is credited to your BookaWaka wallet (not back to your card). After assignment: 50% if the driver is still early; 100% if they are 60% or more of the way to you, have arrived, or if you no-show. Missing GPS is not treated as free. For a real card refund, email ' + SUPPORT_EMAIL + '.';
  }
  if (isAccountKind(k)) {
    return 'Cancel any time until the driver arrives. No charge before a driver is assigned. After assignment (any later stage, including arrived or no-show), the full fare is billed to your monthly account.';
  }
  return 'Cancel any time until the driver arrives. Charges depend on payment method and how far the driver has come.';
}

function recordCashCancelState(existing, nowMs) {
  const now = Number(nowMs) || Date.now();
  const windowStart = now - CASH_CANCEL_WINDOW_MS;
  const prev = existing && typeof existing === 'object' ? existing : {};
  const raw = prev.cashCancels;
  const stamps = [];
  if (Array.isArray(raw)) {
    for (const t of raw) {
      const n = Number(t);
      if (Number.isFinite(n) && n >= windowStart) stamps.push(n);
    }
  } else if (raw && typeof raw === 'object') {
    for (const v of Object.values(raw)) {
      const n = Number(v && v.at != null ? v.at : v);
      if (Number.isFinite(n) && n >= windowStart) stamps.push(n);
    }
  }
  stamps.push(now);
  const count = stamps.length;
  const alreadyCardOnly = prev.cardOnly === true;
  const warning = count >= CASH_CANCEL_WARN_AT;
  const cardOnly = alreadyCardOnly || count > CASH_CANCEL_WARN_AT;
  return {
    cashCancels: stamps,
    count,
    warning,
    justWarned: warning && !prev.warningAt && count === CASH_CANCEL_WARN_AT,
    cardOnly,
    justCardOnly: cardOnly && !alreadyCardOnly,
    warningAt: prev.warningAt || (warning ? new Date(now).toISOString() : null),
    cardOnlyAt: prev.cardOnlyAt || (cardOnly ? new Date(now).toISOString() : null),
    updatedAt: new Date(now).toISOString(),
  };
}

function fairnessFromJob(job, extra) {
  extra = extra || {};
  const progress = extra.progress || { progressPct: null, gpsUnknown: true };
  const status = extra.status || job.BookingStatus || job.Status || job.status;
  const isTM = jobLooksTM(job);
  const pay = job.PaymentMethod || job.paymentMethod || job.PaymentType || job.paymentType;
  return computeCancelFairness({
    status,
    paymentMethod: remainderKindFromJob(job),
    fare: passengerStakeFromJob(job),
    isTM,
    tmPassengerAmount: passengerStakeFromJob(job),
    remainderPayment: remainderKindFromJob(job),
    progressPct: progress.progressPct,
    gpsUnknown: progress.gpsUnknown,
    isNoShow: extra.isNoShow,
    terminalKind: extra.terminalKind,
    dispatcherTriggered: extra.dispatcherTriggered,
    forSelfServePreview: extra.forSelfServePreview,
    hasDriver: extra.hasDriver,
  });
}

function selfServeAllowedStatus(status) {
  return !isSelfServeLocked(classifyStage(status, {}));
}

module.exports = {
  FULL_PROGRESS_THRESHOLD,
  SUPPORT_EMAIL,
  CASH_CANCEL_WINDOW_MS,
  CASH_CANCEL_WARN_AT,
  parseMoney,
  roundMoney,
  formatMoney,
  haversineKm,
  normalizeStatus,
  classifyStage,
  isSelfServeLocked,
  normalizePaymentKind,
  isPrepaidKind,
  isAccountKind,
  jobLooksTM,
  remainderKindFromJob,
  passengerStakeFromJob,
  computeDriverProgress,
  computeCancelFairness,
  bookingTimeCancelRules,
  recordCashCancelState,
  fairnessFromJob,
  selfServeAllowedStatus,
};
