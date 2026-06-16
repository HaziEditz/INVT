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
  driverAcceptedAt?: string;
  activeAt?: string;
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
  lastOfferDriverId?: string;
  lastOfferDriverName?: string;
  lastEditedAt?: string;
  lastEditedBy?: string;
  editHistory?: JobEditHistoryEntry[];
  bookingType?: string;
  timeline?: JobTimelineEvent[];
}

export interface JobTimelineEvent {
  at: string;
  label: string;
  actor?: string;
}

export interface JobEditHistoryEntry {
  at: string;
  atMs?: number;
  by: string;
  byName?: string;
  summary: string;
  changes?: Record<string, { from?: unknown; to?: unknown }>;
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
    driverName: String(rec.DriverName ?? rec.driverName ?? '').trim() || undefined,
    driverAcceptedAt: (() => {
      const raw = rec.DriverAcceptedAt ?? rec.driverAcceptedAt;
      return raw ? String(raw) : undefined;
    })(),
    activeAt: (() => {
      const raw = rec.ActiveAt ?? rec.activeAt;
      return raw ? String(raw) : undefined;
    })(),
    bookingDateTime: String(
      rec.BookingDateTime ??
        rec.Pickingtime ??
        rec.PickingTime ??
        rec.pickingTime ??
        ''
    ),
    scheduledFor: (() => {
      const raw = rec.ScheduledFor ?? rec.ScheduledForMs ?? rec.scheduledFor;
      const n = Number(raw);
      return n > 0 && !Number.isNaN(n) ? n : undefined;
    })(),
    dispatchBeforeMinutes: parseInt(String(rec.DispatchTimebefore ?? rec.Dispatchbefore ?? '0'), 10) || 0,
    notifyDispatchAt: (() => {
      const raw = rec.NotifyDispatchAt ?? rec.notifyDispatchAt;
      return raw ? String(raw) : undefined;
    })(),
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
    bags: (() => {
      const raw = rec.Bags ?? rec.bags ?? rec.NoOfBags ?? rec.noOfBags;
      if (raw == null || raw === '') return undefined;
      const n = parseInt(String(raw), 10);
      return Number.isNaN(n) ? undefined : n;
    })(),
    updateSeq: jobUpdateSeqFromRecord(rec),
    createdAt: (() => {
      if (rec.createdAt != null) {
        const n = Number(rec.createdAt);
        if (!Number.isNaN(n) && n > 0) return n;
      }
      for (const key of ['CreatedAt', 'bookedAt', 'BookedAt', 'bookingCreatedAt'] as const) {
        const raw = rec[key];
        if (raw == null) continue;
        const ms = typeof raw === 'number' ? raw : Date.parse(String(raw));
        if (!Number.isNaN(ms) && ms > 0) return ms;
      }
      return undefined;
    })(),
    dispatcherName: String(rec.DispatcherName ?? rec.dispatcherName ?? ''),
    returnReason: String(rec.returnReason ?? rec.ReturnReason ?? '').trim() || undefined,
    lastOfferDriverId: String(rec.lastOfferDriverId ?? rec.LastOfferDriverId ?? '').trim() || undefined,
    lastOfferDriverName:
      String(rec.lastOfferDriverName ?? rec.LastOfferDriverName ?? '').trim() || undefined,
    lastEditedAt: String(rec.lastEditedAt ?? rec.LastEditedAt ?? '').trim() || undefined,
    lastEditedBy: String(rec.lastEditedBy ?? rec.LastEditedBy ?? '').trim() || undefined,
    editHistory: parseJobEditHistory(rec.editHistory ?? rec.EditHistory),
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

