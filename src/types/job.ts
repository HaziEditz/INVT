export type JobStatus =
  | 'No One'
  | 'Pending'
  | 'Offered'
  | 'Assigned'
  | 'Picking'
  | 'Arrived'
  | 'Active'
  | 'OnTrip'
  | 'Queued'
  | 'Scheduled'
  | 'Completed'
  | 'Cancelled'
  | 'No Show';

export type ServiceType = 'taxi' | 'food' | 'freight' | 'tm' | 'acc' | 'rental';

export type BookingSource =
  | 'dispatch'
  | 'hail'
  | 'passenger'
  | 'web'
  | 'phone'
  | 'website';

export interface JobStop {
  address: string;
  lat: number;
  lng: number;
}

export interface TmDetails {
  cardNumber?: string;
  cardExpiry?: string;
  councilPercent?: number;
  capAmount?: number;
  hoistQty?: number;
  hoistUnitCost?: number;
  councilPays?: number;
  passengerPays?: number;
}

export interface AccDetails {
  claimNumber?: string;
  poNumber?: string;
  clientId?: string;
  clientName?: string;
  approvalId?: string;
}

export interface Job {
  id: number;
  companyId: string;
  status: JobStatus;
  source: BookingSource;
  serviceType: ServiceType;
  pickAddress: string;
  pickLatLng: string;
  dropAddress: string;
  dropLatLng: string;
  stops?: JobStop[];
  passengerName: string;
  passengerPhone: string;
  paymentType: string;
  estimatedFare: string;
  totalFare?: string;
  driverId?: string;
  vehicleId?: string;
  driverName?: string;
  vehicleNo?: string;
  bookingDateTime: string;
  scheduledFor?: number;
  dispatchBeforeMinutes?: number;
  notifyDispatchAt?: string;
  offeredAt?: number;
  originalStatus?: JobStatus;
  urgent?: boolean;
  corner?: boolean;
  notes?: string;
  accountId?: string;
  accountName?: string;
  tm?: TmDetails;
  acc?: AccDetails;
  tariffId?: string;
  passengers?: number;
  bags?: number;
  wheelchairs?: number;
  vehiclesRequired?: number;
  vehicleType?: string;
  queuedForDriverId?: string;
  updateSeq?: number;
  createdAt?: number;
  completedAt?: number;
  dispatcherName?: string;
  timeline?: JobTimelineEvent[];
}

export interface JobTimelineEvent {
  at: string;
  label: string;
  actor?: string;
}

export type JobTab = 'ua' | 'offer' | 'assign' | 'active' | 'queue' | 'dy';

