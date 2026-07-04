/**
 * Single authority for job status normalization, Firebase status resolution,
 * status merge conflict rules, and dispatch tab routing.
 *
 * Phase 1: pure extraction — behavior must match the pre-extraction implementations.
 * Consumers may still import from @/types/job, @/lib/mergeJob, @/lib/jobPoolSync
 * via re-exports; Phase 2 wires callers directly here.
 */
import type { Job, JobStatus, JobTab } from '../types/job';

// ─── Status sets ─────────────────────────────────────────────────────────────

export const TERMINAL_BOOKING_STATUSES = new Set<string>(['Completed', 'Cancelled', 'No Show']);

export const LIVE_DISPATCH_STATUSES = new Set<string>([
  'Offered',
  'Queued',
  'Assigned',
  'Picking',
  'Arrived',
  'Active',
  'OnTrip',
  'Pending',
  'No One',
  'Scheduled',
]);

export const LIVE_DISPATCH_TABS = new Set<JobTab>(['offer', 'assign', 'active', 'queue']);

export const POOL_UA_STATUSES = new Set<JobStatus>(['Pending', 'No One', 'Scheduled']);

export const POOL_TAB_STATUSES = new Set<string>(['Pending', 'No One', 'Scheduled']);

export const LIVE_LIFECYCLE_STATUSES = new Set<string>([
  'Active',
  'Picking',
  'Arrived',
  'OnTrip',
  'Assigned',
  'Offered',
  'Scheduled',
]);

/** Live booking statuses used by the dispatch listener pipeline. */
export const ACTIVE_BOOKING_STATUSES = new Set<string>([
  'Offered',
  'Queued',
  'Assigned',
  'Picking',
  'Arrived',
  'Active',
  'OnTrip',
]);

export const LIVE_OFFER_STATUSES = new Set<string>(['Offered', 'Assigned']);

/** Progression rank — higher means further along the dispatch lifecycle. */
export const STATUS_RANK: Partial<Record<JobStatus, number>> = {
  'No One': 1,
  Pending: 1,
  Scheduled: 1,
  Offered: 2,
  Queued: 3,
  Assigned: 4,
  Picking: 5,
  Arrived: 6,
  Active: 7,
  OnTrip: 7,
  Completed: 100,
  Cancelled: 100,
  'No Show': 100,
};

// ─── Normalize / resolve ─────────────────────────────────────────────────────

