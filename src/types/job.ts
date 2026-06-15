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
  tariffName?: string;
  passengerEmail?: string;
  isFixedPrice?: boolean;
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
  returnReason?: string;
  bookingType?: string;
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

export function jobUpdateSeqFromRecord(rec: Record<string, unknown>): number {
  const raw = rec._seq ?? rec.version ?? rec.updateSeq ?? 0;
  return parseInt(String(raw), 10) || 0;
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
    estimatedFare: String(rec.EstimatedFare ?? rec.CustomeRate ?? rec.CustomRate ?? rec.RideCost ?? rec.Fare ?? rec.fare ?? ''),
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
    tariffId: (() => {
      const id = rec.TarriffId ?? rec.TariffId ?? rec.tariffId;
      return id != null && String(id) !== '' ? String(id) : undefined;
    })(),
    tariffName: String(rec.TarriffName ?? rec.TariffName ?? rec.TarriffType ?? rec.tariffName ?? '').trim() || undefined,
    vehicleType: String(rec.VehicleType ?? rec.vehicleType ?? '').trim() || undefined,
    passengerEmail: String(rec.useremail ?? rec.Email ?? rec.email ?? '').trim() || undefined,
    isFixedPrice: (() => {
      const tid = String(rec.TarriffId ?? rec.TariffId ?? rec.tariffId ?? '');
      const tname = String(rec.TarriffName ?? rec.TariffName ?? '').toLowerCase();
      return tid === '-1' || tname === 'fixed';
    })(),
    passengers: parseInt(String(rec.Passengers ?? '1'), 10) || 1,
    updateSeq: jobUpdateSeqFromRecord(rec),
    createdAt: (() => {
      if (rec.createdAt != null) {
        const n = Number(rec.createdAt);
        if (!Number.isNaN(n) && n > 0) return n;
      }
      const ca = rec.CreatedAt;
      if (ca != null) {
        const ms = typeof ca === 'number' ? ca : Date.parse(String(ca));
        if (!Number.isNaN(ms) && ms > 0) return ms;
      }
      return undefined;
    })(),
    dispatcherName: String(rec.DispatcherName ?? rec.dispatcherName ?? ''),
    returnReason: String(rec.returnReason ?? rec.ReturnReason ?? '').trim() || undefined,
    bookingType: String(rec.bookingType ?? rec.BookingType ?? '').trim() || undefined,
    cancelledBy: String(rec.CancelledBy ?? rec.cancelledBy ?? ''),
    cancelledAt: String(rec.CancelledAt ?? rec.cancelledAt ?? ''),
    cancelReason: String(rec.CancelReason ?? rec.cancelReason ?? ''),
  };
}

