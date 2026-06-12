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
  cancelledBy?: string;
  cancelledAt?: string;
  cancelReason?: string;
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
    notes: (() => {
      const direct = String(rec.Notes ?? rec.notes ?? '').trim();
      if (direct) return direct;
      const entities = String(rec.EntitiesDetails ?? rec.entitiesDetails ?? '');
      if (!entities.trim()) return '';
      return entities
        .split('|')
        .map((s) => s.trim())
        .filter(
          (s) =>
            s &&
            !/^Payment:/i.test(s) &&
            !/^Ref:/i.test(s) &&
            !/^TM Card:/i.test(s) &&
            !/^TM Expiry:/i.test(s) &&
            !/^Council %:/i.test(s) &&
            !/^Passenger %:/i.test(s) &&
            !/^EFTPOS surcharge/i.test(s)
        )
        .join(' | ')
        .trim();
    })(),
    accountId: rec.Account_id ? String(rec.Account_id) : undefined,
    accountName: rec.Account_Name ? String(rec.Account_Name) : undefined,
    tariffId: rec.TariffId ? String(rec.TariffId) : undefined,
    passengers: parseInt(String(rec.Passengers ?? '1'), 10) || 1,
    updateSeq: parseInt(String(rec.updateSeq ?? '0'), 10) || 0,
    createdAt: rec.createdAt ? Number(rec.createdAt) : undefined,
    dispatcherName: String(rec.DispatcherName ?? rec.dispatcherName ?? ''),
    cancelledBy: String(rec.CancelledBy ?? rec.cancelledBy ?? ''),
    cancelledAt: String(rec.CancelledAt ?? rec.cancelledAt ?? ''),
    cancelReason: String(rec.CancelReason ?? rec.cancelReason ?? ''),
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
  const dId = rec.DriverId ?? rec.driverId ?? rec.DId;
  if (dId === -1 || dId === '-1') return 'No One';

  const booking = rec.BookingStatus != null ? normalizeJobStatus(String(rec.BookingStatus)) : null;
  const status =
    rec.Status != null || rec.status != null
      ? normalizeJobStatus(String(rec.Status ?? rec.status))
      : null;

  if (booking === 'No One' || status === 'No One') return 'No One';
  if (booking === 'Pending' || status === 'Pending') return 'Pending';
  if (booking) return booking;
  if (status) return status;
  return 'Pending';
}

export function isScheduledJob(job: Job): boolean {
  if ((job.dispatchBeforeMinutes ?? 0) > 0) return true;
  if (job.notifyDispatchAt) return true;
  const pickup = jobScheduledTime(job);
  if (pickup && pickup.getTime() > Date.now()) return true;
  return false;
}

/** Pickup / scheduled time for a job. */
export function jobScheduledTime(job: Job): Date | null {
  if (job.scheduledFor) {
    const d = new Date(job.scheduledFor);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const raw = job.bookingDateTime?.trim();
  if (!raw) return null;
  try {
    const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/** When the job should release to Pending / enter dispatch window. */
export function jobDispatchTime(job: Job): Date | null {
  const pickup = jobScheduledTime(job);
  if (!pickup) return null;
  if (job.notifyDispatchAt) {
    try {
      const d = new Date(job.notifyDispatchAt.includes('T') ? job.notifyDispatchAt : job.notifyDispatchAt.replace(' ', 'T'));
      if (!Number.isNaN(d.getTime())) return d;
    } catch {
      /* fall through */
    }
  }
  const mins = job.dispatchBeforeMinutes ?? 0;
  return new Date(pickup.getTime() - mins * 60_000);
}

function isUnassignedForDispatch(job: Job): boolean {
  if (job.driverId) return false;
  const st = normalizeJobStatus(job.status);
  return st === 'Pending' || st === 'No One' || st === 'Scheduled';
}

/** Pre-booked / scheduled — not an immediate ASAP pickup. */
function isPreBookedJob(job: Job, now = new Date()): boolean {
  if ((job.dispatchBeforeMinutes ?? 0) > 0) return true;
  if (job.notifyDispatchAt) return true;
  if (normalizeJobStatus(job.status) === 'Scheduled') return true;
  const pickup = jobScheduledTime(job);
  if (!pickup) return false;
  if (pickup.getTime() > now.getTime()) return true;
  if (job.createdAt && pickup.getTime() - job.createdAt > 60_000) return true;
  return false;
}

export type ScheduledDispatchState = 'before' | 'dispatch_now';

export interface JobCardAppearance {
  backgroundColor: string;
  borderLeftColor: string;
  foregroundColor?: string;
  flash: boolean;
  label: string | null;
}

const CARD_BLUE_SOLID = '#2563eb';
const CARD_BLUE_TINT = 'rgba(79, 110, 247, 0.32)';
const CARD_RED_SOLID = '#dc2626';
const CARD_RED_LIGHT = 'rgba(239, 68, 68, 0.28)';

/** Card background/border for dispatch console — use inline styles to beat .bw-card-static. */
export function getJobCardAppearance(job: Job, tab: JobTab, now = new Date()): JobCardAppearance {
  if (tab === 'active') {
    return {
      backgroundColor: CARD_RED_LIGHT,
      borderLeftColor: '#ef4444',
      flash: false,
      label: null,
    };
  }

  if (tab === 'assign') {
    return {
      backgroundColor: CARD_BLUE_TINT,
      borderLeftColor: '#4f6ef7',
      flash: false,
      label: null,
    };
  }

  if (tab === 'ua' && isUnassignedForDispatch(job)) {
    const pickup = jobScheduledTime(job);
    if (pickup) {
      const dispatchAt = jobDispatchTime(job) ?? pickup;
      const dispatchMs = dispatchAt.getTime();
      const pickLabel = pickup.toLocaleTimeString('en-NZ', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      if (now.getTime() >= dispatchMs) {
        return {
          backgroundColor: CARD_RED_SOLID,
          borderLeftColor: '#ef4444',
          foregroundColor: '#ffffff',
          flash: isPreBookedJob(job, now),
          label: 'DISPATCH NOW',
        };
      }
      if (isScheduledJob(job)) {
        return {
          backgroundColor: CARD_BLUE_SOLID,
          borderLeftColor: '#4f6ef7',
          foregroundColor: '#ffffff',
          flash: false,
          label: `Sched: ${pickLabel}`,
        };
      }
    }
  }

  return {
    backgroundColor: 'var(--bw-card)',
    borderLeftColor: jobCardBorderColor(job),
    flash: false,
    label: null,
  };
}

/** @deprecated Use getJobCardAppearance */
export interface ScheduledDispatchUi {
  state: ScheduledDispatchState;
  label: string;
  borderColor: string;
  flash: boolean;
  missedBg: boolean;
}

export function getScheduledDispatchUi(job: Job, now = new Date()): ScheduledDispatchUi | null {
  const appearance = getJobCardAppearance(job, 'ua', now);
  if (appearance.label?.startsWith('Sched:')) {
    return {
      state: 'before',
      label: appearance.label,
      borderColor: appearance.borderLeftColor,
      flash: false,
      missedBg: false,
    };
  }
  if (appearance.label === 'DISPATCH NOW') {
    return {
      state: 'dispatch_now',
      label: appearance.label,
      borderColor: appearance.borderLeftColor,
      flash: true,
      missedBg: false,
    };
  }
  return null;
}

export function jobCardBorderColor(job: Job): string {
  if (job.urgent) return '#ef4444';
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
