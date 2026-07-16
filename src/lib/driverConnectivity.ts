import type { Driver, DriverStatus } from '@/types/driver';

/** Connectivity badge / job-card stale threshold (confirmed product setting). */
export const DRIVER_CONNECTIVITY_STALE_MS = 30_000;

const ON_JOB_STATUSES = new Set<DriverStatus | string>([
  'Assigned',
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
