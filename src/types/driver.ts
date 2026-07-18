import type { Job } from '@/types/job';
import {
  TERMINAL_BOOKING_STATUSES,
  isUnassignedDriverId,
  normalizeJobStatus,
} from '@/lib/jobStatusAuthority';

export type DriverStatus =
  | 'Available'
  | 'Offered'
  | 'Picking'
  | 'Busy'
  | 'Active'
  | 'OnTrip'
  | 'Away'
  | 'Assigned'
  | 'Arrived'
  | 'Clearing'
  | 'Suspended';

/** Match driver/vehicle ids (D-prefix, numeric padding) — aligned with server _driverIdsMatch. */
export function driverIdsMatch(a: string, b: string): boolean {
  const stripD = (s: string) => {
    const m = String(s || '').match(/^([dD])0*(\d+)$/);
    if (m) return String(parseInt(m[2], 10));
    return String(s || '').trim();
  };
  const sa = stripD(a);
  const sb = stripD(b);
  if (sa && sb && sa === sb) return true;
  return String(a || '').trim() === String(b || '').trim();
}

const PANEL_JOB_COUNT_STATUSES = new Set([
  'Assigned',
  'Picking',
  'Arrived',
  'Active',
  'OnTrip',
  'Busy',
  'Queued',
]);

/** Live assigned job count for driver panel (active + queued). Mirrors server _computeDriverJobCount. */
export function countDriverAssignedJobs(
  driver: Pick<Driver, 'driverId' | 'vehicleId' | 'vehicleNo'>,
  jobs: ReadonlyArray<Pick<Job, 'driverId' | 'status'>>,
): number {
  let count = 0;
  for (const job of jobs) {
    if (isUnassignedDriverId(job.driverId)) continue;
    const jDrv = String(job.driverId ?? '').trim();
    const matched =
      driverIdsMatch(jDrv, driver.driverId) ||
      driverIdsMatch(jDrv, driver.vehicleId) ||
      driverIdsMatch(jDrv, driver.vehicleNo);
    if (!matched) continue;
    const st = normalizeJobStatus(job.status);
    if (TERMINAL_BOOKING_STATUSES.has(st)) continue;
    if (PANEL_JOB_COUNT_STATUSES.has(st)) count++;
  }
  return count;
}

export function resolveDriverPanelJobCount(
  driver: Pick<Driver, 'driverId' | 'vehicleId' | 'vehicleNo' | 'jobCount'>,
  jobs: ReadonlyArray<Pick<Job, 'driverId' | 'status'>>,
): number {
  const fromStore = countDriverAssignedJobs(driver, jobs);
  const fromFirebase = driver.jobCount != null && !Number.isNaN(driver.jobCount) ? driver.jobCount : 0;
  return Math.max(fromStore, fromFirebase);
}

/** Trip lifecycle rank — higher = further along (used to resolve top vs current/ drift). */
const DRIVER_STATUS_RANK: Partial<Record<DriverStatus, number>> = {
  Away: 0,
  Available: 1,
  Offered: 2,
  Assigned: 2,
  Picking: 3,
  Arrived: 4,
  Busy: 4,
  Active: 5,
  OnTrip: 5,
};

function driverStatusRank(status: string): number {
  const s = String(status || '').trim() as DriverStatus;
  return DRIVER_STATUS_RANK[s] ?? (s === 'Suspended' || s === 'Clearing' ? -1 : 1);
}

function resolveDriverPresenceStatus(
  topRaw: string,
  currentRaw: string,
): DriverStatus {
  const top = String(topRaw || 'Away').trim() as DriverStatus;
  const cur = String(currentRaw || '').trim() as DriverStatus;

  // Offer-clear used to write Away only on current/ while parent stayed Available.
  // Prefer parent Available when current is Away (no intentional dual Away write).
  if (top === 'Available' && cur === 'Away') {
    return 'Available';
  }

  // Stale top-level Available with a live trip state on current/.
  if (
    top === 'Available' &&
    (cur === 'Picking' || cur === 'Arrived' || cur === 'Active' || cur === 'Assigned')
  ) {
    return cur;
  }

  // current/ often updates first (driver app); top-level can lag at Arrived after On Board.
  if (cur && driverStatusRank(cur) > driverStatusRank(top) && driverStatusRank(cur) >= driverStatusRank('Assigned')) {
    return cur;
  }

  return top;
}

