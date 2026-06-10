export type DriverStatus =
  | 'Available'
  | 'Picking'
  | 'Busy'
  | 'Active'
  | 'OnTrip'
  | 'Away'
  | 'Assigned'
  | 'Clearing'
  | 'Suspended';

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
  const status = String(rec.vehiclestatus ?? current.vehiclestatus ?? 'Away') as DriverStatus;
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
    bookingId: String(rec.BookingId ?? current.bookingId ?? current.joboffer ?? ''),
    jobPickup: String(rec.jobpickup ?? current.jobpickup ?? ''),
    jobDropoff: String(rec.jobdropoff ?? current.jobdropoff ?? ''),
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
    case 'Picking': return '#3b82f6';
    case 'Active':
    case 'OnTrip': return '#f59e0b';
    case 'Busy':
    case 'Assigned': return '#f97316';
    case 'Suspended': return '#ef4444';
    default: return '#64748b';
  }
}
