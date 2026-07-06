import {
  jobFromFirebase,
  jobPickupTypeLabel,
  type Job,
  type JobStatus,
  type ServiceType,
} from '@/types/job';
import { normalizeJobStatus, TERMINAL_BOOKING_STATUSES } from '@/lib/jobStatusAuthority';
import { sourceDisplayName } from '@/lib/utils';

const LEGACY_COMPLETED_RAW = new Set([
  'dispatched',
  'done',
  'closed',
  'completed',
  'complete',
]);

export function isClosedJobRecord(rec: Record<string, unknown>): boolean {
  const raw = String(rec.BookingStatus ?? rec.Status ?? rec.status ?? '').trim();
  if (!raw) return false;
  const st = normalizeJobStatus(raw);
  if (TERMINAL_BOOKING_STATUSES.has(st)) return true;
  return LEGACY_COMPLETED_RAW.has(raw.toLowerCase());
}

export function closedJobStatusFromRecord(rec: Record<string, unknown>): JobStatus {
  const raw = String(rec.BookingStatus ?? rec.Status ?? rec.status ?? '').trim();
  const st = normalizeJobStatus(raw);
  if (st === 'Cancelled' || st === 'No Show') return st;
  if (st === 'Completed') return 'Completed';
  if (LEGACY_COMPLETED_RAW.has(raw.toLowerCase())) return 'Completed';
  return st;
}

/** Terminal timestamp for sort / date filters (newest first). */
export function closedJobTerminalAtMs(job: Job, rec?: Record<string, unknown>): number {
  if (job.completedAt && job.completedAt > 0) return job.completedAt;

  const stepTimes = rec?.stepTimes;
  if (stepTimes && typeof stepTimes === 'object') {
    const st = stepTimes as Record<string, unknown>;
    for (const k of ['completeAt', 'cancelledAt', 'complete_at']) {
      const n = Number(st[k]);
      if (n > 0) return n < 1e12 ? n * 1000 : n;
    }
  }

  for (const key of [
    'completedAt',
    'CompletedAt',
    'JobCompleteTime',
    'cancelledAt',
    'CancelledAt',
    'closedAt',
    'newcompelete',
  ]) {
    const v = rec?.[key] ?? (key === 'cancelledAt' ? job.cancelledAt : undefined);
    if (v == null || v === '') continue;
    if (typeof v === 'number') {
      const ms = v < 1e12 ? v * 1000 : v;
      if (ms > 0) return ms;
      continue;
    }
    const ms = Date.parse(String(v));
    if (!Number.isNaN(ms) && ms > 0) return ms;
  }

  if (job.cancelledAt) {
    const ms = Date.parse(job.cancelledAt);
    if (!Number.isNaN(ms)) return ms;
  }

  if (job.createdAt && job.createdAt > 0) return job.createdAt;

  const pickup = Date.parse(job.bookingDateTime?.replace(' ', 'T') || '');
  if (!Number.isNaN(pickup) && pickup > 0) return pickup;

  return 0;
}

function pickString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return undefined;
}

/** Overlay completedJobs fields when allbookings row is sparse. */
export function mergeClosedJobRecords(
  base: Job,
  overlayRec: Record<string, unknown> | null | undefined,
  companyId: string,
): Job {
  if (!overlayRec || typeof overlayRec !== 'object') return base;

  const overlay = jobFromFirebase(String(base.id), overlayRec, companyId);
  if (!overlay) return base;

  const st = closedJobStatusFromRecord(overlayRec);
  const terminalAt = closedJobTerminalAtMs(overlay, overlayRec) || closedJobTerminalAtMs(base);

  return {
    ...base,
    status: st === 'Completed' || st === 'Cancelled' || st === 'No Show' ? st : base.status,
    pickAddress: pickString(overlay.pickAddress, base.pickAddress) || base.pickAddress,
    dropAddress: pickString(overlay.dropAddress, base.dropAddress) || base.dropAddress,
    passengerName: pickString(overlay.passengerName, base.passengerName) || base.passengerName,
    passengerPhone: pickString(overlay.passengerPhone, base.passengerPhone) || base.passengerPhone,
    driverId: pickString(overlay.driverId, base.driverId),
    driverName: pickString(overlay.driverName, base.driverName),
    vehicleId: pickString(overlay.vehicleId, base.vehicleId),
    vehicleNo: pickString(overlay.vehicleNo, base.vehicleNo),
    paymentType: pickString(overlay.paymentType, base.paymentType) || base.paymentType,
    totalFare: pickString(overlay.totalFare, base.totalFare),
    estimatedFare: pickString(overlay.estimatedFare, base.estimatedFare) || base.estimatedFare,
    tariffName: pickString(overlay.tariffName, base.tariffName),
    vehicleType: pickString(overlay.vehicleType, base.vehicleType),
    dispatcherName: pickString(overlay.dispatcherName, base.dispatcherName),
    cancelReason: pickString(overlay.cancelReason, base.cancelReason),
    cancelSource: pickString(overlay.cancelSource, base.cancelSource),
    cancelledBy: pickString(overlay.cancelledBy, base.cancelledBy),
    cancelledAt: pickString(overlay.cancelledAt, base.cancelledAt),
    completedAt: terminalAt > 0 ? terminalAt : base.completedAt,
  };
}

