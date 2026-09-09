'use strict';

/**
 * Arrived-at-pickup integrity: trajectory toward pickup + Arrived-then-immediate-cancel abuse.
 * PIN is not a presence signal (driver can already read it).
 */

const { haversineKm } = require('./cancelFairness.cjs');

const TRAJECTORY_WINDOW_MS = 4 * 60 * 1000;
const TRAJECTORY_MIN_SPAN_MS = 90 * 1000;
const TRAJECTORY_MIN_SAMPLES = 3;
const MIN_IMPROVE_KM = 0.08;
const AT_CURB_KM = 0.12;
const TOO_FAR_KM = 0.5;
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

function evaluateApproachTrajectory(input) {
  const now = Number(input && input.nowMs) || Date.now();
  const pickup = input && input.pickup;
  const samplesIn = Array.isArray(input && input.samples) ? input.samples : [];
  const windowMs = Number(input && input.windowMs) > 0 ? Number(input.windowMs) : TRAJECTORY_WINDOW_MS;
  const minSpan = Number(input && input.minSpanMs) > 0 ? Number(input.minSpanMs) : TRAJECTORY_MIN_SPAN_MS;
  const minSamples = Number(input && input.minSamples) > 0 ? Number(input.minSamples) : TRAJECTORY_MIN_SAMPLES;

  if (!pickup || !Number.isFinite(Number(pickup.lat)) || !Number.isFinite(Number(pickup.lng))) {
    return {
      ok: false,
      error_code: 'arrived_trajectory_unproven',
      error: 'Pickup location is missing — Arrived cannot be proven without a real pickup point',
    };
  }

  const cutoff = now - windowMs;
  const samples = samplesIn
    .map((s) => ({
      lat: Number(s && s.lat),
      lng: Number(s && s.lng),
      at: Number(s && s.at),
    }))
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && Number.isFinite(s.at) && s.at >= cutoff && s.at <= now + 2000)
    .sort((a, b) => a.at - b.at);

  if (samples.length < minSamples) {
    return {
      ok: false,
      error_code: 'arrived_trajectory_unproven',
      error: 'Driver GPS has not shown genuine movement toward pickup over the last few minutes',
      sampleCount: samples.length,
    };
  }

  const span = samples[samples.length - 1].at - samples[0].at;
  if (span < minSpan) {
    return {
      ok: false,
      error_code: 'arrived_trajectory_unproven',
      error: 'GPS trail is too short to prove the driver travelled to pickup',
      spanMs: span,
    };
  }

  const firstDist = haversineKm(samples[0], pickup);
  const lastDist = haversineKm(samples[samples.length - 1], pickup);
  if (firstDist == null || lastDist == null) {
    return {
      ok: false,
      error_code: 'arrived_trajectory_unproven',
      error: 'Driver GPS is not a real location',
    };
  }

  const improved = firstDist - lastDist;
  const atCurb = lastDist <= AT_CURB_KM;
  const approaching = improved >= MIN_IMPROVE_KM;

  if (lastDist > TOO_FAR_KM && !approaching) {
    return {
      ok: false,
      error_code: 'arrived_not_at_pickup',
      error: 'Driver GPS is not at the pickup and has not been moving toward it',
      lastDistKm: lastDist,
      improvedKm: improved,
    };
  }

  if (!atCurb && !approaching) {
    return {
      ok: false,
      error_code: 'arrived_trajectory_unproven',
      error: 'GPS is not moving toward the pickup — a single ping is not enough',
      lastDistKm: lastDist,
      improvedKm: improved,
    };
  }

  return {
    ok: true,
    lastDistKm: lastDist,
    improvedKm: improved,
    atCurb,
    approaching,
    sampleCount: samples.length,
    spanMs: span,
  };
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
  const alreadyLocked = prev.arrivedLocked === true;
  const warning = count >= ABUSE_WARN_AT;
  const arrivedLocked = alreadyLocked || count > ABUSE_WARN_AT;
  return {
    events: stamps.map((at) => ({ at })),
    count,
    warning,
    justWarned: warning && !prev.warningAt && count === ABUSE_WARN_AT,
    arrivedLocked,
    justLocked: arrivedLocked && !alreadyLocked,
    warningAt: prev.warningAt || (warning ? new Date(now).toISOString() : null),
    lockedAt: prev.arrivedLockedAt || prev.lockedAt || (arrivedLocked ? new Date(now).toISOString() : null),
    arrivedLockedAt: prev.arrivedLockedAt || (arrivedLocked ? new Date(now).toISOString() : null),
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
  ARRIVED_CANCEL_IMMEDIATE_MS,
  ABUSE_WINDOW_MS,
  ABUSE_WARN_AT,
  arrivedTrajectorySkipped,
  evaluateApproachTrajectory,
  isImmediateArrivedCancel,
  recordArrivedCancelState,
  haversineKm,
};
