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

function driverAssignmentOptionLabel(driver, now = Date.now()) {
  const identity = [driver.vehicleNo?.trim(), driver.driverName?.trim()]
    .filter(Boolean)
    .join(' ')
    .trim() || 'Unknown driver';
  const age = lastSeenAgeMs(driver.lastSeen, now);
  if (age == null) return `${identity} — connection unknown`;
  if (age > DRIVER_CONNECTIVITY_STALE_MS) {
    return `${identity} — last seen ${formatLastSeenAge(age)} ago`;
  }
  return `${identity} — online`;
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

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseLatLng(raw) {
  if (!raw) return null;
  const p = String(raw).split(',');
  if (p.length < 2) return null;
  const lat = parseFloat(p[0]);
  const lng = parseFloat(p[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

const STALE_REASSIGN_ETA_KMH = 30;
const REASSIGN_BLOCKED_STATUSES = new Set(['Picking', 'Arrived', 'Active', 'OnTrip', 'Busy']);

function buildStaleAssignedReassignContext(opts) {
  const now = opts.now ?? Date.now();
  const st = String(opts.jobStatus || '').trim();
  if (st !== 'Assigned') return null;
  const curId = String(opts.currentDriverId || '').trim();
  const nextId = String(opts.newDriverId || '').trim();
  if (!curId || !nextId || curId === '0' || curId === '-1' || curId === nextId) return null;
  if (!opts.currentDriver || !isDriverConnectivityStale(opts.currentDriver.lastSeen, now)) {
    return null;
  }
  const age = lastSeenAgeMs(opts.currentDriver.lastSeen, now);
  const lastSeenLabel =
    age != null ? `Last seen ${formatLastSeenAge(age)} ago` : 'Last seen unknown';
  let locationLine = 'Location unknown when last seen.';
  const pickup = parseLatLng(opts.pickLatLng);
  const lat = opts.currentDriver.lat;
  const lng = opts.currentDriver.lng;
  if (pickup && lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    const km = haversineKm(lat, lng, pickup.lat, pickup.lng);
    const etaMin = Math.max(1, Math.round((km / STALE_REASSIGN_ETA_KMH) * 60));
    locationLine =
      km < 0.15
        ? `Last GPS was at the pickup (~${Math.round(km * 1000)} m) when they went quiet.`
        : `~${km < 10 ? km.toFixed(1) : Math.round(km)} km from pickup when last seen (~${etaMin} min ETA at ${STALE_REASSIGN_ETA_KMH} km/h).`;
  }
  return {
    needsConfirm: true,
    driverName: opts.currentDriver.driverName?.trim() || `Driver ${curId}`,
    lastSeenLabel,
    locationLine,
    warning:
      'They may still be driving to this pickup. Reassigning can send two cars to the same passenger.',
  };
}

function reassignBlockedMessage(jobStatus) {
  const st = String(jobStatus || '').trim();
  if (!REASSIGN_BLOCKED_STATUSES.has(st)) return null;
  return `Cannot reassign while job is ${st} - passenger may already be with the driver.`;
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

test('C5 assignment labels show fresh, stale, and unknown connectivity', () => {
  const driver = { vehicleNo: 'T12', driverName: 'Alex' };
  assert.equal(
    driverAssignmentOptionLabel({ ...driver, lastSeen: BASE_MS - 5_000 }, BASE_MS),
    'T12 Alex — online',
  );
  assert.equal(
    driverAssignmentOptionLabel({ ...driver, lastSeen: BASE_MS - 125_000 }, BASE_MS),
    'T12 Alex — last seen 2m ago',
  );
  assert.equal(
    driverAssignmentOptionLabel(driver, BASE_MS),
    'T12 Alex — connection unknown',
  );
});

test('stale Assigned reassign needs confirm with GPS context', () => {
  const now = BASE_MS;
  const ctx = buildStaleAssignedReassignContext({
    jobStatus: 'Assigned',
    currentDriverId: 'D1',
    newDriverId: 'D2',
    currentDriver: {
      driverName: 'Alex',
      lastSeen: now - 90_000,
      lat: -46.413,
      lng: 168.349,
      status: 'Assigned',
    },
    // ~same block as driver coords → near pickup
    pickLatLng: '-46.4132,168.3491',
    now,
  });
  assert.ok(ctx);
  assert.equal(ctx.needsConfirm, true);
  assert.match(ctx.lastSeenLabel, /1m/);
  assert.match(ctx.locationLine, /pickup/i);

  assert.equal(
    buildStaleAssignedReassignContext({
      jobStatus: 'Assigned',
      currentDriverId: 'D1',
      newDriverId: 'D2',
      currentDriver: { driverName: 'Alex', lastSeen: now - 10_000, status: 'Assigned' },
      now,
    }),
    null,
  );

  assert.equal(
    buildStaleAssignedReassignContext({
      jobStatus: 'Active',
      currentDriverId: 'D1',
      newDriverId: 'D2',
      currentDriver: { driverName: 'Alex', lastSeen: now - 90_000, status: 'Active' },
      now,
    }),
    null,
  );
});

test('reassign blocked mid-trip', () => {
  assert.match(reassignBlockedMessage('Active') || '', /Active/);
  assert.equal(reassignBlockedMessage('Assigned'), null);
});

/** Mirrors resolveDriverPresenceStatus Available+Away heal (C1). */
function resolveDriverPresenceStatus(topRaw, currentRaw) {
  const top = String(topRaw || 'Away').trim();
  const cur = String(currentRaw || '').trim();
  if (top === 'Available' && cur === 'Away') return 'Available';
  if (
    top === 'Available' &&
    (cur === 'Picking' || cur === 'Arrived' || cur === 'Active' || cur === 'Assigned')
  ) {
    return cur;
  }
  return top;
}

/** Mirrors zoneQueueVehicleColorClass (C1). */
function zoneQueueVehicleColorClass(status, opts) {
  if (opts?.connectivityStale) return 'text-amber-600 dark:text-amber-400';
  const s = String(status || '').trim();
  if (s === 'Available') return 'text-emerald-400';
  if (s === 'Away') return 'text-amber-400';
  if (s === 'Offered') return 'text-yellow-400';
  if (s === 'Assigned' || s === 'Picking') return 'text-blue-400';
  if (s === 'Arrived') return 'text-violet-400';
  if (s === 'Active' || s === 'OnTrip') return 'text-amber-500';
  if (s === 'Busy') return 'text-orange-400';
  if (s === 'Suspended') return 'text-red-400';
  return 'text-slate-400';
}

test('C1 presence: top Available + current Away resolves Available (not Away)', () => {
  assert.equal(resolveDriverPresenceStatus('Available', 'Away'), 'Available');
  assert.equal(resolveDriverPresenceStatus('Available', 'Assigned'), 'Assigned');
  assert.equal(resolveDriverPresenceStatus('Away', 'Away'), 'Away');
});

test('C1 zone queue colours: Offered yellow not red; stale amber', () => {
  assert.equal(zoneQueueVehicleColorClass('Available'), 'text-emerald-400');
  assert.equal(zoneQueueVehicleColorClass('Offered'), 'text-yellow-400');
  assert.equal(zoneQueueVehicleColorClass('Busy'), 'text-orange-400');
  assert.equal(
    zoneQueueVehicleColorClass('Available', { connectivityStale: true }),
    'text-amber-600 dark:text-amber-400',
  );
});