export function parseLatLng(raw?: string): { lat: number; lng: number } | null {
  if (!raw) return null;
  const p = raw.split(',');
  if (p.length !== 2) return null;
  const lat = parseFloat(p[0]);
  const lng = parseFloat(p[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

export function jobFromFirebase(key: string, rec: Record<string, unknown>, companyId: string): Job | null {
  const id = parseInt(String(rec.BookingId ?? rec.bookingId ?? key), 10);
  if (!id) return null;
  const status = resolveJobStatus(rec);
  const srcRaw = String(rec.BookingSource ?? rec.source ?? rec.bookingSource ?? 'dispatch');
  const svc = String(rec.serviceType ?? rec.ServiceType ?? 'taxi').toLowerCase() as ServiceType;
  return {
    id,
    companyId,
    status,
    source: normalizeSource(srcRaw),
    serviceType: svc,
    pickAddress: String(rec.PickAddress ?? rec.pickup ?? rec.pickupAddress ?? ''),
    pickLatLng: String(rec.PickLatLng ?? (rec.pickupLat != null ? `${rec.pickupLat},${rec.pickupLng}` : '')),
    dropAddress: String(rec.DropAddress ?? rec.dropoff ?? rec.dropAddress ?? ''),
    dropLatLng: String(rec.DropLatLng ?? (rec.dropLat != null ? `${rec.dropLat},${rec.dropLng}` : '')),
    passengerName: String(rec.Name ?? rec.passengerName ?? ''),
    passengerPhone: String(rec.PhoneNo ?? rec.passengerPhone ?? ''),
    paymentType: String(rec.PaymentMethod ?? rec.paymentType ?? 'Cash'),
    estimatedFare: String(rec.EstimatedFare ?? rec.Fare ?? rec.fare ?? ''),
    totalFare: rec.TotalFare != null ? String(rec.TotalFare) : undefined,
    driverId: rec.DriverId != null ? String(rec.DriverId) : rec.driverId != null ? String(rec.driverId) : undefined,
    vehicleId: rec.VehicleId != null ? String(rec.VehicleId) : rec.vehicleId != null ? String(rec.vehicleId) : undefined,
    vehicleNo: String(rec.VehicleNo ?? rec.CallSign ?? rec.vehicleId ?? ''),
    bookingDateTime: String(
      rec.BookingDateTime ??
        rec.Pickingtime ??
        rec.PickingTime ??
        rec.pickingTime ??
        (typeof rec.createdAt === 'number'
          ? new Date(rec.createdAt).toISOString()
          : rec.createdAt ?? new Date().toISOString())
    ),
    scheduledFor: rec.ScheduledFor ? Number(rec.ScheduledFor) : undefined,
    dispatchBeforeMinutes: parseInt(String(rec.DispatchTimebefore ?? '0'), 10) || 0,
    notifyDispatchAt: rec.NotifyDispatchAt ? String(rec.NotifyDispatchAt) : undefined,
    offeredAt: rec.offeredAt ? Number(rec.offeredAt) : undefined,
    originalStatus: rec.originalStatus ? String(rec.originalStatus) as JobStatus : undefined,
    urgent: rec.Urgent === 'Yes' || rec.urgent === true,
    notes: String(rec.Notes ?? rec.notes ?? ''),
    accountId: rec.Account_id ? String(rec.Account_id) : undefined,
    accountName: rec.Account_Name ? String(rec.Account_Name) : undefined,
    tariffId: rec.TariffId ? String(rec.TariffId) : undefined,
    passengers: parseInt(String(rec.Passengers ?? '1'), 10) || 1,
    updateSeq: parseInt(String(rec.updateSeq ?? '0'), 10) || 0,
    createdAt: rec.createdAt ? Number(rec.createdAt) : undefined,
    dispatcherName: String(rec.DispatcherName ?? rec.dispatcherName ?? ''),
  };
}

export function normalizeJobStatus(raw: string): JobStatus {
  const s = String(raw || '').trim();
  if (s === 'NoOne' || s === 'no_one' || s === 'NO ONE') return 'No One';
  if (s === 'pending' || s === 'PENDING') return 'Pending';
  return s as JobStatus;
}

/** Single UA status badge — Pending OR No One, never both. */
export function uaStatusBadge(job: Job): { label: string; color: string; bg: string } | null {
  const st = normalizeJobStatus(job.status);
  if (st === 'No One') return { label: 'NO ONE', color: '#94a3b8', bg: 'rgba(100,116,139,0.2)' };
  if (st === 'Pending') return { label: 'PENDING', color: '#5b7cfa', bg: 'rgba(79,110,247,0.2)' };
  return null;
}

function normalizeSource(raw: string): BookingSource {
  const s = raw.toLowerCase();
  if (s.includes('dispatch') || s === 'phone' || s.includes('console')) return 'dispatch';
  if (s.includes('hail')) return 'hail';
  if (s.includes('passenger') || s === 'app') return 'passenger';
  if (s.includes('web') || s.includes('website')) return 'web';
  return 'dispatch';
}

function resolveJobStatus(rec: Record<string, unknown>): JobStatus {
  const booking = rec.BookingStatus != null ? normalizeJobStatus(String(rec.BookingStatus)) : null;
  const status = rec.Status != null || rec.status != null
    ? normalizeJobStatus(String(rec.Status ?? rec.status))
    : null;
  if (booking) return booking;
  if (status) return status;
  return 'Pending';
}

export function isScheduledJob(job: Job): boolean {
  if (job.dispatchBeforeMinutes && job.dispatchBeforeMinutes > 0) return true;
  if (job.scheduledFor && job.scheduledFor > Date.now() + 60000) return true;
  try {
    const d = new Date(job.bookingDateTime);
    return !Number.isNaN(d.getTime()) && d.getTime() > Date.now() + 60000;
  } catch {
    return false;
  }
}

export function jobCardBorderColor(job: Job): string {
  if (job.urgent) return '#ef4444';
  if (isScheduledJob(job)) return '#f59e0b';
  const st = normalizeJobStatus(job.status);
  if (st === 'No One') return '#64748b';
  if (st === 'Pending') return '#4f6ef7';
  return '#4f6ef7';
}

export function statusBadgeStyle(status: JobStatus): { label: string; color: string; bg: string } | null {
  const st = normalizeJobStatus(status);
  if (st === 'No One') return { label: 'NO ONE', color: '#94a3b8', bg: 'rgba(100,116,139,0.2)' };
  if (st === 'Pending') return { label: 'PENDING', color: '#5b7cfa', bg: 'rgba(79,110,247,0.2)' };
  if (st === 'Scheduled') return { label: 'SCHEDULED', color: '#f59e0b', bg: 'rgba(245,158,11,0.2)' };
  return null;
}

export function jobTabForStatus(job: Job): JobTab {
  if (job.serviceType === 'food' || job.serviceType === 'freight') return 'dy';
  const st = normalizeJobStatus(job.status);
  if (st === 'Queued') return 'queue';
  if (st === 'Active' || st === 'OnTrip') return 'active';
  if (st === 'Assigned' || st === 'Picking' || st === 'Arrived') return 'assign';
  if (st === 'Offered') return 'offer';
  return 'ua';
}
