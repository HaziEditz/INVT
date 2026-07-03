import {
  jobTabForStatus,
  normalizeJobStatus,
  type Job,
  type JobStatus,
  type JobTab,
} from '../types/job.ts';
import { mergeJobUpdate } from './mergeJob.ts';

export const TERMINAL_BOOKING_STATUSES = new Set<JobStatus>(['Completed', 'Cancelled', 'No Show']);

export const POOL_TAB_STATUSES = new Set<Job['status']>(['Pending', 'No One', 'Scheduled']);

export function isUnassignedDriverId(driverId: unknown): boolean {
  const d = String(driverId ?? '').trim();
  return !d || d === '0' || d === '-1' || d === '-2';
}

function recordDriverId(rec: Record<string, unknown>): string {
  return String(
    rec.DriverId ?? rec.driverId ?? rec.AssignedDriverId ?? rec.assignedDriverId ?? '',
  ).trim();
}

export type PendingQueueRegressCtx = {
  bookingsRef?: Map<number, Job>;
  abRec?: Record<string, unknown> | null;
  /** When true, queue-await window treats non-Offered pending as regression. */
  queueAwaiting?: boolean;
};

/**
 * Coerce mirror quirks (queuedAt, eventType) before ingest routing.
 * Terminal BookingStatus must win over stale queue lifecycle fields.
 */