export function normalizeJobStatus(raw: string): JobStatus {
  const s = String(raw || '').trim();
  if (s === 'NoOne' || s === 'no_one' || s === 'NO ONE') return 'No One';
  if (s === 'pending' || s === 'PENDING') return 'Pending';
  if (s === 'OnBoard' || s === 'onboard' || s === 'On Board') return 'Active';
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

/** Map a Firebase pendingjobs/allbookings record to the dispatch tab status. */
export function jobStatusFromFirebaseRecord(rec: Record<string, unknown>): JobStatus {
  return resolveJobStatus(rec);
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

  // BookingStatus is authoritative once a job is offered/assigned — stale root Status
  // (e.g. Pending left from pool create) must not hide Assigned on the Assign tab.
  const LIVE_BOOKING: JobStatus[] = [
    'Offered',
    'Queued',
    'Assigned',
    'Picking',
    'Arrived',
    'Active',
    'OnTrip',
    'Busy',
  ];
  if (booking && LIVE_BOOKING.includes(booking)) return booking;

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
  const drv = String(job.driverId ?? '').trim();
  const hasRealDriver = drv !== '' && drv !== '0' && drv !== '-1' && drv !== '-2';
  if (hasRealDriver) return false;
  const st = normalizeJobStatus(job.status);
  return st === 'Pending' || st === 'No One' || st === 'Scheduled';
}

/** Pre-booked / scheduled — not an immediate ASAP pickup. */
export function isPreBookedJob(job: Job, now = new Date()): boolean {
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
  borderColor?: string;
  foregroundColor?: string;
  foregroundMuted?: string;
  flash: boolean;
  label: string | null;
  tone?: 'blue' | 'pink';
}

/** U-A / tab card palette */
const CARD_PINK_BG = '#F7C1C1';
const CARD_PINK_BORDER = '#E24B4A';
const CARD_PINK_TEXT = '#2C2C2A';

const CARD_BLUE_WAIT_BG = '#E6F1FB';
const CARD_BLUE_WAIT_BORDER = '#85B7EB';
const CARD_BLUE_TEXT = '#042C53';
const CARD_BLUE_TEXT_MUTED = '#0C447C';

const CARD_ASSIGN_TINT = 'rgba(79, 110, 247, 0.18)';
const CARD_ACTIVE_TINT = 'rgba(239, 68, 68, 0.14)';

/** Card background/border for dispatch console — use inline styles to beat .bw-card-static. */
export function getJobCardAppearance(job: Job, tab: JobTab, now = new Date()): JobCardAppearance {
  if (tab === 'active') {
    return {
      backgroundColor: CARD_ACTIVE_TINT,
      borderLeftColor: '#ef4444',
      flash: false,
      label: null,
    };
  }

  if (tab === 'assign') {
    return {
      backgroundColor: CARD_ASSIGN_TINT,
      borderLeftColor: '#4f6ef7',
      flash: false,
      label: null,
    };
  }

  if (tab === 'ua' && isUnassignedForDispatch(job)) {
    if (!isPreBookedJob(job, now)) {
      return {
        backgroundColor: CARD_PINK_BG,
        borderLeftColor: CARD_PINK_BORDER,
        borderColor: CARD_PINK_BORDER,
        foregroundColor: CARD_PINK_TEXT,
        foregroundMuted: CARD_PINK_TEXT,
        tone: 'pink',
        flash: false,
        label: null,
      };
    }

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
          backgroundColor: CARD_PINK_BG,
          borderLeftColor: CARD_PINK_BORDER,
          borderColor: CARD_PINK_BORDER,
          foregroundColor: CARD_PINK_TEXT,
          foregroundMuted: CARD_PINK_TEXT,
          tone: 'pink',
          flash: true,
          label: 'DISPATCH NOW',
        };
      }
      if (isScheduledJob(job)) {
        return {
          backgroundColor: CARD_BLUE_WAIT_BG,
          borderLeftColor: CARD_BLUE_WAIT_BORDER,
          borderColor: CARD_BLUE_WAIT_BORDER,
          foregroundColor: CARD_BLUE_TEXT,
          foregroundMuted: CARD_BLUE_TEXT_MUTED,
          tone: 'blue',
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
      flash: appearance.flash,
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

/** True while a pre-booked job is still before its dispatch window opens. */
export function isPreDispatchWindow(job: Job, now = new Date()): boolean {
  const dispatchAt = jobDispatchTime(job);
  if (!dispatchAt) return false;
  return now.getTime() < dispatchAt.getTime();
}

/** Message when dispatcher tries to assign before the dispatch window opens. */
export function preDispatchAssignBlockMessage(job: Job): string {
  const pickup = jobScheduledTime(job);
  const timeLabel = pickup
    ? pickup.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: false })
    : 'the scheduled time';
  return `This job is pre-booked for ${timeLabel}. To send it now, change it to 'Now' first.`;
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

/** When the job record was created in the system. */
export function jobCreatedAtTime(job: Job): Date | null {
  if (!job.createdAt) return null;
  const d = new Date(job.createdAt);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Booking / pickup datetime from the job record (not creation timestamp). */
export function jobBookingTime(job: Job): Date | null {
  return jobScheduledTime(job);
}

/** When the job was booked / entered the system. @deprecated use jobCreatedAtTime or jobBookingTime */
export function jobBookedAtTime(job: Job): Date | null {
  return jobCreatedAtTime(job) ?? jobBookingTime(job);
}

export function formatJobDateTimeShort(d: Date): string {
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (sameDay) return time;
  return d.toLocaleString('en-NZ', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Pickup label for UA cards — ASAP or Sched: HH:MM. */
export function jobPickupTypeLabel(job: Job): string {
  const preBooked =
    (job.dispatchBeforeMinutes ?? 0) > 0 ||
    !!job.notifyDispatchAt ||
    normalizeJobStatus(job.status) === 'Scheduled' ||
    (job.createdAt &&
      jobScheduledTime(job) &&
      jobScheduledTime(job)!.getTime() - job.createdAt > 60_000);

  if (!preBooked && job.bookingType?.toUpperCase() !== 'SCHEDULED') {
    return 'ASAP';
  }

  const pickup = jobScheduledTime(job);
  if (pickup) {
    const t = pickup.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `Sched: ${t}`;
  }
  return 'ASAP';
}

/** Minutes past dispatch window — null if not overdue. */
export function jobOverdueMinutes(job: Job, now = new Date()): number | null {
  const dispatchAt = jobDispatchTime(job);
  if (!dispatchAt) return null;
  const mins = Math.floor((now.getTime() - dispatchAt.getTime()) / 60_000);
  return mins > 0 ? mins : null;
}

export function jobOverdueLabel(job: Job, now = new Date()): string | null {
  const mins = jobOverdueMinutes(job, now);
  if (mins == null) return null;
  return mins === 1 ? 'Overdue 1 min' : `Overdue ${mins} min`;
}

export type JobReturnAlertKind = 'reject' | 'not_reached' | 'warning';

export function jobReturnReasonAlert(
  job: Job
): { kind: JobReturnAlertKind; text: string } | null {
  const r = (job.returnReason || '').trim();
  if (!r) return null;
  const lower = r.toLowerCase();
  if (lower.includes('reject') || lower.includes('declined')) {
    return { kind: 'reject', text: r };
  }
  if (
    lower.includes('network') ||
    lower.includes('no response') ||
    lower.includes('timeout') ||
    lower.includes('unreached') ||
    lower.includes('not reached') ||
    lower.includes('no-response')
  ) {
    return { kind: 'not_reached', text: r };
  }
  return { kind: 'warning', text: r };
}

export function jobFareDisplay(job: Job): { label: string; amount: string } | null {
  const raw = (job.estimatedFare || job.totalFare || '').trim();
  if (!raw || raw === '0') return null;
  const amount = raw.startsWith('$') ? raw : `$${raw}`;
  const label = job.isFixedPrice ? 'Fixed Price' : 'Fare';
  return { label, amount };
}

export function jobTariffLabel(job: Job): string | null {
  const name = (job.tariffName || '').trim();
  if (name && name.toLowerCase() !== 'automatic') return name;
  if (job.tariffId && job.tariffId !== '0' && job.tariffId !== '-1') return `Tariff #${job.tariffId}`;
  if (job.isFixedPrice) return 'Fixed';
  return job.tariffId === '0' ? 'Automatic' : null;
}

export function jobVehicleTypeLabel(job: Job): string | null {
  const v = (job.vehicleType || '').trim();
  if (!v || v.toLowerCase() === 'not specified') return null;
  return v;
}
