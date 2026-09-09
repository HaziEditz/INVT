import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const I = require('../../lib/arrivedIntegrity.cjs');
const src = readFileSync(join(root, 'server.js'), 'utf8');

const pickup = { lat: -46.413, lng: 168.353 };

function approachingTrail(now) {
  return [
    { lat: -46.430, lng: 168.360, at: now - 180000 },
    { lat: -46.422, lng: 168.356, at: now - 120000 },
    { lat: -46.416, lng: 168.354, at: now - 60000 },
    { lat: -46.4132, lng: 168.3532, at: now - 5000 },
  ];
}

test('trajectory: at pickup after approaching is allowed', () => {
  const now = Date.now();
  const r = I.evaluateApproachTrajectory({ samples: approachingTrail(now), pickup, nowMs: now });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.atCurb, true);
  assert.equal(r.gpsUnproven, undefined);
});

test('fresh GPS far from pickup is rejected with meters', () => {
  const now = Date.now();
  const r = I.evaluateApproachTrajectory({
    samples: [
      { lat: -46.50, lng: 168.40, at: now - 180000 },
      { lat: -46.5001, lng: 168.4001, at: now - 90000 },
      { lat: -46.5002, lng: 168.4002, at: now - 1000 },
    ],
    pickup,
    nowMs: now,
  });
  assert.equal(r.ok, false);
  assert.equal(r.error_code, 'arrived_not_at_pickup');
  assert.match(r.error, /approximately \d+ meters away/);
  assert.ok(r.meters > 100);
});

test('no GPS / no signal allows Arrived with unproven flag (never stuck)', () => {
  const now = Date.now();
  const r = I.evaluateApproachTrajectory({ samples: [], pickup, nowMs: now });
  assert.equal(r.ok, true);
  assert.equal(r.gpsUnproven, true);
});

test('stale far GPS is treated as signal-fail, not "you are far away"', () => {
  const now = Date.now();
  const r = I.evaluateApproachTrajectory({
    samples: [{ lat: -46.50, lng: 168.40, at: now - 180000 }],
    pickup,
    nowMs: now,
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.gpsUnproven, true);
});

test('single fresh ping at the curb is allowed (genuine arrival)', () => {
  const now = Date.now();
  const r = I.evaluateApproachTrajectory({
    samples: [{ lat: -46.413, lng: 168.353, at: now }],
    pickup,
    nowMs: now,
  });
  assert.equal(r.ok, true);
  assert.equal(r.atCurb, true);
});

test('immediate Arrived cancel: within 2 minutes without Active counts', () => {
  const now = Date.now();
  assert.equal(
    I.isImmediateArrivedCancel({ BookingStatus: 'Arrived', ArrivedAt: new Date(now - 30_000).toISOString() }, now),
    true,
  );
  assert.equal(
    I.isImmediateArrivedCancel({ BookingStatus: 'Arrived', ArrivedAt: new Date(now - 30_000).toISOString(), ActiveAt: new Date().toISOString() }, now),
    false,
  );
});

test('unproven Arrived + immediate cancel: 3 warns, 4th suspends (not Arrived-lock)', () => {
  const t0 = Date.now();
  let state = {};
  state = I.recordArrivedCancelState(state, t0);
  state = I.recordArrivedCancelState(state, t0 + 1000);
  state = I.recordArrivedCancelState(state, t0 + 2000);
  assert.equal(state.warning, true);
  assert.equal(state.suspended, false);
  state = I.recordArrivedCancelState(state, t0 + 3000);
  assert.equal(state.suspended, true);
  assert.equal(state.justSuspended, true);
  assert.equal(I.isUnprovenArrived({ ArrivedGpsUnproven: true }), true);
  assert.equal(I.isUnprovenArrived({ ArrivedTrajectoryOk: true }), false);
});

test('cancelBooking signals dispatchConsole refresh before awaiting Firebase clear', () => {
  const fnStart = src.indexOf('async function executeJobCleanup');
  assert.ok(fnStart >= 0);
  const fnEnd = src.indexOf('\nfunction driverHasRemainingAssignments', fnStart + 10);
  const body = src.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 12000);
  const refreshIdx = body.indexOf('await _signalDispatchConsoleRefresh(companyId, opts.consoleRefresh)');
  const clearIdx = body.indexOf('await _bwClearJobFromFirebase');
  assert.ok(refreshIdx >= 0, 'terminal consoleRefresh missing');
  assert.ok(clearIdx >= 0, 'bwClear missing');
  assert.ok(refreshIdx < clearIdx);
  assert.match(src, /§FIX-CB early dispatchConsole refresh/);
});

test('no permanent arrived_locked gate — genuine drivers can still mark Arrived', () => {
  assert.doesNotMatch(src, /error_code: 'arrived_locked'/);
  assert.match(src, /_suspendDriverForArrivedAbuse/);
  assert.match(src, /arrived_cancel_abuse/);
});

test('PIN is not used as Arrived presence proof', () => {
  assert.doesNotMatch(src, /PickupPin[\s\S]{0,80}arrived_trajectory/);
  assert.match(src, /arrivedIntegrity/);
});

test('Arrived gate is wired on driverStageJob and both DriverStatusChanged paths', () => {
  assert.match(src, /if \(nextStatus === 'Arrived'\) \{\r?\n\s*const _arrGate = _evaluateArrivedIntegrity/);
  assert.match(src, /_evaluateArrivedIntegrity\(job, driverId, 'DriverStatusChanged'/);
  assert.match(src, /_evaluateArrivedIntegrity\(job, driverId, 'DriverStatusChanged\/DS'/);
  assert.match(src, /_stampArrivedIntegrityFlags/);
});

test('no-show wait is still required — trajectory does not replace it', () => {
  const PR = require('../../lib/pickupResolution.cjs');
  assert.equal(PR.NOSHOW_BASE_WAIT_MS, 5 * 60 * 1000);
  const prev = process.env.BW_NOSHOW_MIN_WAIT_MS;
  delete process.env.BW_NOSHOW_MIN_WAIT_MS;
  try {
    const now = Date.now();
    const job = {
      BookingStatus: 'Arrived',
      ArrivedAt: new Date(now - 30_000).toISOString(),
      BookingSource: 'Website',
      CreatedBy: 'WEB',
    };
    const tooSoon = PR.canMarkNoShow(job, now);
    assert.equal(tooSoon.ok, false);
    assert.equal(tooSoon.error_code, 'too_early');
    const waited = PR.canMarkNoShow(job, now + 5 * 60 * 1000);
    assert.equal(waited.ok, true);
  } finally {
    if (prev !== undefined) process.env.BW_NOSHOW_MIN_WAIT_MS = prev;
    else delete process.env.BW_NOSHOW_MIN_WAIT_MS;
  }
});