export function coerceAllbookingsLiveStatus(
  rec: Record<string, unknown>,
  effectiveStatus: Job['status'],
): Job['status'] {
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
    return isUnassignedDriverId(drv) ? effectiveStatus : 'Queued';
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

/** True when a pendingjobs row would wrongly pull a queued job back to U-A / Assign / Active. */
export function pendingSnapshotWouldRegressQueue(
  bookingId: number,
  pjVal: Record<string, unknown>,
  ctx?: PendingQueueRegressCtx,
): boolean {
  const pjSt = normalizeJobStatus(
    String(pjVal.BookingStatus ?? pjVal.Status ?? pjVal.status ?? ''),
  );
  if (pjSt === 'Queued') return false;

  const bookingsQueued =
    !!ctx?.bookingsRef &&
    normalizeJobStatus(ctx.bookingsRef.get(bookingId)?.status ?? '') === 'Queued';
  const abQueued = ctx?.abRec ? allbookingsRecordIsQueued(ctx.abRec) : false;

  if (bookingsQueued || abQueued) {
    return pjSt !== 'Offered';
  }

  if (!ctx?.queueAwaiting) return false;
  return pjSt !== 'Offered';
}

/**
 * Drop stale pendingjobs partials when bookings/store/allbookings already confirms Queued or Assigned.
 * Extracted from useJobs.ts pending listener guards.
 */
export function shouldIgnorePendingSnapshot(input: {
  bookingId: number;
  pendingStatus: JobStatus;
  bookingStatus?: JobStatus | string | null;
  storeStatus?: JobStatus | string | null;
  queueAwaiting?: boolean;
}): boolean {
  const pendingSt = normalizeJobStatus(input.pendingStatus);
  const liveQueued =
    !!input.queueAwaiting ||
    normalizeJobStatus(input.bookingStatus ?? '') === 'Queued' ||
    normalizeJobStatus(input.storeStatus ?? '') === 'Queued';
  if (liveQueued && pendingSt !== 'Queued') return true;

  const liveAssigned =
    normalizeJobStatus(input.bookingStatus ?? '') === 'Assigned' ||
    normalizeJobStatus(input.storeStatus ?? '') === 'Assigned';
  if (liveAssigned && pendingSt !== 'Assigned') return true;

  return false;
}

/**
 * Preserve Queued when post-save fetchFresh returns a stale pool-shaped status.
 * Extracted from mergeJobUpdateFromServer in jobFlow.ts.
 */
export function applyQueuedPreservationOnServerMerge(
  merged: Job,
  optimistic: Job,
  fresh: Job,
  seq: number,
): Job {
  const optSt = normalizeJobStatus(optimistic.status);
  const freshSt = normalizeJobStatus(fresh.status);
  if (
    optSt === 'Queued' &&
    (freshSt === 'Pending' || freshSt === 'No One' || freshSt === 'Scheduled')
  ) {
    return { ...merged, status: 'Queued', updateSeq: seq };
  }
  return merged;
}

export type JobLifecycleEditContext = 'listener' | 'postEditSave' | 'assignRetry';

export type JobLifecycleInput = {
  bookingId: number;
  storeJob: Job | null;
  /** Status from bookingsRef (allbookings ingest cache) — listener path. */
  bookingCacheStatus?: JobStatus | string | null;
  pendingRow?: Partial<Job> | Record<string, unknown> | null;
  allbookingsRow?: Record<string, unknown> | null;
  optimisticJob?: Job | null;
  freshJob?: Job | null;
  flags?: {
    isQueueAwaiting?: boolean;
    isOfferAwaiting?: boolean;
    editContext?: JobLifecycleEditContext;
    baseStatus?: JobStatus;
  };
  authoritativeSeq?: number;
};

export type JobLifecycleResult = {
  status: JobStatus;
  tab: JobTab;
  droppedPending: boolean;
  reason?: string;
};

function pendingStatusFromRow(row: Partial<Job> | Record<string, unknown>): JobStatus | null {
  const raw = row.status ?? row.BookingStatus ?? row.Status;
  if (raw == null || raw === '') return null;
  return normalizeJobStatus(String(raw));
}

function minimalJobShell(bookingId: number, status: JobStatus, driverId = 'D001'): Job {
  return {
    id: bookingId,
    companyId: '860869',
    status,
    source: 'dispatch',
    serviceType: 'taxi',
    pickAddress: '',
    pickLatLng: '',
    dropAddress: '',
    dropLatLng: '',
    passengerName: '',
    passengerPhone: '',
    paymentType: 'Cash',
    estimatedFare: '',
    bookingDateTime: new Date().toISOString(),
    driverId,
  };
}

/**
 * Pure status/tab resolver for one booking id (listener-shaped).
 * Phase 2 will wire useJobs to this entry point.
 */
export function resolveJobLifecycle(input: JobLifecycleInput): JobLifecycleResult {
  const { bookingId, storeJob, pendingRow, allbookingsRow, flags = {}, bookingCacheStatus } =
    input;
  const storeStatus = storeJob?.status ? normalizeJobStatus(storeJob.status) : null;
  const cacheStatus =
    bookingCacheStatus != null && bookingCacheStatus !== ''
      ? normalizeJobStatus(bookingCacheStatus)
      : null;

  let abStatus: JobStatus | null = null;
  if (allbookingsRow) {
    abStatus = coerceAllbookingsLiveStatus(
      allbookingsRow,
      (storeStatus ?? flags.baseStatus ?? 'Pending') as JobStatus,
    );
  }

  const listenerBookingStatus = cacheStatus ?? abStatus ?? storeStatus;

  const pendingStatus = pendingRow ? pendingStatusFromRow(pendingRow) : null;
  const droppedPending =
    pendingStatus != null &&
    shouldIgnorePendingSnapshot({
      bookingId,
      pendingStatus,
      bookingStatus: listenerBookingStatus,
      storeStatus,
      queueAwaiting: flags.isQueueAwaiting,
    });

  let status: JobStatus = storeStatus ?? flags.baseStatus ?? 'Pending';

  if (abStatus === 'Queued' || allbookingsRecordIsQueued(allbookingsRow ?? {})) {
    status = 'Queued';
  } else if (flags.isQueueAwaiting) {
    status = 'Queued';
  } else if (abStatus) {
    status = abStatus;
  } else if (!droppedPending && pendingStatus && storeJob) {
    status = normalizeJobStatus(
      mergeJobUpdate(storeJob, { status: pendingStatus }).status,
    );
  }

  if (
    storeStatus === 'Assigned' &&
    pendingStatus &&
    pendingStatus !== 'Assigned' &&
    !droppedPending
  ) {
    const wouldDrop = shouldIgnorePendingSnapshot({
      bookingId,
      pendingStatus,
      bookingStatus: listenerBookingStatus,
      storeStatus,
      queueAwaiting: flags.isQueueAwaiting,
    });
    if (wouldDrop) {
      status = 'Assigned';
    }
  }

  const shell = storeJob ?? minimalJobShell(bookingId, status);
  return {
    status,
    tab: jobTabForStatus({ ...shell, status }),
    droppedPending,
    reason: droppedPending ? 'ignoredStalePending' : undefined,
  };
}

/**
 * Merge optimistic + fresh snapshots (post-save shaped).
 * Phase 3 will wire persistJobUpdate post-save to this entry point.
 */
export function mergeJobSnapshots(input: JobLifecycleInput): Job {
  const { optimisticJob, freshJob, authoritativeSeq = 0, flags = {} } = input;
  if (!optimisticJob || !freshJob) {
    throw new Error('mergeJobSnapshots requires optimisticJob and freshJob');
  }

  const seq = Math.max(
    authoritativeSeq,
    freshJob.updateSeq ?? 0,
    optimisticJob.updateSeq ?? 0,
  );
  let merged = mergeJobUpdate(optimisticJob, { ...freshJob, updateSeq: seq });

  if (flags.editContext === 'postEditSave' || flags.baseStatus === 'Queued') {
    merged = applyQueuedPreservationOnServerMerge(merged, optimisticJob, freshJob, seq);
  } else {
    const optSt = normalizeJobStatus(optimisticJob.status);
    const freshSt = normalizeJobStatus(freshJob.status);
    if (
      optSt === 'Queued' &&
      (freshSt === 'Pending' || freshSt === 'No One' || freshSt === 'Scheduled')
    ) {
      merged = applyQueuedPreservationOnServerMerge(merged, optimisticJob, freshJob, seq);
    }
  }

  return merged;
}
