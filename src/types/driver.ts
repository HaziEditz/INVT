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
}

const LOGGED_OUT_STATUSES = new Set([
  'offline',
  'loggedout',
  'logoff',
  'inactive',
]);

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
  if (isLoggedOutOnlineNode(rec, current)) return null;
  const status = resolveDriverStatusFromPresence(rec, current);
  const rawBookingRef = rec.BookingId ?? current.bookingId ?? current.joboffer ?? rec.joboffer;
  const hasBookingRef =
    rawBookingRef != null &&
    String(rawBookingRef).trim() !== '' &&
    String(rawBookingRef) !== '0';
  const displayName = String(
    rec.drivername ?? rec.driverName ?? current.drivername ?? current.driverName ?? '',
  ).trim();
  return {
    driverId: String(rec.driverid ?? rec.driverId ?? current.driverId ?? current.driverid ?? ''),
    vehicleId,
    driverName: displayName || `Driver ${vehicleId}`,
    vehicleNo: String(rec.vehiclenumber ?? rec.vehicleNo ?? vehicleId),
    vehicleType: String(rec.vehicletype ?? rec.vehicleType ?? 'Sedan'),
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
