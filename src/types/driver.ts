export type DriverStatus =
  | 'Available'
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

export function driverFromFirebase(
  vehicleId: string,
  rec: Record<string, unknown>,
  companyId: string
): Driver {
  const current = (rec.current as Record<string, unknown>) || {};
  const topStatus = String(rec.vehiclestatus ?? current.vehiclestatus ?? 'Away');
  const curStatus = String(current.vehiclestatus ?? '').trim();
  const status = resolveDriverPresenceStatus(topStatus, curStatus);
  return {
    driverId: String(rec.driverid ?? rec.driverId ?? current.driverId ?? ''),
    vehicleId,
    driverName: String(rec.drivername ?? rec.driverName ?? 'Driver'),
    vehicleNo: String(rec.vehiclenumber ?? rec.vehicleNo ?? vehicleId),
    vehicleType: String(rec.vehicletype ?? rec.vehicleType ?? 'Sedan'),
    status,
    lat: rec.lat != null ? Number(rec.lat) : undefined,
    lng: rec.lng != null ? Number(rec.lng) : undefined,
    zoneName: String(rec.zonename ?? rec.zoneName ?? current.zonename ?? ''),
    zoneQueue: current.zonequeue != null ? Number(current.zonequeue) : undefined,
    jobCount: rec.jobCount != null ? Number(rec.jobCount) : undefined,
    bookingId: status === 'Away' ? '' : String(rec.BookingId ?? current.bookingId ?? current.joboffer ?? ''),
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
