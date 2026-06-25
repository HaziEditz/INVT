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
export const DISPATCH_POOL_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function recordActivityMs(rec) {
  if (!rec || typeof rec !== 'object') return 0;
  const fields = [
    rec.lastUpdatedAt, rec.LastUpdatedAt, rec.updatedAt, rec.UpdatedAt,
    rec.jobUpdatedAt, rec.JobUpdatedAt,
    rec.createdAt, rec.CreatedAt,
    rec.queuedAt, rec.QueuedAt,
    rec.assignedAt, rec.AssignedAt,
    rec.offeredAt, rec.OfferedAt,
    rec.BookingDateTime, rec.bookingDateTime,
  ];
  let best = 0;
  for (const raw of fields) {
    if (raw == null || raw === '') continue;
    const n = Number(raw);
    if (!Number.isNaN(n) && n > 0) {
      const ms = n < 1e12 ? n * 1000 : n;
      if (ms > best) best = ms;
      continue;
    }
    const p = Date.parse(String(raw));
    if (!Number.isNaN(p) && p > 0 && p > best) best = p;
  }
  return best;
}

export function jobActivityMs(job) {
  return job.jobUpdatedAt ?? job.createdAt ?? 0;
}

export function isDispatchPoolRowLive(bookingId, rec, pendingRef, now = Date.now()) {
  if (isQueueAwaitingAllbookings(bookingId)) return true;
  if (isOfferAwaitingAllbookings(bookingId, now)) return true;
  if (isWithinOptimisticWindow(bookingId, now)) return true;
  const recordMs = recordActivityMs(rec);
  if (recordMs > 0 && now - recordMs <= DISPATCH_POOL_MAX_AGE_MS) return true;
  const pending = pendingRef.get(bookingId);
  if (pending) {
    const pendingMs = jobActivityMs(pending);
    if (pendingMs > 0 && now - pendingMs <= DISPATCH_POOL_MAX_AGE_MS) return true;
  }
  return false;
}

const optimisticLiveUntil = new Map();
const queueAwaitingAllbookings = new Set();
const offerAwaitingAllbookings = new Map();

export function markOptimisticLiveTransition(jobId, now = Date.now()) {
  optimisticLiveUntil.set(jobId, now + OPTIMISTIC_LIVE_RETAIN_MS);
}

export function clearOptimisticLiveTransition(jobId) {
  optimisticLiveUntil.delete(jobId);
}

