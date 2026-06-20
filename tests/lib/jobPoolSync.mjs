/** Keep in sync with src/lib/jobPoolSync.ts */

const TERMINAL = new Set(['Completed', 'Cancelled', 'No Show']);
const LIVE_TABS = new Set(['offer', 'assign', 'active', 'queue']);
const POOL_UA = new Set(['Pending', 'No One', 'Scheduled']);

export const OPTIMISTIC_LIVE_RETAIN_MS = 8_000;

const optimisticLiveUntil = new Map();

export function markOptimisticLiveTransition(jobId, now = Date.now()) {
  optimisticLiveUntil.set(jobId, now + OPTIMISTIC_LIVE_RETAIN_MS);
}

export function clearOptimisticLiveTransition(jobId) {
  optimisticLiveUntil.delete(jobId);
}

function normalizeJobStatus(st) {
  const s = String(st || '').trim();
  if (s === 'Unassigned') return 'Pending';
  return s;
}

function jobTabForStatus(job) {
  const st = normalizeJobStatus(job.status);
  if (st === 'Queued') return 'queue';
  if (st === 'Active' || st === 'OnTrip') return 'active';
  if (st === 'Assigned' || st === 'Picking' || st === 'Arrived') return 'assign';
  if (st === 'Offered') return 'offer';
  return 'ua';
}

function isPoolUaStatus(status) {
  return POOL_UA.has(normalizeJobStatus(status));
}

function isWithinOptimisticWindow(jobId, now = Date.now()) {
  const until = optimisticLiveUntil.get(jobId);
  if (until == null) return false;
  if (now >= until) {
    optimisticLiveUntil.delete(jobId);
    return false;
  }
  return true;
}

export function shouldPreserveAbsentStoreJob(job, pendingRef, bookingsRef, now = Date.now()) {
  if (TERMINAL.has(normalizeJobStatus(job.status))) return false;
  const tab = jobTabForStatus(job);
  if (tab === 'ua') return true;
  if (!LIVE_TABS.has(tab)) return false;
  if (pendingRef.has(job.id) || bookingsRef.has(job.id)) return true;
  if (isPoolUaStatus(job.status)) return true;
  return isWithinOptimisticWindow(job.id, now);
}

/** Simulate syncAll merge: store jobs absent from Firebase caches. */
export function mergeStoreWithFirebaseCaches(storeJobs, pendingRef, bookingsRef, now = Date.now()) {
  const byId = new Map();
  for (const j of pendingRef.values()) byId.set(j.id, j);
  for (const j of bookingsRef.values()) byId.set(j.id, j);
  for (const j of storeJobs) {
    if (byId.has(j.id)) continue;
    if (shouldPreserveAbsentStoreJob(j, pendingRef, bookingsRef, now)) {
      byId.set(j.id, j);
    }
  }
  return Array.from(byId.values());
}