const TRIP_DRIVER_STATUSES = new Set<DriverStatus>([
  'Picking',
  'Arrived',
  'Active',
  'OnTrip',
  'Busy',
  'Assigned',
]);

function pendingOfferBookingId(
  rec: Record<string, unknown>,
  current: Record<string, unknown>,
): string | null {
  const raw = current.joboffer ?? rec.joboffer;
  if (raw == null) return null;
  const id = String(raw).trim();
  if (!id || id === '0') return null;
  return id;
}

export function resolveDriverStatusFromPresence(
  rec: Record<string, unknown>,
  current: Record<string, unknown>,
): DriverStatus {
  const topStatus = String(rec.vehiclestatus ?? current.vehiclestatus ?? 'Away');
  const curStatus = String(current.vehiclestatus ?? '').trim();
  let status = resolveDriverPresenceStatus(topStatus, curStatus);

  const offerId = pendingOfferBookingId(rec, current);
  if (
    offerId &&
    status !== 'Away' &&
    status !== 'Suspended' &&
    !TRIP_DRIVER_STATUSES.has(status)
  ) {
    return 'Offered';
  }

  if (status === 'Offered' && !offerId) {
    return 'Available';
  }

  return status;
}

export interface Driver {
  driverId: string;
  vehicleId: string;
  driverName: string;
  vehicleNo: string;
  vehicleType?: string;
  /** Passenger seat capacity for this vehicle (default 4). */
  seatCapacity?: number;
  status: DriverStatus;
  lat?: number;
  lng?: number;
  zoneName?: string;
  zoneQueue?: number;
  jobCount?: number;
  bookingId?: string;
  jobPickup?: string;
  jobDropoff?: string;
  passengerName?: string;
  passengerPhone?: string;
  services?: string[];
  lastSeen?: number;
  isOffline?: boolean;
  isShared?: boolean;
  homeCompanyId?: string;
  /** Live meter from online/{cid}/{vid}/current while on trip. */
  liveFare?: number;
  liveTariffName?: string;
  liveJobId?: string;
  liveDistanceKm?: number;
  liveWaitingMin?: number;
  meterOnAt?: string;
}

const LOGGED_OUT_STATUSES = new Set([
  'offline',
  'loggedout',
  'logoff',
  'inactive',
]);

function resolveOnlineDriverId(
  rec: Record<string, unknown>,
  current: Record<string, unknown>,
): string {
  return String(
    rec.driverid ?? rec.driverId ?? rec.DriverId ?? current.driverId ?? current.driverid ?? current.DriverId ?? '',
  ).trim();
}

function resolveOnlineDriverName(
  rec: Record<string, unknown>,
  current: Record<string, unknown>,
): string {
  return String(
    rec.drivername ?? rec.driverName ?? rec.DriverName ?? current.drivername ?? current.driverName ?? '',
  ).trim();
}

