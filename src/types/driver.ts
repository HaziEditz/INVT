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

  // Stale top-level Available with a live current/ subnode (offer-timeout recovery).
  if (
    top === 'Available' &&
    (cur === 'Away' || cur === 'Picking' || cur === 'Arrived' || cur === 'Active' || cur === 'Assigned')
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

function resolveDriverStatusFromPresence(
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
  liveJobId?: string;
  liveDistanceKm?: number;
  liveWaitingMin?: number;
  meterOnAt?: string;
} {
  const liveFare = pickNum(
    current.fare,
    current.meterFare,
    current.TotalFare,
    current.totalFare,
    current.jobfare,
    current.jobFare,
    current.Fare,
  );
  const liveTariffName = pickStr(
    current.currentTariffName,
    current.CurrentTariffName,
    current.TariffName,
    current.tariffName,
    current.TarriffType,
    current.tarriffname,
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
  return { liveFare, liveTariffName, liveJobId, liveDistanceKm, liveWaitingMin, meterOnAt };
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
  const liveMeter = parseLiveMeterFromRecord(rec, current);
  return {
    driverId: String(rec.driverid ?? rec.driverId ?? current.driverId ?? current.driverid ?? ''),
    vehicleId,
    driverName: displayName || `Driver ${vehicleId}`,
    vehicleNo: String(rec.vehiclenumber ?? rec.vehicleNo ?? vehicleId),
    vehicleType: String(rec.vehicletype ?? rec.vehicleType ?? 'Sedan'),
    seatCapacity: (() => {
      const raw = rec.seatCapacity ?? rec.seats ?? rec.capacity ?? rec.SeatCapacity ?? rec.Capacity;
      if (raw == null || raw === '') return 4;
      const n = parseInt(String(raw), 10);
      return Number.isNaN(n) || n < 1 ? 4 : n;
    })(),
    status,
    lat: rec.lat != null ? Number(rec.lat) : undefined,
    lng: rec.lng != null ? Number(rec.lng) : undefined,
    zoneName: String(rec.zonename ?? rec.zoneName ?? current.zonename ?? ''),
    zoneQueue: current.zonequeue != null ? Number(current.zonequeue) : undefined,
    jobCount: rec.jobCount != null ? Number(rec.jobCount) : undefined,
    bookingId:
      status === 'Away' || !hasBookingRef ? '' : String(rawBookingRef),
    jobPickup: status === 'Away' ? '' : String(rec.jobpickup ?? current.jobpickup ?? ''),
    jobDropoff: status === 'Away' ? '' : String(rec.jobdropoff ?? current.jobdropoff ?? ''),
    passengerName: String(rec.jobname ?? current.jobname ?? ''),
    passengerPhone: String(rec.JobphoneNo ?? current.JobphoneNo ?? ''),
    services: Array.isArray(rec.allowedServices)
      ? (rec.allowedServices as string[])
      : ['Taxi'],
    lastSeen: rec.lastSeen ? Number(rec.lastSeen) : Date.now(),
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
