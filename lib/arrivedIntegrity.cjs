'use strict';

/**
 * Arrived-at-pickup integrity: real GPS distance + unproven-GPS flags +
 * Arrived-then-immediate-cancel abuse → warnings then full account suspension.
 * PIN is not a presence signal (driver can already read it).
 * Do not permanently lock Arrived — a genuine driver must never get stuck.
 */

const { haversineKm } = require('./cancelFairness.cjs');

const TRAJECTORY_WINDOW_MS = 4 * 60 * 1000;
const TRAJECTORY_MIN_SPAN_MS = 90 * 1000;
const TRAJECTORY_MIN_SAMPLES = 3;
const MIN_IMPROVE_KM = 0.08;
const AT_CURB_KM = 0.12;
const TOO_FAR_KM = 0.5;
/** Only treat a far ping as "you're not there yet" when it is this fresh. */
const GPS_FAR_FRESH_MS = 30 * 1000;
const ARRIVED_CANCEL_IMMEDIATE_MS = 120 * 1000;
const ABUSE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const ABUSE_WARN_AT = 3;

function arrivedTrajectorySkipped() {
  if (String(process.env.BW_SKIP_ARRIVED_TRAJECTORY || '').trim() === '1') return true;
  const override = process.env.BW_ARRIVED_TRAJECTORY_WINDOW_MS;
  if (override != null && String(override).trim() !== '') {
    const n = Number(override);
    if (Number.isFinite(n) && n <= 0) return true;
  }
  return false;
}

function metersFromKm(km) {
  const n = Number(km);
  if (!Number.isFinite(n) || n < 0) return 1;
  return Math.max(1, Math.round(n * 1000));
}

function notAtPickupResult(lastDistKm) {
  const meters = metersFromKm(lastDistKm);
  return {
    ok: false,
    error_code: 'arrived_not_at_pickup',
    error: `You're not at the pickup location yet — approximately ${meters} meters away.`,
    lastDistKm,
    meters,
  };
}

function allowUnproven(reason, extra) {
  return Object.assign({
    ok: true,
    gpsUnproven: true,
    reason: reason || 'gps_unavailable',
  }, extra || {});
}

function evaluateApproachTrajectory(input) {
  const now = Number(input && input.nowMs) || Date.now();
  const pickup = input && input.pickup;
  const samplesIn = Array.isArray(input && input.samples) ? input.samples : [];
  const windowMs = Number(input && input.windowMs) > 0 ? Number(input.windowMs) : TRAJECTORY_WINDOW_MS;
  const minSpan = Number(input && input.minSpanMs) > 0 ? Number(input.minSpanMs) : TRAJECTORY_MIN_SPAN_MS;
  const minSamples = Number(input && input.minSamples) > 0 ? Number(input.minSamples) : TRAJECTORY_MIN_SAMPLES;
  const farFreshMs = Number(input && input.gpsFarFreshMs) > 0 ? Number(input.gpsFarFreshMs) : GPS_FAR_FRESH_MS;

  if (!pickup || !Number.isFinite(Number(pickup.lat)) || !Number.isFinite(Number(pickup.lng))) {
    return allowUnproven('pickup_missing');
  }

  const cutoff = now - windowMs;
  const samples = samplesIn
    .map((s) => ({
      lat: Number(s && s.lat),
      lng: Number(s && s.lng),
      at: Number(s && s.at),
    }))
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && Number.isFinite(s.at) && s.at >= cutoff - windowMs && s.at <= now + 2000)
    .sort((a, b) => a.at - b.at);

  const last = samples.length ? samples[samples.length - 1] : null;
  if (!last) {
    return allowUnproven('gps_unavailable', { sampleCount: 0 });
  }

  const lastDist = haversineKm(last, pickup);
  if (lastDist == null) {
    return allowUnproven('gps_invalid');
  }

  const ageMs = now - last.at;
  const atCurb = lastDist <= AT_CURB_KM;

  const windowed = samples.filter((s) => s.at >= cutoff);
  let approaching = false;
  let improvedKm = 0;
  let spanMs = 0;
  if (windowed.length >= minSamples) {
    spanMs = windowed[windowed.length - 1].at - windowed[0].at;
    if (spanMs >= minSpan) {
      const firstDist = haversineKm(windowed[0], pickup);
      if (firstDist != null) {
        improvedKm = firstDist - lastDist;
        approaching = improvedKm >= MIN_IMPROVE_KM;
      }
    }
  }

  if (atCurb) {
    return {
      ok: true,
      atCurb: true,
      approaching,
      genuine: true,
      snapshotOnly: !approaching,
      lastDistKm: lastDist,
      improvedKm,
      sampleCount: samples.length,
      spanMs,
    };
  }

  // Fresh GPS clearly shows they are not at pickup — hard reject with distance.
  if (ageMs <= farFreshMs) {
    return notAtPickupResult(lastDist);
  }

  // Stale / no-signal: never hard-reject. Allow and flag for pattern review.
  return allowUnproven('gps_stale', {
    lastDistKm: lastDist,
    ageMs,
    sampleCount: samples.length,
  });
}

