import {
  jobTabForStatus,
  normalizeJobStatus,
  type Job,
  type JobTab,
} from '@/types/job';

export const TERMINAL_BOOKING_STATUSES = new Set(['Completed', 'Cancelled', 'No Show']);

export const LIVE_DISPATCH_TABS = new Set<JobTab>(['offer', 'assign', 'active', 'queue']);

const POOL_UA_STATUSES = new Set<Job['status']>(['Pending', 'No One', 'Scheduled']);

/** Brief window to retain live-tab jobs during accept/assign Firebase races. */
export const OPTIMISTIC_LIVE_RETAIN_MS = 8_000;

/** Queue jobs stay visible until allbookings confirms Queued (or this cap). */
export const QUEUE_AWAIT_ALLBOOKINGS_MS = 120_000;

const optimisticLiveUntil = new Map<number, number>();
const queueAwaitingAllbookings = new Map<number, number>();

export type DispatchRefreshHint = {
  action?: string;
  status?: string;
  driverId?: string;
  updateSeq?: number;
};

export function markOptimisticLiveTransition(jobId: number, now = Date.now()): void {
  optimisticLiveUntil.set(jobId, now + OPTIMISTIC_LIVE_RETAIN_MS);
}

export function clearOptimisticLiveTransition(jobId: number): void {
  optimisticLiveUntil.delete(jobId);
}

export function markQueueAwaitingAllbookings(jobId: number, now = Date.now()): void {
  queueAwaitingAllbookings.set(jobId, now + QUEUE_AWAIT_ALLBOOKINGS_MS);
}

export function clearQueueAwaitingAllbookings(jobId: number): void {
  queueAwaitingAllbookings.delete(jobId);
}

export function isQueueAwaitingAllbookings(jobId: number, now = Date.now()): boolean {
  const until = queueAwaitingAllbookings.get(jobId);
  if (until == null) return false;
  if (now >= until) {
    queueAwaitingAllbookings.delete(jobId);
    return false;
  }
  return true;
}

/** Minimal job shell when dispatch refresh arrives before pendingjobs snapshot exists. */
export function minimalJobFromDispatchRefresh(
  bookingId: number,
  companyId: string,
  refresh: DispatchRefreshHint,
): Job | null {
  if (!refresh.status) return null;
  const status = normalizeJobStatus(refresh.status) as Job['status'];
  return {
    id: bookingId,
    companyId,
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
    driverId: refresh.driverId != null && refresh.driverId !== '' ? String(refresh.driverId) : '0',
    ...(refresh.updateSeq != null ? { updateSeq: refresh.updateSeq } : {}),
  };
}

/** Re-inject queue jobs optimistically placed before allbookings snapshot catches up. */
export function reinjectQueueAwaitingJobs(
  bookingsRef: Map<number, Job>,
  storeJobs: Job[],
  now = Date.now(),
): void {
  for (const j of storeJobs) {
    if (normalizeJobStatus(j.status) !== 'Queued') continue;
    if (bookingsRef.has(j.id)) continue;
    if (!isQueueAwaitingAllbookings(j.id, now)) continue;
    bookingsRef.set(j.id, j);
  }
}

function isPoolUaStatus(status: string): boolean {
  return POOL_UA_STATUSES.has(normalizeJobStatus(status) as Job['status']);
}

function isWithinOptimisticWindow(jobId: number, now = Date.now()): boolean {
  const until = optimisticLiveUntil.get(jobId);
  if (until == null) return false;
  if (now >= until) {
    optimisticLiveUntil.delete(jobId);
    return false;
  }
  return true;
}

/**
 * Re-inject store jobs missing from pendingjobs/allbookings listener caches.
 * Live dispatch tabs (Active/Assign/Offer/Queue) are NOT kept indefinitely —
 * only during a short optimistic window after accept/assign transitions.
 */
export function shouldPreserveAbsentStoreJob(
  job: Job,
  pendingRef: Map<number, Job>,
  bookingsRef: Map<number, Job>,
  now = Date.now(),
): boolean {
  if (TERMINAL_BOOKING_STATUSES.has(normalizeJobStatus(job.status))) return false;
  const tab = jobTabForStatus(job);
  if (tab === 'ua') return true;
  if (!LIVE_DISPATCH_TABS.has(tab)) return false;
  if (pendingRef.has(job.id) || bookingsRef.has(job.id)) return true;
  if (isPoolUaStatus(job.status)) return true;
  if (normalizeJobStatus(job.status) === 'Queued' && isQueueAwaitingAllbookings(job.id, now)) {
    return true;
  }
  return isWithinOptimisticWindow(job.id, now);
}