function pickNum(...vals: unknown[]): number | undefined {
  for (const v of vals) {
    if (v == null || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return undefined;
}

function pickStr(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return undefined;
}

export function parseLiveMeterFromRecord(
  rec: Record<string, unknown>,
  current: Record<string, unknown>,
): {
  liveFare?: number;
  liveTariffName?: string;
  liveTariffId?: string;
  liveJobId?: string;
  liveDistanceKm?: number;
  liveWaitingMin?: number;
  meterOnAt?: string;
  fareInvalidatedAt?: number;
} {
  const fareInvalidatedAt = pickNum(
    current.tariffChangedAt,
    current.fareChangedAt,
    current.fareInvalidatedAt,
  );
  const liveFareRaw = pickNum(
    current.fare,
    current.meterFare,
    current.TotalFare,
    current.totalFare,
    current.jobfare,
    current.jobFare,
    current.Fare,
  );
  const liveFare = fareInvalidatedAt != null && liveFareRaw == null ? undefined : liveFareRaw;
  const liveTariffName = pickStr(
    current.currentTariffName,
    current.CurrentTariffName,
    current.TariffName,
    current.tariffName,
    current.TarriffType,
    current.tarriffname,
  );
  const liveTariffId = pickStr(
    current.tariffId,
    current.TariffId,
    current.TarriffId,
  );
  const liveJobId = pickStr(
    current.currentJobId,
    current.jobId,
    current.bookingId,
    current.BookingId,
    rec.currentJobId,
    rec.jobId,
  );
  const liveDistanceKm = pickNum(
    current.distanceKm,
    current.JobDistance,
    current.jobDistance,
    current.distance,
    current.Distance,
  );
  const liveWaitingMin = pickNum(
    current.waitingMinutes,
    current.waitingMin,
    current.WaitingTime,
    current.waitingTime,
  );
  const meterOnAt = pickStr(current.meterOnAt, current.MeterOnAt);
  return {
    liveFare,
    liveTariffName,
    liveTariffId,
    liveJobId,
    liveDistanceKm,
    liveWaitingMin,
    meterOnAt,
    fareInvalidatedAt,
  };
}

/** Stray post-sign-out node: Available (or empty) with no bound driver identity. */
export function isGhostOnlineNode(
  rec: Record<string, unknown>,
  current: Record<string, unknown>,
): boolean {
  const driverId = resolveOnlineDriverId(rec, current);
  const driverName = resolveOnlineDriverName(rec, current);
  if (driverId || driverName) return false;

  const status = String(rec.vehiclestatus ?? rec.VehicleStatus ?? current.vehiclestatus ?? '').trim().toLowerCase();
  if (status === 'available') return true;

  const hasGps = !!(rec.lat || rec.lng || current.lat || current.lng || rec.Lat || current.Lat);
  const lastSeenRaw = rec.lastSeen ?? current.lastSeen;
  if (!hasGps && (lastSeenRaw == null || lastSeenRaw === '' || Number(lastSeenRaw) === 0)) {
    return true;
  }
  return false;
}

/** True when Firebase online/{cid}/{vid} represents a signed-out / ended shift driver. */
export function isLoggedOutOnlineNode(
  rec: Record<string, unknown>,
  current: Record<string, unknown>,
): boolean {
  const statuses = [
    rec.vehiclestatus,
    rec.VehicleStatus,
    rec.status,
    current.vehiclestatus,
    current.VehicleStatus,
    current.currentstatus,
    current.status,
  ];
  for (const raw of statuses) {
    const s = String(raw ?? '').trim().toLowerCase();
    if (s && LOGGED_OUT_STATUSES.has(s)) return true;
  }
  if (rec.online === false && current.online === false) return true;
  if (rec.shiftStarted === false && current.shiftStarted === false) {
    const hasLiveTrip =
      !!(current.currentJobId || current.jobId || rec.currentJobId || rec.jobId);
    if (!hasLiveTrip) return true;
  }
  return false;
}

export function driverFromFirebase(
  vehicleId: string,
  rec: Record<string, unknown>,
  companyId: string
): Driver | null {
  const current = (rec.current as Record<string, unknown>) || {};
  if (isLoggedOutOnlineNode(rec, current) || isGhostOnlineNode(rec, current)) return null;
  const status = resolveDriverStatusFromPresence(rec, current);
  const rawBookingRef = rec.BookingId ?? current.bookingId ?? current.joboffer ?? rec.joboffer;
  const hasBookingRef =
    rawBookingRef != null &&
    String(rawBookingRef).trim() !== '' &&
    String(rawBookingRef) !== '0';
  const displayName = String(
    rec.drivername ?? rec.driverName ?? current.drivername ?? current.driverName ?? '',
  ).trim();
  const rawVehicleNo = String(rec.vehiclenumber ?? rec.vehicleNo ?? vehicleId);
  const vehicleNo = /^DD\d+$/i.test(rawVehicleNo) ? rawVehicleNo.slice(1) : rawVehicleNo;
  const liveMeter = parseLiveMeterFromRecord(rec, current);
  const hasActiveTrip =
    status === 'Picking' ||
    status === 'Assigned' ||
    status === 'Arrived' ||
    status === 'Active' ||
    status === 'OnTrip' ||
    status === 'Busy';
  let jobCount = rec.jobCount != null ? Number(rec.jobCount) : undefined;
  if (hasActiveTrip && hasBookingRef && (jobCount == null || Number.isNaN(jobCount) || jobCount < 1)) {
    jobCount = 1;
  }
  return {
    driverId: String(rec.driverid ?? rec.driverId ?? current.driverId ?? current.driverid ?? ''),
    vehicleId,
    driverName: displayName || `Driver ${vehicleNo}`,
    vehicleNo,
    vehicleType: String(rec.vehicletype ?? rec.vehicleType ?? 'Sedan'),
    seatCapacity: (() => {
      const raw = rec.seatCapacity ?? rec.seats ?? rec.capacity ?? rec.SeatCapacity ?? rec.Capacity;
      if (raw == null || raw === '') return 4;
      const n = parseInt(String(raw), 10);
      return Number.isNaN(n) || n < 1 ? 4 : n;
    })(),
    status,
    lat: rec.lat != null ? Number(rec.lat) : current.lat != null ? Number(current.lat) : undefined,
    lng: rec.lng != null ? Number(rec.lng) : current.lng != null ? Number(current.lng) : undefined,
    zoneName: String(rec.zonename ?? rec.zoneName ?? current.zonename ?? ''),
    zoneQueue: current.zonequeue != null ? Number(current.zonequeue) : undefined,
    jobCount,
    bookingId:
      status === 'Away' || !hasBookingRef ? '' : String(rawBookingRef),
    jobPickup: status === 'Away' ? '' : String(rec.jobpickup ?? current.jobpickup ?? ''),
    jobDropoff: status === 'Away' ? '' : String(rec.jobdropoff ?? current.jobdropoff ?? ''),
    passengerName: String(rec.jobname ?? current.jobname ?? ''),
    passengerPhone: String(rec.JobphoneNo ?? current.JobphoneNo ?? ''),
    services: Array.isArray(rec.allowedServices)
      ? (rec.allowedServices as string[])
      : ['Taxi'],
    // Freshest real lastSeen wins: parent can lag behind /current after a
    // reconnect, and a stale parent value must not mask a live heartbeat.
    // Do not invent Date.now() — that hides staleness.
    lastSeen: (() => {
      let best = 0;
      for (const raw of [rec.lastSeen, current.lastSeen]) {
        if (raw == null || raw === '') continue;
        const n = Number(raw);
        if (!Number.isFinite(n) || n <= 0) continue;
        const ms = n < 1e12 ? n * 1000 : n;
        if (ms > best) best = ms;
      }
      return best > 0 ? best : undefined;
    })(),
    ...liveMeter,
  };
}

export function statusColor(status: DriverStatus): string {
  switch (status) {
    case 'Available': return '#22c55e';
    case 'Offered': return '#eab308';
    case 'Picking':
    case 'Assigned': return '#3b82f6';
    case 'Arrived': return '#8b5cf6';
    case 'Active':
    case 'OnTrip': return '#f59e0b';
    case 'Busy': return '#f97316';
    case 'Suspended': return '#ef4444';
    default: return '#64748b';
  }
}

/** Only Available drivers receive a numbered slot in the zone queue. */
export function isZoneQueueRanked(status: string): boolean {
  return String(status || '').trim() === 'Available';
}

const ZONE_QUEUE_INACTIVE = new Set<DriverStatus>([
  'Away',
  'Busy',
  'Active',
  'OnTrip',
  'Picking',
  'Assigned',
  'Arrived',
  'Offered',
  'Clearing',
]);

/**
 * Zone queue vehicle colour — aligned with statusColor() buckets.
 * Pass connectivityStale to match DriverRow amber overlay (30s lastSeen).
 */
export function zoneQueueVehicleColorClass(
  status: string,
  opts?: { connectivityStale?: boolean },
): string {
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

export function isZoneQueueInactive(status: string): boolean {
  const s = String(status || '').trim() as DriverStatus;
  if (isZoneQueueRanked(s)) return false;
  return ZONE_QUEUE_INACTIVE.has(s) || s === 'Suspended';
}