function isImmediateArrivedCancel(job, nowMs) {
  const now = Number(nowMs) || Date.now();
  const stage = String((job && (job.BookingStatus || job.CancelStage || job.Status)) || '');
  if (String(stage).toLowerCase() !== 'arrived') return false;
  if (job.ActiveAt || job.activeAt) return false;
  const arrivedMs = Date.parse(String(job.ArrivedAt || job.arrivedAt || '')) || 0;
  if (!arrivedMs) return false;
  return (now - arrivedMs) <= ARRIVED_CANCEL_IMMEDIATE_MS;
}

function isUnprovenArrived(job) {
  if (!job || typeof job !== 'object') return false;
  return !!(job.ArrivedGpsUnproven || job.ArrivedSnapshotOnly);
}

function recordArrivedCancelState(existing, nowMs) {
  const now = Number(nowMs) || Date.now();
  const windowStart = now - ABUSE_WINDOW_MS;
  const prev = existing && typeof existing === 'object' ? existing : {};
  const raw = prev.events;
  const stamps = [];
  if (Array.isArray(raw)) {
    for (const t of raw) {
      const n = Number(t && t.at != null ? t.at : t);
      if (Number.isFinite(n) && n >= windowStart) stamps.push(n);
    }
  }
  stamps.push(now);
  const count = stamps.length;
  const alreadySuspended = prev.suspended === true;
  const warning = count >= ABUSE_WARN_AT;
  const suspended = alreadySuspended || count > ABUSE_WARN_AT;
  return {
    events: stamps.map((at) => ({ at })),
    count,
    warning,
    justWarned: warning && !prev.warningAt && count === ABUSE_WARN_AT,
    suspended,
    justSuspended: suspended && !alreadySuspended,
    warningAt: prev.warningAt || (warning ? new Date(now).toISOString() : null),
    suspendedAt: prev.suspendedAt || (suspended ? new Date(now).toISOString() : null),
    updatedAt: new Date(now).toISOString(),
  };
}

module.exports = {
  TRAJECTORY_WINDOW_MS,
  TRAJECTORY_MIN_SPAN_MS,
  TRAJECTORY_MIN_SAMPLES,
  MIN_IMPROVE_KM,
  AT_CURB_KM,
  TOO_FAR_KM,
  GPS_FAR_FRESH_MS,
  ARRIVED_CANCEL_IMMEDIATE_MS,
  ABUSE_WINDOW_MS,
  ABUSE_WARN_AT,
  arrivedTrajectorySkipped,
  metersFromKm,
  evaluateApproachTrajectory,
  isImmediateArrivedCancel,
  isUnprovenArrived,
  recordArrivedCancelState,
  haversineKm,
};