export function jobFromClosedFirebaseRecord(
  key: string,
  rec: Record<string, unknown>,
  companyId: string,
): Job | null {
  if (!isClosedJobRecord(rec)) return null;
  const job = jobFromFirebase(key, rec, companyId);
  if (!job) return null;
  job.status = closedJobStatusFromRecord(rec);
  const terminalAt = closedJobTerminalAtMs(job, rec);
  if (terminalAt > 0) job.completedAt = terminalAt;
  return job;
}

export function serviceTypeDisplay(service: ServiceType | string): string {
  const map: Record<string, string> = {
    taxi: 'Taxi',
    food: 'Food',
    freight: 'Freight',
    tm: 'TM',
    acc: 'ACC',
    rental: 'Rental',
  };
  return map[String(service).toLowerCase()] || String(service);
}

export function closedJobSourceDisplay(job: Job): string {
  return sourceDisplayName(job.source);
}

export function closedJobTypeDisplay(job: Job): string {
  return jobPickupTypeLabel(job);
}

export function closedJobFareDisplay(job: Job): string {
  const raw = (job.totalFare || job.estimatedFare || '').trim();
  if (!raw || raw === '0') return '—';
  return raw.startsWith('$') ? raw : `$${raw}`;
}

/** True when a fare was actually collected (not just a booking-time payment preference). */
export function closedJobPaymentCollected(
  job: Job,
  raw?: Record<string, unknown>,
): boolean {
  const totalRaw = (job.totalFare || '').replace(/^\$/, '').trim();
  const total = parseFloat(totalRaw);
  if (!Number.isNaN(total) && total > 0) return true;

  if (raw) {
    if (raw.cardPaid === true || raw.CardPaid === true || raw.paymentCollected === true) return true;
    const ps = String(raw.paymentStatus ?? raw.PaymentStatus ?? '').toLowerCase();
    if (ps === 'paid' || ps === 'collected') return true;
    const meter = parseFloat(String(raw.meterFare ?? raw.MeterFare ?? ''));
    if (!Number.isNaN(meter) && meter > 0) return true;
  }
  return false;
}

/** Payment column: Completed always; Cancelled/No Show only when fare was collected. */
export function closedJobPaymentDisplay(job: Job, raw?: Record<string, unknown>): string {
  const st = normalizeJobStatus(job.status);
  const payment = (job.paymentType || '').trim();
  if (st === 'Completed') return payment || '—';
  if (!closedJobPaymentCollected(job, raw)) return '—';
  return payment || '—';
}

export function closedJobDriverDisplay(job: Job): string {
  const name = (job.driverName || '').trim();
  const id = (job.driverId || '').trim();
  if (name && id && name !== id) return `${name} (${id})`;
  return name || id || '—';
}

export function closedJobVehicleDisplay(job: Job): string {
  return (job.vehicleNo || job.vehicleId || '').trim() || '—';
}

export type ClosedJobFilters = {
  from: string;
  to: string;
  query: string;
  status: 'all' | 'Completed' | 'Cancelled' | 'No Show';
  driverId: string;
  serviceType: string;
  source: string;
  vehicleType: string;
};

export function filterClosedJobs(jobs: Job[], filters: ClosedJobFilters): Job[] {
  const q = filters.query.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');

  return jobs.filter((job) => {
    const terminalAt = job.completedAt || 0;
    if (filters.from && terminalAt > 0) {
      const day = new Date(terminalAt).toISOString().slice(0, 10);
      if (day < filters.from) return false;
    }
    if (filters.to && terminalAt > 0) {
      const day = new Date(terminalAt).toISOString().slice(0, 10);
      if (day > filters.to) return false;
    }
    if (filters.status !== 'all' && normalizeJobStatus(job.status) !== filters.status) return false;
    if (filters.driverId && String(job.driverId || '') !== filters.driverId) return false;
    if (filters.serviceType && job.serviceType !== filters.serviceType) return false;
    if (filters.source && job.source !== filters.source) return false;
    if (filters.vehicleType) {
      const vt = (job.vehicleType || '').trim().toLowerCase();
      if (vt !== filters.vehicleType.toLowerCase()) return false;
    }

    if (!q) return true;

    const hay = [
      String(job.id),
      job.passengerName,
      job.passengerPhone,
      job.pickAddress,
      job.dropAddress,
      job.driverName,
      job.driverId,
      job.vehicleNo,
      job.vehicleId,
    ]
      .join(' ')
      .toLowerCase();

    if (hay.includes(q)) return true;
    if (digits.length >= 4 && String(job.id).includes(digits)) return true;
    if (digits.length >= 6 && (job.passengerPhone || '').replace(/\D/g, '').includes(digits)) return true;
    return false;
  });
}

export function uniqueClosedJobDrivers(jobs: Job[]): { id: string; label: string }[] {
  const map = new Map<string, string>();
  for (const j of jobs) {
    const id = String(j.driverId || '').trim();
    if (!id) continue;
    const label = closedJobDriverDisplay(j);
    map.set(id, label);
  }
  return Array.from(map.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function uniqueClosedJobVehicleTypes(jobs: Job[]): string[] {
  const set = new Set<string>();
  for (const j of jobs) {
    const vt = (j.vehicleType || '').trim();
    if (vt) set.add(vt);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
