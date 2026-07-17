import { statusColor, type Driver, type DriverStatus } from '@/types/driver';
import { haversineKm } from '@/lib/fareEstimate';
import { parseLatLng } from '@/types/job';

/** Connectivity badge / job-card stale threshold (confirmed product setting). */
export const DRIVER_CONNECTIVITY_STALE_MS = 30_000;

/** Amber used when lastSeen is stale — shared by DriverRow, Zone Queue, detail. */
export const DRIVER_CONNECTIVITY_STALE_HEX = '#d97706';

/** Tailwind class for connectivity-stale drivers (Zone Queue + legends). */
export const DRIVER_CONNECTIVITY_STALE_CLASS = 'text-amber-600 dark:text-amber-400';

/** Rough urban speed for ETA from last GPS → pickup (km/h). */
const STALE_REASSIGN_ETA_KMH = 30;

const ON_JOB_STATUSES = new Set<DriverStatus | string>([
  'Assigned',
  'Picking',
  'Arrived',
  'Active',
  'OnTrip',
  'Busy',
]);

/** Statuses where reassignment is hard-blocked server-side. */
export const REASSIGN_BLOCKED_STATUSES = new Set([
  'Picking',
  'Arrived',
  'Active',
  'OnTrip',
  'Busy',
]);

/** Normalize Firebase lastSeen (sec or ms) to ms; 0 if missing/invalid. */
export function normalizeLastSeenMs(raw: unknown): number {
  const n = Number(raw || 0);
  if (!n || !Number.isFinite(n)) return 0;
  return n < 1e12 ? n * 1000 : n;
}

export function lastSeenAgeMs(lastSeen: unknown, now = Date.now()): number | null {
  const ms = normalizeLastSeenMs(lastSeen);
  if (!ms) return null;
  return Math.max(0, now - ms);
}

export function isDriverConnectivityStale(lastSeen: unknown, now = Date.now()): boolean {
  const age = lastSeenAgeMs(lastSeen, now);
  return age != null && age > DRIVER_CONNECTIVITY_STALE_MS;
}

/**
 * Hex colour for driver status chips / borders.
 * Connectivity-stale overrides status colour so Zone Queue and Driver board match.
 */
export function driverPresenceColorHex(
  status: DriverStatus | string,
  lastSeen: unknown,
  now = Date.now(),
): string {
  if (isDriverConnectivityStale(lastSeen, now)) return DRIVER_CONNECTIVITY_STALE_HEX;
  return statusColor(String(status || '').trim() as DriverStatus);
}

export function formatLastSeenAge(ageMs: number): string {
  const sec = Math.max(0, Math.floor(ageMs / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

export function isOnJobDriverStatus(status: string | undefined | null): boolean {
  return !!status && ON_JOB_STATUSES.has(status);
}

/** Job-card / detail copy when an assigned driver has gone quiet. */
export function driverConnectivityJobBanner(
  driver: Pick<Driver, 'lastSeen' | 'status'> | null | undefined,
  now = Date.now(),
): string | null {
  if (!driver) return null;
  if (!isDriverConnectivityStale(driver.lastSeen, now)) return null;
  const age = lastSeenAgeMs(driver.lastSeen, now);
  if (age == null) return null;
  const ageLabel = formatLastSeenAge(age);
  if (isOnJobDriverStatus(driver.status)) {
    return `Driver last seen ${ageLabel} ago - still assigned`;
  }
  return `Driver last seen ${ageLabel} ago`;
}

export type StaleReassignContext = {
  needsConfirm: boolean;
  driverName: string;
  lastSeenLabel: string;
  /** Distance/ETA from last GPS to pickup, or location-unknown copy. */
  locationLine: string;
  warning: string;
};

/**
 * Assigned-only: reassigning away from a connectivity-stale driver needs an extra confirm.
 * Fresh heartbeats and Pending/No One / first assign skip this.
 */
export function buildStaleAssignedReassignContext(opts: {
  jobStatus: string;
  currentDriverId: string | undefined | null;
  newDriverId: string;
  currentDriver: Pick<Driver, 'driverName' | 'lastSeen' | 'lat' | 'lng' | 'status'> | null | undefined;
  pickLatLng?: string;
  now?: number;
}): StaleReassignContext | null {
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
  if (
    pickup &&
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
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

export function reassignBlockedMessage(jobStatus: string): string | null {
  const st = String(jobStatus || '').trim();
  if (!REASSIGN_BLOCKED_STATUSES.has(st)) return null;
  return `Cannot reassign while job is ${st} - passenger may already be with the driver.`;
}