export function markQueueAwaitingAllbookings(jobId) {
  queueAwaitingAllbookings.add(jobId);
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

export function isQueueAwaitingAllbookings(jobId) {
  return queueAwaitingAllbookings.has(jobId);
}

export function queueAwaitingMergeOpts(jobId) {
  return isQueueAwaitingAllbookings(jobId) ? { forceStatus: 'Queued' } : undefined;
}

export function allbookingsRecordIsQueued(rec) {
  const bookingRaw = rec.BookingStatus ?? rec.bookingStatus;
  if (bookingRaw != null && normalizeJobStatus(String(bookingRaw)) === 'Queued') return true;
  const statusRaw = rec.Status ?? rec.status;
  if (statusRaw != null && normalizeJobStatus(String(statusRaw)) === 'Queued') return true;
  if (String(rec.eventType ?? rec.EventType ?? '').toLowerCase() === 'queued') return true;
  return rec.queuedAt != null || rec.QueuedAt != null;
}

export function purgeStalePendingForQueuedBookings(pendingRef, bookingsRef, storeJobs = []) {
  for (const id of [...pendingRef.keys()]) {
    if (isQueueAwaitingAllbookings(id)) {
      pendingRef.delete(id);
      continue;
    }
    const booking = bookingsRef.get(id);
    if (booking && normalizeJobStatus(booking.status) === 'Queued') {
      pendingRef.delete(id);
      continue;
    }
    const store = storeJobs.find((j) => j.id === id);
    if (store && normalizeJobStatus(store.status) === 'Queued') {
      pendingRef.delete(id);
    }
  }
}

export function pendingSnapshotWouldRegressQueue(bookingId, pjVal, ctx) {
  const pjSt = normalizeJobStatus(String(pjVal.BookingStatus ?? pjVal.Status ?? pjVal.status ?? ''));
  if (pjSt === 'Queued') return false;

  const bookingsQueued =
    !!ctx?.bookingsRef &&
    normalizeJobStatus(ctx.bookingsRef.get(bookingId)?.status ?? '') === 'Queued';
  const abQueued = ctx?.abRec ? allbookingsRecordIsQueued(ctx.abRec) : false;

  if (bookingsQueued || abQueued) {
    return pjSt !== 'Offered';
  }

  if (!isQueueAwaitingAllbookings(bookingId)) return false;
  return pjSt !== 'Offered';
}

function coerceQueuedIfAwaiting(job) {
  if (!isQueueAwaitingAllbookings(job.id)) return job;
  return normalizeJobStatus(job.status) === 'Queued' ? job : { ...job, status: 'Queued' };
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

export function reinjectQueueAwaitingJobs(bookingsRef, storeJobs, pendingRef) {
  for (const j of storeJobs) {
    if (!isQueueAwaitingAllbookings(j.id)) continue;
    pendingRef?.delete(j.id);
    bookingsRef.set(j.id, coerceQueuedIfAwaiting(j));
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
  if (s === 'queued' || s === 'QUEUED') return 'Queued';
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

export { jobTabForStatus };

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
  if (pendingRef.has(job.id) || bookingsRef.has(job.id)) return true;
  if (isQueueAwaitingAllbookings(job.id)) return true;
  if (normalizeJobStatus(job.status) === 'Offered' && isOfferAwaitingAllbookings(job.id, now)) {
    return true;
  }
  if (isWithinOptimisticWindow(job.id, now)) return true;
  const activityMs = jobActivityMs(job);
  if (activityMs > 0 && now - activityMs <= DISPATCH_POOL_MAX_AGE_MS) return true;
  return false;
}

/** Simulate syncAll merge: store jobs absent from Firebase caches. */
export function mergeStoreWithFirebaseCaches(storeJobs, pendingRef, bookingsRef, now = Date.now()) {
  purgeStalePendingForQueuedBookings(pendingRef, bookingsRef, storeJobs);
  reinjectQueueAwaitingJobs(bookingsRef, storeJobs, pendingRef);
  const byId = new Map();
  for (const j of pendingRef.values()) byId.set(j.id, j);
  for (const j of bookingsRef.values()) {
    const prev = byId.get(j.id);
    const opts = queueAwaitingMergeOpts(j.id);
    byId.set(j.id, prev ? mergeJobRank(prev, j, opts) : opts ? mergeJobRank(j, { status: 'Queued' }, opts) : j);
  }
  for (const j of storeJobs) {
    if (byId.has(j.id)) continue;
    if (shouldPreserveAbsentStoreJob(j, pendingRef, bookingsRef, now)) {
      byId.set(
        j.id,
        isQueueAwaitingAllbookings(j.id) ? { ...j, status: 'Queued' } : j,
      );
    }
  }
  for (const [id, job] of byId) {
    if (!isQueueAwaitingAllbookings(id)) continue;
    const storeJob = storeJobs.find((j) => j.id === id);
    const base = storeJob ?? job;
    byId.set(id, { ...base, status: 'Queued' });
  }
  return Array.from(byId.values());
}

const STATUS_RANK = {
  Pending: 1,
  Offered: 2,
  Queued: 3,
  Assigned: 4,
  Active: 7,
};

function statusRank(st) {
  return STATUS_RANK[normalizeJobStatus(st)] ?? 1;
}

function mergeJobRank(existing, incoming, opts) {
  if (opts?.forceStatus) return { ...existing, ...incoming, status: opts.forceStatus };
  const inc = incoming.status ?? existing.status;
  if (statusRank(inc) < statusRank(existing.status)) return { ...existing, ...incoming, status: existing.status };
  return { ...existing, ...incoming };
}

/** Simulate queue accept: refresh arrives before allbookings/pending snapshot. */
export function applyQueueAcceptOptimistic(companyId, bookingId, driverId, pendingRef, bookingsRef, storeJobs, now = Date.now()) {
  const refresh = { action: 'queue', status: 'Queued', driverId: String(driverId), updateSeq: 2 };
  const job = minimalJobFromDispatchRefresh(bookingId, companyId, refresh);
  if (!job) return storeJobs;
  pendingRef.delete(bookingId);
  bookingsRef.set(bookingId, job);
  markQueueAwaitingAllbookings(bookingId);
  markOptimisticLiveTransition(bookingId, now);
  const nextStore = [...storeJobs.filter((j) => j.id !== bookingId), job];
  reinjectQueueAwaitingJobs(bookingsRef, nextStore, pendingRef);
  return mergeStoreWithFirebaseCaches(nextStore, pendingRef, bookingsRef, now);
}