  if (booking === 'Completed' || booking === 'Cancelled' || booking === 'No Show') return booking;
  if (status === 'Completed' || status === 'Cancelled' || status === 'No Show') return status as JobStatus;

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

/** Minutes before pickup when dispatch window opens — server default is 10 for pre-booked jobs. */
export function effectiveDispatchBeforeMinutes(job: Job): number {
  const explicit = job.dispatchBeforeMinutes ?? 0;
  if (explicit > 0) return explicit;
  if (job.notifyDispatchAt) return 10;
  if (job.scheduledFor && job.scheduledFor > 0) return 10;
  if (normalizeJobStatus(job.status) === 'Scheduled') return 10;
  return 0;
}

/** Pickup / scheduled time for a job. */
export function jobScheduledTime(job: Job): Date | null {
  if (job.scheduledFor && job.scheduledFor > 0) {
    const d = new Date(job.scheduledFor);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const raw = job.bookingDateTime?.trim();
  if (!raw) return null;
  try {
    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/** When the job should release to Pending / enter dispatch window. */
export function jobDispatchTime(job: Job): Date | null {
  if (job.notifyDispatchAt) {
    try {
      const raw = job.notifyDispatchAt.includes('T')
        ? job.notifyDispatchAt
        : job.notifyDispatchAt.replace(' ', 'T');
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) return d;
    } catch {
      /* fall through */
    }
  }
  const pickup = jobScheduledTime(job);
  if (!pickup) return null;
  const mins = effectiveDispatchBeforeMinutes(job);
  if (mins <= 0) return null;
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

  if (tab === 'offer') {
    return {
      backgroundColor: 'var(--bw-card)',
      borderLeftColor: '#f59e0b',
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
        const schedLabel = formatJobDateTimeCard(dispatchAt, { forceDate: true });
        return {
          backgroundColor: CARD_BLUE_WAIT_BG,
          borderLeftColor: CARD_BLUE_WAIT_BORDER,
          borderColor: CARD_BLUE_WAIT_BORDER,
          foregroundColor: CARD_BLUE_TEXT,
          foregroundMuted: CARD_BLUE_TEXT_MUTED,
          tone: 'blue',
          flash: false,
          label: `SCHED ${schedLabel}`,
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
  if (appearance.label?.startsWith('SCHED')) {
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

/** Customer-requested pickup datetime. */
export function jobPickupTime(job: Job): Date | null {
  return jobScheduledTime(job);
}

/** @deprecated Use jobPickupTime for pickup or jobCreatedAtTime for when the booking was created. */
export function jobBookingTime(job: Job): Date | null {
  return jobPickupTime(job);
}

/** When the job was booked / entered the system. */
export function jobBookedAtTime(job: Job): Date | null {
  return jobCreatedAtTime(job);
}

/** Card / modal datetime — includes date when not today or when the time is in the future. */
export function formatJobDateTimeCard(d: Date, opts?: { forceDate?: boolean }): string {
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (opts?.forceDate || !sameDay || d.getTime() > now.getTime() + 60_000) {
    return d.toLocaleString('en-NZ', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  return time;
}

/** Always show weekday + date + time — for prominent pickup / sched lines on Later cards. */
export function formatJobDateTimeProminent(d: Date): string {
  return formatJobDateTimeCard(d, { forceDate: true });
}

/** Compact card datetime — Today/Tmr/weekday + time. */
export function formatJobDateTimeCompact(d: Date, now = new Date()): string {
  const time = d.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: false });
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return `Today ${time}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();
  if (isTomorrow) return `Tmr ${time}`;

  const datePart = d.toLocaleDateString('en-NZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return `${datePart} ${time}`;
}

export function jobStatusAbbrev(status: JobStatus): { abbrev: string; dotColor: string } {
  const st = normalizeJobStatus(status);
  switch (st) {
    case 'No One':
      return { abbrev: 'NON', dotColor: '#94a3b8' };
    case 'Pending':
      return { abbrev: 'PND', dotColor: '#4f6ef7' };
    case 'Offered':
      return { abbrev: 'OFR', dotColor: '#f59e0b' };
    case 'Assigned':
      return { abbrev: 'ASN', dotColor: '#6366f1' };
    case 'Picking':
      return { abbrev: 'PIK', dotColor: '#6366f1' };
    case 'Arrived':
      return { abbrev: 'ARR', dotColor: '#6366f1' };
    case 'Active':
    case 'OnTrip':
      return { abbrev: 'ACT', dotColor: '#22c55e' };
    case 'Scheduled':
      return { abbrev: 'SCH', dotColor: '#0ea5e9' };
    case 'Queued':
      return { abbrev: 'QUE', dotColor: '#a855f7' };
    default:
      return { abbrev: st.slice(0, 3).toUpperCase(), dotColor: '#64748b' };
  }
}

export type JobTimerBadge = {
  text: string;
  variant: 'blue' | 'red' | 'amber' | 'green' | 'neutral';
};

export function jobTripStartTime(job: Job, tab: JobTab): Date | null {
  const parse = (raw?: string) => {
    if (!raw) return null;
    try {
      const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
      const d = new Date(normalized);
      return Number.isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  };
  if (tab === 'active') {
    return parse(job.activeAt) ?? parse(job.driverAcceptedAt);
  }
  if (tab === 'assign') {
    return parse(job.driverAcceptedAt) ?? (job.offeredAt ? new Date(job.offeredAt) : null);
  }
  return null;
}

export function jobGoTimeLabel(job: Job): string | null {
  const dispatchAt = jobDispatchTime(job);
  if (!dispatchAt) return null;
  const time = dispatchAt.toLocaleTimeString('en-NZ', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `Go ${time}`;
}

export function jobTimerBadge(job: Job, tab: JobTab, now = new Date()): JobTimerBadge | null {
  if (tab === 'offer' && job.offeredAt) {
    const expiresAt = job.offeredAt + 30_000;
    const secs = Math.max(0, Math.ceil((expiresAt - now.getTime()) / 1000));
    return { text: `expires ${secs}s`, variant: 'amber' };
  }

  if (tab === 'assign' || tab === 'active') {
    const tripStart = jobTripStartTime(job, tab);
    if (tripStart) {
      const mins = Math.max(0, Math.floor((now.getTime() - tripStart.getTime()) / 60_000));
      return { text: `on trip ${mins}m`, variant: 'green' };
    }
  }

  if (tab === 'ua') {
    const overdueMins = jobOverdueMinutes(job, now);
    if (overdueMins != null) {
      return { text: `overdue ${overdueMins}m`, variant: 'red' };
    }

    if (isPreBookedJob(job, now) && isPreDispatchWindow(job, now)) {
      const dispatchAt = jobDispatchTime(job);
      if (dispatchAt) {
        const ms = Math.max(0, dispatchAt.getTime() - now.getTime());
        const totalMins = Math.ceil(ms / 60_000);
        const hours = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        const countdown = hours > 0 ? `in ${hours}h ${mins}m` : `in ${mins}m`;
        return { text: countdown, variant: 'blue' };
      }
    }

    if (!isPreBookedJob(job, now)) {
      const created = jobCreatedAtTime(job);
      if (created) {
        const mins = Math.max(0, Math.floor((now.getTime() - created.getTime()) / 60_000));
        if (mins >= 1) return { text: `wait ${mins}m`, variant: 'neutral' };
      }
    }
  }

  return null;
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

function parseJobEditHistory(raw: unknown): JobEditHistoryEntry[] | undefined {
  if (!raw) return undefined;
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === 'object') list = Object.values(raw as Record<string, unknown>);
  const parsed = list
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const e = entry as Record<string, unknown>;
      const at = String(e.at ?? '').trim();
      const summary = String(e.summary ?? '').trim();
      if (!at && !summary) return null;
      return {
        at: at || new Date(Number(e.atMs) || Date.now()).toISOString(),
        atMs: e.atMs != null ? Number(e.atMs) : undefined,
        by: String(e.by ?? 'dispatcher'),
        byName: String(e.byName ?? e.by ?? '').trim() || undefined,
        summary: summary || 'Details updated',
        changes:
          e.changes && typeof e.changes === 'object'
            ? (e.changes as Record<string, { from?: unknown; to?: unknown }>)
            : undefined,
      } satisfies JobEditHistoryEntry;
    })
    .filter(Boolean) as JobEditHistoryEntry[];
  return parsed.length ? parsed.slice(-30) : undefined;
}

export function formatJobEditHistoryWhen(entry: JobEditHistoryEntry): string {
  try {
    const d = entry.atMs ? new Date(entry.atMs) : new Date(entry.at);
    if (Number.isNaN(d.getTime())) return entry.at;
    return formatJobDateTimeShort(d);
  } catch {
    return entry.at;
  }
}

/** Pickup label for UA card chips — ASAP or LATER (times shown in the card body). */
export function jobPickupTypeLabel(job: Job): string {
  if (!isPreBookedJob(job) && job.bookingType?.toUpperCase() !== 'SCHEDULED') {
    return 'ASAP';
  }
  return 'LATER';
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

type LastOfferDriverLookup = {
  driverId: string;
  vehicleNo?: string;
  vehicleId?: string;
  driverName?: string;
};

export function formatLastOfferDriverLabel(driverId: string, driverName?: string): string {
  const id = driverId.trim();
  if (!id) return (driverName || '').trim() || 'Driver';
  const name = (driverName || '').trim();
  const genericName = !name || name === id || /^driver\s+\S+$/i.test(name);
  if (name && !genericName) return `${id} (${name})`;
  return id;
}

export function resolveLastOfferDriverName(
  job: Job,
  drivers?: LastOfferDriverLookup[],
): string | undefined {
  const fromJob = job.lastOfferDriverName?.trim();
  if (fromJob) return fromJob;
  const id = (job.lastOfferDriverId || '').trim();
  if (!id || !drivers?.length) return undefined;
  const match = drivers.find(
    (d) => d.driverId === id || d.vehicleNo === id || d.vehicleId === id,
  );
  const name = match?.driverName?.trim();
  return name || undefined;
}

export function jobReturnReasonAlert(
  job: Job,
  driverName?: string,
): { kind: JobReturnAlertKind; text: string } | null {
  const driverId = (job.lastOfferDriverId || '').trim();
  const driver = driverId
    ? formatLastOfferDriverLabel(driverId, driverName || job.lastOfferDriverName)
    : '';
  const r = (job.returnReason || '').trim();
  if (!r && !driver) return null;
  const lower = r.toLowerCase();

  if (driver) {
    if (lower.includes('declined') || lower.includes('reject')) {
      return { kind: 'reject', text: `Rejected by ${driver}` };
    }
    if (
      lower.includes('timeout') ||
      lower.includes('no response') ||
      lower.includes('unreached') ||
      lower.includes('not reached') ||
      lower.includes('not accepted') ||
      lower.includes('no-response')
    ) {
      return { kind: 'not_reached', text: `Not accepted by ${driver}` };
    }
  }

  if (!r) return null;
  if (lower.includes('reject') || lower.includes('declined')) {
    return { kind: 'reject', text: r };
  }
  if (
    lower.includes('network') ||
    lower.includes('no response') ||
    lower.includes('timeout') ||
    lower.includes('unreached') ||
    lower.includes('not reached') ||
    lower.includes('not accepted') ||
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

export interface JobBookingMeta {
  vehicleType: string | null;
  passengers: number | null;
  bags: number | null;
  notes: string | null;
}

export function jobBookingMeta(job: Job): JobBookingMeta {
  const vehicleType = jobVehicleTypeLabel(job);
  const passengers = (job.passengers ?? 1) > 1 ? job.passengers! : null;
  const bags = (job.bags ?? 0) > 0 ? job.bags! : null;
  const notes = job.notes?.trim() || null;
  return { vehicleType, passengers, bags, notes };
}

export function jobBookingMetaVisible(meta: JobBookingMeta): boolean {
  return !!(meta.vehicleType || meta.passengers || meta.bags || meta.notes);
}

export interface LiveMeterDisplay {
  tariffLabel: string;
  fare: number;
  ticking: boolean;
}

type LiveMeterDriver = {
  liveFare?: number;
  liveTariffName?: string;
  liveJobId?: string;
  bookingId?: string;
  liveDistanceKm?: number;
  liveWaitingMin?: number;
  meterOnAt?: string;
};

type LiveMeterTariff = {
  id: string;
  name: string;
  startPrice: number;
  distanceRate: number;
  waitingRate: number;
  minimumFare: number;
};

function parseMeterStart(raw?: string): Date | null {
  if (!raw) return null;
  try {
    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function driverLiveFareForJob(job: Job, driver?: LiveMeterDriver | null): number | undefined {
  if (!driver || driver.liveFare == null) return undefined;
  const jobId = String(job.id);
  const matches =
    (driver.liveJobId && driver.liveJobId === jobId) ||
    (driver.bookingId && driver.bookingId === jobId);
  return matches ? driver.liveFare : undefined;
}

/** Active-tab live meter — driver's GPS heartbeat fare first, then client-side simulation. */
export function resolveLiveMeterDisplay(
  job: Job,
  tab: JobTab,
  opts: {
    driver?: LiveMeterDriver | null;
    tariff?: LiveMeterTariff | null;
    now?: Date;
  } = {},
): LiveMeterDisplay | null {
  if (tab !== 'active') return null;

  const now = opts.now ?? new Date();
  const tariff =
    opts.tariff ??
    (job.tariffId && job.tariffId !== '0' && job.tariffId !== '-1'
      ? { id: job.tariffId, name: job.tariffName || 'Tariff', startPrice: 0, distanceRate: 0, waitingRate: 0, minimumFare: 0 }
      : null);

  const tariffLabel =
    opts.driver?.liveTariffName?.trim() ||
    jobTariffLabel(job) ||
    tariff?.name ||
    (job.isFixedPrice ? 'Fixed' : 'Meter');

  if (job.isFixedPrice) {
    const raw = job.estimatedFare || job.totalFare || '';
    const fare = parseFloat(raw);
    if (!Number.isNaN(fare) && fare > 0) {
      return { tariffLabel, fare, ticking: false };
    }
  }

  const driverFare = driverLiveFareForJob(job, opts.driver);
  if (driverFare != null) {
    return {
      tariffLabel: opts.driver?.liveTariffName?.trim() || tariffLabel,
      fare: driverFare,
      ticking: true,
    };
  }

  if (job.totalFare) {
    const fare = parseFloat(job.totalFare);
    if (!Number.isNaN(fare) && fare > 0) {
      return { tariffLabel, fare, ticking: true };
    }
  }

  const meterStart =
    parseMeterStart(opts.driver?.meterOnAt) ??
    parseMeterStart(job.activeAt) ??
    jobTripStartTime(job, 'active');
  const rateTariff = opts.tariff;

  if (meterStart && rateTariff) {
    const elapsedMin = Math.max(0, (now.getTime() - meterStart.getTime()) / 60_000);
    const distKm = opts.driver?.liveDistanceKm ?? 0;
    const waitMin = opts.driver?.liveWaitingMin ?? elapsedMin * 0.75;
    const waitingRate = rateTariff.waitingRate > 0 ? rateTariff.waitingRate : 0.6;
    let fare = rateTariff.startPrice + distKm * rateTariff.distanceRate + waitMin * waitingRate;
    if (rateTariff.minimumFare > 0) fare = Math.max(fare, rateTariff.minimumFare);
    return { tariffLabel, fare, ticking: true };
  }

  const est = parseFloat(job.estimatedFare || '0');
  if (!Number.isNaN(est) && est > 0) {
    return { tariffLabel, fare: est, ticking: false };
  }

  return { tariffLabel, fare: rateTariff?.startPrice ?? 0, ticking: !!meterStart };
}
