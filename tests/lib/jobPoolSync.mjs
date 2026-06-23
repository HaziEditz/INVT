/** Keep in sync with src/lib/jobPoolSync.ts */

const TERMINAL = new Set(['Completed', 'Cancelled', 'No Show']);
const LIVE_DISPATCH = new Set([
  'Offered', 'Queued', 'Assigned', 'Picking', 'Arrived', 'Active', 'OnTrip',
  'Pending', 'No One', 'Scheduled',
]);
const LIVE_TABS = new Set(['offer', 'assign', 'active', 'queue']);
const POOL_UA = new Set(['Pending', 'No One', 'Scheduled']);

export const OPTIMISTIC_LIVE_RETAIN_MS = 8_000;
export const QUEUE_AWAIT_ALLBOOKINGS_MS = 120_000;
export const OFFER_AWAIT_ALLBOOKINGS_MS = 120_000;

const optimisticLiveUntil = new Map();
const queueAwaitingAllbookings = new Map();
const offerAwaitingAllbookings = new Map();

export function markOptimisticLiveTransition(jobId, now = Date.now()) {
  optimisticLiveUntil.set(jobId, now + OPTIMISTIC_LIVE_RETAIN_MS);
}

export function clearOptimisticLiveTransition(jobId) {
  optimisticLiveUntil.delete(jobId);
}

export function markQueueAwaitingAllbookings(jobId, now = Date.now()) {
  queueAwaitingAllbookings.set(jobId, now + QUEUE_AWAIT_ALLBOOKINGS_MS);
}

export function clearQueueAwaitingAllbookings(jobId) {
  queueAwaitingAllbookings.delete(jobId);
}

export function markOfferAwaitingAllbookings(jobId, now = Date.now()) {
  offerAwaitingAllbookings.set(jobId, now + OFFER_AWAIT_ALLBOOKINGS_MS);
}

export function clearOfferAwaitingAllbookings(jobId) {
  offerAwaitingAllbookings.delete(jobId);
}

export function isOfferAwaitingAllbookings(jobId, now = Date.now()) {
  const until = offerAwaitingAllbookings.get(jobId);
  if (until == null) return false;
  if (now >= until) {
    offerAwaitingAllbookings.delete(jobId);
    return false;
  }
  return true;
}

export function isQueueAwaitingAllbookings(jobId, now = Date.now()) {
  const until = queueAwaitingAllbookings.get(jobId);
  if (until == null) return false;
  if (now >= until) {
    queueAwaitingAllbookings.delete(jobId);
    return false;
  }
  return true;
}

export const COMPLETED_SUPPRESS_MS = 90_000;
const completedSuppressUntil = new Map();

export function markCompletedJobSuppress(jobId, now = Date.now()) {
  completedSuppressUntil.set(jobId, now + COMPLETED_SUPPRESS_MS);
}

export function clearCompletedJobSuppress(jobId) {
  completedSuppressUntil.delete(jobId);
}

export function isCompletedJobSuppressed(jobId, now = Date.now()) {
  const until = completedSuppressUntil.get(jobId);
  if (until == null) return false;
  if (now >= until) {
    completedSuppressUntil.delete(jobId);
    return false;
  }
  return true;
}

export function minimalJobFromDispatchRefresh(bookingId, companyId, refresh) {
  if (!refresh.status) return null;
  const status = normalizeJobStatus(refresh.status);
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

export function reinjectQueueAwaitingJobs(bookingsRef, storeJobs, now = Date.now()) {
  for (const j of storeJobs) {
    if (normalizeJobStatus(j.status) !== 'Queued') continue;
    if (bookingsRef.has(j.id)) continue;
    if (!isQueueAwaitingAllbookings(j.id, now)) continue;
    bookingsRef.set(j.id, j);
  }
}

export function reinjectOfferAwaitingJobs(bookingsRef, pendingRef, storeJobs, now = Date.now()) {
  for (const j of storeJobs) {
    if (normalizeJobStatus(j.status) !== 'Offered') continue;
    if (bookingsRef.has(j.id) || pendingRef.has(j.id)) continue;
    if (!isOfferAwaitingAllbookings(j.id, now)) continue;
    bookingsRef.set(j.id, j);
  }
  for (const j of pendingRef.values()) {
    if (normalizeJobStatus(j.status) !== 'Offered') continue;
    if (!bookingsRef.has(j.id)) bookingsRef.set(j.id, j);
  }
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

function seqFromRecord(rec) {
  if (!rec || typeof rec !== 'object') return 0;
  const raw = rec.updateSeq ?? rec._seq ?? rec.version;
  const n = parseInt(String(raw ?? ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Keep in sync with src/lib/jobPoolSync.ts */
export function staleTerminalAllbookingsSuperseded(jobId, abRec, pendingRef, bookingsRef, storeJobs = []) {
  const abStatus = normalizeJobStatus(String(abRec.BookingStatus ?? abRec.Status ?? abRec.status ?? ''));
  if (!TERMINAL.has(abStatus)) return false;

  const abSeq = seqFromRecord(abRec);
  const candidates = [];
  const pending = pendingRef.get(jobId);
  const booking = bookingsRef.get(jobId);
  const store = storeJobs.find((j) => j.id === jobId);
  if (pending) candidates.push(pending);
  if (booking) candidates.push(booking);
  if (store) candidates.push(store);

  for (const job of candidates) {
    const st = normalizeJobStatus(job.status);
    if (!LIVE_DISPATCH.has(st)) continue;
    const jobSeq = job.updateSeq ?? 0;
    if (jobSeq > abSeq) return true;
    if (jobSeq === abSeq && st !== abStatus) return true;
  }
  return false;
}

export function shouldPreserveAbsentStoreJob(job, pendingRef, bookingsRef, now = Date.now()) {
  if (isCompletedJobSuppressed(job.id, now)) return false;
  if (TERMINAL.has(normalizeJobStatus(job.status))) return false;
  const tab = jobTabForStatus(job);
  if (tab === 'ua') return true;
  if (!LIVE_TABS.has(tab)) return false;
  if (pendingRef.has(job.id) || bookingsRef.has(job.id)) return true;
  if (isPoolUaStatus(job.status)) return true;
  if (normalizeJobStatus(job.status) === 'Queued' && isQueueAwaitingAllbookings(job.id, now)) {
    return true;
  }
  if (normalizeJobStatus(job.status) === 'Offered' && isOfferAwaitingAllbookings(job.id, now)) {
    return true;
  }
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

/** Simulate queue accept: refresh arrives before allbookings/pending snapshot. */
export function applyQueueAcceptOptimistic(companyId, bookingId, driverId, pendingRef, bookingsRef, storeJobs, now = Date.now()) {
  const refresh = { action: 'queue', status: 'Queued', driverId: String(driverId), updateSeq: 2 };
  const job = minimalJobFromDispatchRefresh(bookingId, companyId, refresh);
  if (!job) return storeJobs;
  pendingRef.delete(bookingId);
  bookingsRef.set(bookingId, job);
  markQueueAwaitingAllbookings(bookingId, now);
  markOptimisticLiveTransition(bookingId, now);
  const nextStore = [...storeJobs.filter((j) => j.id !== bookingId), job];
  reinjectQueueAwaitingJobs(bookingsRef, nextStore, now);
  return mergeStoreWithFirebaseCaches(nextStore, pendingRef, bookingsRef, now);
}
