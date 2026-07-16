import assert from 'node:assert/strict';
import test from 'node:test';

/** Mirrors src/lib/driverConnectivity.ts — keep in sync when changing thresholds. */
const DRIVER_CONNECTIVITY_STALE_MS = 30_000;
/** Use real ms-era timestamps so normalizeLastSeenMs does not treat them as seconds. */
const BASE_MS = 1_700_000_000_000;

function normalizeLastSeenMs(raw) {
  const n = Number(raw || 0);
  if (!n || !Number.isFinite(n)) return 0;
  return n < 1e12 ? n * 1000 : n;
}

function lastSeenAgeMs(lastSeen, now = Date.now()) {
  const ms = normalizeLastSeenMs(lastSeen);
  if (!ms) return null;
  return Math.max(0, now - ms);
}

function isDriverConnectivityStale(lastSeen, now = Date.now()) {
  const age = lastSeenAgeMs(lastSeen, now);
  return age != null && age > DRIVER_CONNECTIVITY_STALE_MS;
}

function formatLastSeenAge(ageMs) {
  const sec = Math.max(0, Math.floor(ageMs / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

function driverConnectivityJobBanner(driver, now = Date.now()) {
  if (!driver) return null;
  if (!isDriverConnectivityStale(driver.lastSeen, now)) return null;
  const age = lastSeenAgeMs(driver.lastSeen, now);
  if (age == null) return null;
  const ageLabel = formatLastSeenAge(age);
  const onJob = ['Assigned', 'Picking', 'Arrived', 'Active', 'OnTrip', 'Busy'].includes(driver.status);
  return onJob
    ? `Driver last seen ${ageLabel} ago - still assigned`
    : `Driver last seen ${ageLabel} ago`;
}

test('normalizeLastSeenMs accepts sec and ms', () => {
  assert.equal(normalizeLastSeenMs(1_700_000_000), 1_700_000_000_000);
  assert.equal(normalizeLastSeenMs(1_700_000_000_000), 1_700_000_000_000);
  assert.equal(normalizeLastSeenMs(0), 0);
});

test('connectivity stale at 30s threshold', () => {
  const now = BASE_MS;
  assert.equal(isDriverConnectivityStale(now - 29_000, now), false);
  assert.equal(isDriverConnectivityStale(now - DRIVER_CONNECTIVITY_STALE_MS - 1, now), true);
  assert.equal(isDriverConnectivityStale(undefined, now), false);
});

test('job banner for on-job stale driver', () => {
  const now = BASE_MS;
  assert.equal(
    driverConnectivityJobBanner({ lastSeen: now - 90_000, status: 'Assigned' }, now),
    'Driver last seen 1m ago - still assigned',
  );
  assert.equal(
    driverConnectivityJobBanner({ lastSeen: now - 10_000, status: 'Assigned' }, now),
    null,
  );
});

test('formatLastSeenAge', () => {
  assert.equal(formatLastSeenAge(5_000), '5s');
  assert.equal(formatLastSeenAge(125_000), '2m');
  assert.equal(lastSeenAgeMs(BASE_MS - 100_000, BASE_MS), 100_000);
});
