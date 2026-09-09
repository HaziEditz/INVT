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

test('trajectory: approaching over minutes toward pickup is allowed', () => {
  const now = Date.now();
  const r = I.evaluateApproachTrajectory({ samples: approachingTrail(now), pickup, nowMs: now });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(r.approaching || r.atCurb);
});

test('trajectory: single GPS ping is not enough', () => {
  const now = Date.now();
  const r = I.evaluateApproachTrajectory({
    samples: [{ lat: -46.413, lng: 168.353, at: now }],
    pickup,
    nowMs: now,
  });
  assert.equal(r.ok, false);
  assert.equal(r.error_code, 'arrived_trajectory_unproven');
});

test('trajectory: stationary far from pickup is rejected', () => {
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
  assert.ok(r.error_code === 'arrived_not_at_pickup' || r.error_code === 'arrived_trajectory_unproven');
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
  assert.equal(
    I.isImmediateArrivedCancel({ BookingStatus: 'Arrived', ArrivedAt: new Date(now - 200_000).toISOString() }, now),
    false,
  );
});

test('driver Arrived-cancel abuse: 3 warns, 4th locks (same shape as passenger cash)', () => {
  const t0 = Date.now();
  let state = {};
  state = I.recordArrivedCancelState(state, t0);
  state = I.recordArrivedCancelState(state, t0 + 1000);
  state = I.recordArrivedCancelState(state, t0 + 2000);
  assert.equal(state.warning, true);
  assert.equal(state.arrivedLocked, false);
  state = I.recordArrivedCancelState(state, t0 + 3000);
  assert.equal(state.arrivedLocked, true);
  assert.equal(state.justLocked, true);
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
  assert.ok(
    refreshIdx < clearIdx,
    'Assigned/website/driver cancel must refresh dispatch before awaiting Firebase cleanup',
  );
  assert.match(src, /§FIX-CB early dispatchConsole refresh/);
});

test('PIN is not used as Arrived presence proof', () => {
  assert.doesNotMatch(src, /PickupPin[\s\S]{0,80}arrived_trajectory/);
  assert.doesNotMatch(src, /jobPickupPin[\s\S]{0,80}evaluateApproachTrajectory/);
  assert.match(src, /arrivedIntegrity/);
});

test('Arrived gate is wired on driverStageJob and both DriverStatusChanged paths', () => {
  assert.match(src, /if \(nextStatus === 'Arrived'\) \{\r?\n\s*const _arrGate = _evaluateArrivedIntegrity/);
  assert.match(src, /_evaluateArrivedIntegrity\(job, driverId, 'DriverStatusChanged'\)/);
  assert.match(src, /_evaluateArrivedIntegrity\(job, driverId, 'DriverStatusChanged\/DS'\)/);
  assert.match(src, /_recordDriverArrivedCancelAbuse/);
  assert.match(src, /_recordDriverGpsSample/);
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