export function normalizeJobStatus(raw: string): JobStatus {
  const s = String(raw || '').trim();
  if (s === 'NoOne' || s === 'no_one' || s === 'NO ONE') return 'No One';
  if (s === 'pending' || s === 'PENDING') return 'Pending';
  if (s === 'queued' || s === 'QUEUED') return 'Queued';
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

export function statusBadgeStyle(status: JobStatus): { label: string; color: string; bg: string } | null {
  const st = normalizeJobStatus(status);
  if (st === 'No One') return { label: 'NO ONE', color: '#94a3b8', bg: 'rgba(100,116,139,0.2)' };
  if (st === 'Pending') return { label: 'PENDING', color: '#5b7cfa', bg: 'rgba(79,110,247,0.2)' };
  if (st === 'Scheduled') return { label: 'SCHEDULED', color: '#f59e0b', bg: 'rgba(245,158,11,0.2)' };
  return null;
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

/** Authoritative pool status for UI — driverId -1 means No One even if status field lagged. */
export function effectiveJobStatus(job: Pick<Job, 'status' | 'driverId'>): JobStatus {
  const drv = String(job.driverId ?? '').trim();
  if (drv === '-1') return 'No One';
  return normalizeJobStatus(job.status);
}

// ─── Driver / queue predicates ───────────────────────────────────────────────

export function isUnassignedDriverId(driverId: unknown): boolean {
  const d = String(driverId ?? '').trim();
  return !d || d === '0' || d === '-1' || d === '-2';
}

/** Queue tab: BookingStatus Queued with a real assigned driver (not pool ids 0 / -1 / -2). */
export function isGenuineQueuedJob(job: Pick<Job, 'status' | 'driverId'>): boolean {
  if (normalizeJobStatus(job.status) !== 'Queued') return false;
  return !isUnassignedDriverId(job.driverId);
}

export function isPoolUaStatus(status: string): boolean {
  return POOL_UA_STATUSES.has(normalizeJobStatus(status) as JobStatus);
}

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_BOOKING_STATUSES.has(normalizeJobStatus(status));
}

export function isLiveDispatchStatus(status: string): boolean {
  return LIVE_DISPATCH_STATUSES.has(normalizeJobStatus(status));
}

export function recordDriverId(rec: Record<string, unknown>): string {
  return String(
    rec.DriverId ?? rec.driverId ?? rec.AssignedDriverId ?? rec.assignedDriverId ?? '',
  ).trim();
}

// ─── Tab routing ─────────────────────────────────────────────────────────────

export function jobTabForStatus(job: Pick<Job, 'status' | 'driverId' | 'serviceType' | 'id'>): JobTab {
  if (job.serviceType === 'food' || job.serviceType === 'freight') return 'dy';
  const raw = job.status;
  const st = normalizeJobStatus(job.status);
  const drv = String(job.driverId ?? '').trim();
  const hasQueuedDriver = !!drv && drv !== '0' && drv !== '-1' && drv !== '-2';
  const tab: JobTab =
    st === 'Queued' && hasQueuedDriver
      ? 'queue'
      : st === 'Active' || st === 'OnTrip'
        ? 'active'
        : st === 'Assigned' || st === 'Picking' || st === 'Arrived'
          ? 'assign'
          : st === 'Offered'
            ? 'offer'
            : 'ua';
  if (
    String(raw).toLowerCase().includes('queue') ||
    st === 'Queued' ||
    tab === 'queue' ||
    String(raw) === 'Busy'
  ) {
    console.log('[dispatch-queue-debug] jobTabForStatus', {
      id: (job as Job).id,
      rawStatus: raw,
      normalizedStatus: st,
      tab,
      serviceType: job.serviceType,
      driverId: job.driverId,
    });
  }
  return tab;
}

export function isUaJob(job: Pick<Job, 'status' | 'driverId' | 'serviceType' | 'id'>): boolean {
  return jobTabForStatus(job) === 'ua';
}

function queueEditPinDebug(
  phase: string,
  detail: Record<string, unknown>,
): void {
  // Diagnostic only — filter browser console with: queue-edit-pin
  console.log('[queue-edit-pin]', { phase, ...detail, at: Date.now() });
}

function jobPinSnapshot(job: Pick<Job, 'id' | 'status' | 'driverId' | 'vehicleId' | 'serviceType'>) {
  return {
    id: job.id,
    status: job.status,
    normalizedStatus: normalizeJobStatus(job.status),
    driverId: job.driverId,
    vehicleId: job.vehicleId,
    serviceType: job.serviceType,
    tab: jobTabForStatus(job),
    genuineQueued: isGenuineQueuedJob(job),
    unassignedDriver: isUnassignedDriverId(job.driverId),
  };
}

/**
 * Pin an optimistic edit of a genuine Queued job so it cannot flash to U-A.
 * Applies field changes from `applied`, then restores Queued status and the base
 * assignment (driver/vehicle). Returns null when base is not a genuine queued job.
 */
export function pinQueuedOptimisticJob(baseJob: Job, applied: Job): Job | null {
  const genuine = isGenuineQueuedJob(baseJob);
  if (!genuine) {
    queueEditPinDebug('pinQueuedOptimisticJob', {
      result: 'null-not-genuine-queued',
      base: jobPinSnapshot(baseJob),
      applied: jobPinSnapshot(applied),
    });
    return null;
  }
  const pinned: Job = {
    ...applied,
    status: 'Queued',
    driverId: baseJob.driverId,
    vehicleId: baseJob.vehicleId,
  };
  const pinnedTab = jobTabForStatus(pinned);
  // Authority gate: must remain on Queue tab before any store upsert.
  if (pinnedTab !== 'queue') {
    queueEditPinDebug('pinQueuedOptimisticJob', {
      result: 'null-tab-not-queue',
      base: jobPinSnapshot(baseJob),
      applied: jobPinSnapshot(applied),
      pinned: jobPinSnapshot(pinned),
      pinnedTab,
    });
    return null;
  }
  queueEditPinDebug('pinQueuedOptimisticJob', {
    result: 'pinned-queue',
    base: jobPinSnapshot(baseJob),
    applied: jobPinSnapshot(applied),
    pinned: jobPinSnapshot(pinned),
  });
  return pinned;
}

/**
 * After a server refresh, keep a genuine queued optimistic job on the Queue tab
 * when the snapshot is a stale pool/offer demotion.
 */
export function retainQueuedOptimisticAfterServerMerge(
  optimistic: Job,
  merged: Job,
): Job {
  if (!isGenuineQueuedJob(optimistic) || jobTabForStatus(optimistic) !== 'queue') {
    queueEditPinDebug('retainQueuedOptimisticAfterServerMerge', {
      result: 'pass-through-optimistic-not-queue',
      optimistic: jobPinSnapshot(optimistic),
      merged: jobPinSnapshot(merged),
    });
    return merged;
  }
  // Already on Queue tab — keep server field updates.
  if (jobTabForStatus(merged) === 'queue') {
    queueEditPinDebug('retainQueuedOptimisticAfterServerMerge', {
      result: 'keep-merged-already-queue',
      optimistic: jobPinSnapshot(optimistic),
      merged: jobPinSnapshot(merged),
    });
    return merged;
  }
  const mergedSt = normalizeJobStatus(merged.status);
  const demotedToPoolOrUa =
    mergedSt === 'Pending' ||
    mergedSt === 'No One' ||
    mergedSt === 'Scheduled' ||
    mergedSt === 'Offered' ||
    isUnassignedDriverId(merged.driverId);
  // Real lifecycle advance (Assigned / Active / etc.) must not be pinned back.
  if (!demotedToPoolOrUa) {
    queueEditPinDebug('retainQueuedOptimisticAfterServerMerge', {
      result: 'pass-through-lifecycle-advance',
      optimistic: jobPinSnapshot(optimistic),
      merged: jobPinSnapshot(merged),
      mergedSt,
    });
    return merged;
  }
  const retained: Job = {
    ...merged,
    status: 'Queued',
    driverId: optimistic.driverId,
    vehicleId: optimistic.vehicleId ?? merged.vehicleId,
  };
  const retainedTab = jobTabForStatus(retained);
  queueEditPinDebug('retainQueuedOptimisticAfterServerMerge', {
    result: retainedTab === 'queue' ? 'retained-queue' : 'retain-failed-tab',
    optimistic: jobPinSnapshot(optimistic),
    merged: jobPinSnapshot(merged),
    retained: jobPinSnapshot(retained),
    demotedToPoolOrUa,
  });
  return retainedTab === 'queue' ? retained : merged;
}

// ─── Status merge ────────────────────────────────────────────────────────────

export function statusRank(status: JobStatus | string | undefined): number {
  if (!status) return -1;
  return STATUS_RANK[normalizeJobStatus(String(status))] ?? 1;
}

/** Never let a stale pendingjobs partial downgrade a newer allbookings status. */
export function mergeJobStatus(
  existing: JobStatus,
  incoming: JobStatus | undefined,
  existingSeq: number,
  incomingSeq: number,
): JobStatus {
  if (!incoming) return existing;
  const ex = normalizeJobStatus(existing);
  const inc = normalizeJobStatus(incoming);
  if (inc === 'Cancelled' || inc === 'Completed' || inc === 'No Show') {
    const exNorm = normalizeJobStatus(existing);
    const exRank = statusRank(exNorm);
    // Stale terminal from a reused booking Id must not beat a live active status.
    if (exRank > 0 && exRank < 100 && incomingSeq <= existingSeq) return ex;
    return inc;
  }
  // Pool statuses (No One / Pending / Scheduled) are peers — never let a stale
  // Pending snapshot beat a newer No One (or vice versa) via progression rank.
  const POOL: JobStatus[] = ['No One', 'Pending', 'Scheduled'];
  if (POOL.includes(ex) && POOL.includes(inc)) {
    if (incomingSeq >= existingSeq) return inc;
    return ex;
  }
  if ((inc === 'No One' || inc === 'Pending') && incomingSeq >= existingSeq) return inc;
  // Queued is sticky — stale pool / offer snapshots must not outrank Queued.
  const QUEUED_PROMOTE: JobStatus[] = ['Offered', 'Assigned', 'Picking', 'Arrived', 'Active', 'OnTrip'];
  if (ex === 'Queued' && (POOL.includes(inc) || QUEUED_PROMOTE.includes(inc))) {
    if (inc === 'Offered' || QUEUED_PROMOTE.includes(inc)) {
      if (incomingSeq <= existingSeq) return ex;
      return inc;
    }
    return ex;
  }
  if (statusRank(inc) < statusRank(ex)) return ex;
  if (statusRank(inc) === statusRank(ex) && incomingSeq < existingSeq) return ex;
  return inc;
}

// ─── Allbookings / queue status decisions (pure) ─────────────────────────────

/**
 * Coerce mirror quirks (queuedAt, eventType) before ingest routing.
 * Terminal BookingStatus must win over stale queue lifecycle fields.
 */
export function coerceAllbookingsLiveStatus(
  rec: Record<string, unknown>,
  effectiveStatus: JobStatus,
): JobStatus {
  const bookingRaw = rec.BookingStatus ?? rec.bookingStatus;
  const fbBooking =
    bookingRaw != null ? normalizeJobStatus(String(bookingRaw)) : null;
  const statusRaw = rec.Status ?? rec.status;
  const fbStatus =
    statusRaw != null ? normalizeJobStatus(String(statusRaw)) : null;

  if (fbBooking && TERMINAL_BOOKING_STATUSES.has(fbBooking)) return fbBooking;
  if (fbStatus && TERMINAL_BOOKING_STATUSES.has(fbStatus)) return fbStatus;
  if (TERMINAL_BOOKING_STATUSES.has(effectiveStatus)) return effectiveStatus;

  if (fbBooking && POOL_TAB_STATUSES.has(fbBooking)) return fbBooking;
  if (fbStatus && POOL_TAB_STATUSES.has(fbStatus)) return fbStatus;

  const drv = recordDriverId(rec);
  if (fbBooking === 'Queued') {
    return isUnassignedDriverId(drv) ? (effectiveStatus as JobStatus) : 'Queued';
  }
  const eventType = String(rec.eventType ?? rec.EventType ?? '').toLowerCase();
  if (eventType === 'queued' && !isUnassignedDriverId(drv)) {
    if (fbBooking !== 'No One' && fbStatus !== 'No One' && fbBooking !== 'Pending' && fbStatus !== 'Pending') {
      return 'Queued';
    }
  }
  if (
    (rec.queuedAt != null || rec.QueuedAt != null) &&
    !isUnassignedDriverId(drv) &&
    fbBooking !== 'No One' &&
    fbStatus !== 'No One' &&
    fbBooking !== 'Pending' &&
    fbStatus !== 'Pending'
  ) {
    return 'Queued';
  }
  return effectiveStatus;
}

/** True when allbookings (or mirror fields) confirms Queued. */
export function allbookingsRecordIsQueued(rec: Record<string, unknown>): boolean {
  if (isUnassignedDriverId(recordDriverId(rec))) return false;
  const bookingRaw = rec.BookingStatus ?? rec.bookingStatus;
  const fbBooking = bookingRaw != null ? normalizeJobStatus(String(bookingRaw)) : null;
  if (fbBooking && POOL_TAB_STATUSES.has(fbBooking)) return false;
  if (fbBooking === 'Queued') return true;
  const statusRaw = rec.Status ?? rec.status;
  const fbStatus = statusRaw != null ? normalizeJobStatus(String(statusRaw)) : null;
  if (fbStatus && POOL_TAB_STATUSES.has(fbStatus)) return false;
  if (fbStatus === 'Queued') return true;
  if (String(rec.eventType ?? rec.EventType ?? '').toLowerCase() === 'queued') return true;
  return rec.queuedAt != null || rec.QueuedAt != null;
}

/**
 * Pure queue-regress check when allbookings / bookingsRef already confirm Queued.
 * Stateful queue-await handling stays in jobPoolSync.pendingSnapshotWouldRegressQueue.
 */
export function pendingSnapshotWouldRegressConfirmedQueue(
  pjVal: Record<string, unknown>,
  opts: { bookingsQueued: boolean; abQueued: boolean },
): boolean {
  const pjSt = normalizeJobStatus(
    String(pjVal.BookingStatus ?? pjVal.Status ?? pjVal.status ?? ''),
  );
  if (pjSt === 'Queued') return false;
  if (opts.bookingsQueued || opts.abQueued) {
    return pjSt !== 'Offered';
  }
  return false;
}
