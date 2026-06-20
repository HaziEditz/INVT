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

const optimisticLiveUntil = new Map<number, number>();

export function markOptimisticLiveTransition(jobId: number, now = Date.now()): void {
  optimisticLiveUntil.set(jobId, now + OPTIMISTIC_LIVE_RETAIN_MS);
}

export function clearOptimisticLiveTransition(jobId: number): void {
  optimisticLiveUntil.delete(jobId);
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
  return isWithinOptimisticWindow(job.id, now);
}
