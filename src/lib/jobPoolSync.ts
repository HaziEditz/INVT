import {
  jobTabForStatus,
  normalizeJobStatus,
  type Job,
  type JobTab,
} from '@/types/job';

export const TERMINAL_BOOKING_STATUSES = new Set(['Completed', 'Cancelled', 'No Show']);

const LIVE_DISPATCH_STATUSES = new Set([
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

function seqFromRecord(rec: Record<string, unknown> | null | undefined): number {
  if (!rec || typeof rec !== 'object') return 0;
  const raw = rec.updateSeq ?? rec._seq ?? rec.version;
  const n = parseInt(String(raw ?? ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Stale terminal allbookings from a prior trip with the same booking Id must not
 * evict a live job that pendingjobs / store already show as active.
 */
export function staleTerminalAllbookingsSuperseded(
  jobId: number,
  abRec: Record<string, unknown>,
  pendingRef: Map<number, Job>,
  bookingsRef: Map<number, Job>,
  storeJobs: Job[] = [],
): boolean {
  const abStatus = normalizeJobStatus(
    String(abRec.BookingStatus ?? abRec.Status ?? abRec.status ?? ''),
  );
  if (!TERMINAL_BOOKING_STATUSES.has(abStatus)) return false;

  const abSeq = seqFromRecord(abRec);
  const candidates: Job[] = [];
  const pending = pendingRef.get(jobId);
  const booking = bookingsRef.get(jobId);
  const store = storeJobs.find((j) => j.id === jobId);
  if (pending) candidates.push(pending);
  if (booking) candidates.push(booking);
  if (store) candidates.push(store);

  for (const job of candidates) {
    const st = normalizeJobStatus(job.status);
    if (!LIVE_DISPATCH_STATUSES.has(st)) continue;
    const jobSeq = job.updateSeq ?? 0;
    if (jobSeq > abSeq) return true;
    if (jobSeq === abSeq && st !== abStatus) return true;
  }
  return false;
}

/** Live store/pending row that outranks a stale terminal allbookings snapshot. */
export function pickLiveJobSupersedingStaleTerminal(
  jobId: number,
  abRec: Record<string, unknown>,
  pendingRef: Map<number, Job>,
  bookingsRef: Map<number, Job>,
  storeJobs: Job[] = [],
): Job | null {
  const abStatus = normalizeJobStatus(
    String(abRec.BookingStatus ?? abRec.Status ?? abRec.status ?? ''),
  );
  if (!TERMINAL_BOOKING_STATUSES.has(abStatus)) return null;

  const abSeq = seqFromRecord(abRec);
  const candidates: Job[] = [];
  const pending = pendingRef.get(jobId);
  const booking = bookingsRef.get(jobId);
  const store = storeJobs.find((j) => j.id === jobId);
  if (pending) candidates.push(pending);
  if (booking) candidates.push(booking);
  if (store) candidates.push(store);

  let best: Job | null = null;
  for (const job of candidates) {
    const st = normalizeJobStatus(job.status);
    if (!LIVE_DISPATCH_STATUSES.has(st) || TERMINAL_BOOKING_STATUSES.has(st)) continue;
    const jobSeq = job.updateSeq ?? 0;
    const supersedes = jobSeq > abSeq || (jobSeq === abSeq && st !== abStatus);
    if (!supersedes) continue;
    if (!best || jobSeq > (best.updateSeq ?? 0)) best = job;
  }
  return best;
}

export const LIVE_DISPATCH_TABS = new Set<JobTab>(['offer', 'assign', 'active', 'queue']);

const POOL_UA_STATUSES = new Set<Job['status']>(['Pending', 'No One', 'Scheduled']);

/** Brief window to retain live-tab jobs during accept/assign Firebase races. */
export const OPTIMISTIC_LIVE_RETAIN_MS = 8_000;

/** Queue jobs stay visible until allbookings confirms Queued (no time cap). */
export const QUEUE_AWAIT_ALLBOOKINGS_MS = 120_000; // legacy — retained for tests/docs only

/** Offered jobs stay on the Offer tab until allbookings confirms (or this cap). */
export const OFFER_AWAIT_ALLBOOKINGS_MS = 120_000;

const optimisticLiveUntil = new Map<number, number>();
/** Booking ids optimistically queued — cleared only when allbookings confirms Queued or job is terminal. */
const queueAwaitingAllbookings = new Set<number>();
const offerAwaitingAllbookings = new Map<number, number>();

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

/** Suppress stale live allbookings rows briefly after a job completes. */
export const COMPLETED_SUPPRESS_MS = 90_000;

/** Orphan cleanup window — only rows meeting ALL orphan criteria and older than this are removed. */
export const DISPATCH_POOL_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const ORPHAN_ELIGIBLE_STATUSES = new Set(['Pending', 'No One', 'Queued']);

const LIVE_LIFECYCLE_STATUSES = new Set([
  'Active',
  'Picking',
  'Arrived',
  'OnTrip',
  'Assigned',
  'Offered',
  'Scheduled',
]);

export function isUnassignedDriverId(driverId: unknown): boolean {
  const d = String(driverId ?? '').trim();
  return !d || d === '0' || d === '-1' || d === '-2';
}

export function hasRealPassengerData(rec: Record<string, unknown>): boolean {
  const name = String(rec.Name ?? rec.PassengerName ?? rec.passengerName ?? rec.passengername ?? '').trim();
  const phone = String(
    rec.PhoneNo ?? rec.Phone ?? rec.passengerPhone ?? rec.phone ?? rec.PhoneNumber ?? '',
  ).trim();
  const pick = String(
    rec.PickAddress ?? rec.PickupAddress ?? rec.pickAddress ?? rec.pickupAddress ?? '',
  ).trim();
  const drop = String(rec.DropAddress ?? rec.dropAddress ?? '').trim();
  return !!(name || phone || pick || drop);
}

export function hasRealPassengerDataFromJob(job: Job): boolean {
  return !!(
    job.passengerName?.trim() ||
    job.passengerPhone?.trim() ||
    job.pickAddress?.trim() ||
    job.dropAddress?.trim()
  );
}

function recordPoolStatus(rec: Record<string, unknown>): string {
  const raw = String(rec.BookingStatus ?? rec.bookingStatus ?? rec.Status ?? rec.status ?? '').trim();
  return raw === 'NoOne' ? 'No One' : normalizeJobStatus(raw);
}

/** Pending / No One, or Queued without a queuedAt timestamp (test-session ghosts). */
export function isOrphanEligiblePoolStatus(rec: Record<string, unknown>): boolean {
  const st = recordPoolStatus(rec);
  if (st === 'Pending' || st === 'No One') return true;
  if (st === 'Queued') {
    const queuedAt = rec.queuedAt ?? rec.QueuedAt;
    return queuedAt == null || queuedAt === '';
  }
  return false;
}

/**
 * True only when ALL orphan criteria match — safe to hide from dispatch UI or cancel via cleanup.
 * Real customer bookings (passenger details, assigned driver, active lifecycle, scheduled, etc.) are never orphans.
 */
export function isStaleOrphanAllbookingsRow(
  rec: Record<string, unknown>,
  now = Date.now(),
  opts?: { maxAgeMs?: number },
): boolean {
  const st = recordPoolStatus(rec);
  if (LIVE_LIFECYCLE_STATUSES.has(st as Job['status'])) return false;
  if (TERMINAL_BOOKING_STATUSES.has(st as Job['status'])) return false;

  if (!isOrphanEligiblePoolStatus(rec)) return false;
  if (!isUnassignedDriverId(rec.DriverId ?? rec.driverId ?? rec.AssignedDriverId ?? rec.assignedDriverId)) {
    return false;
  }
  if (hasRealPassengerData(rec)) return false;

  const maxAgeMs = opts?.maxAgeMs ?? DISPATCH_POOL_MAX_AGE_MS;
  const activityMs = recordActivityMs(rec);
  if (activityMs > 0 && now - activityMs <= maxAgeMs) return false;
  if (activityMs === 0) return false;

  return true;
}

function isStaleOrphanJobShell(job: Job, now = Date.now()): boolean {
  const st = normalizeJobStatus(job.status);
  if (LIVE_LIFECYCLE_STATUSES.has(st)) return false;
  if (TERMINAL_BOOKING_STATUSES.has(st)) return false;
  if (!ORPHAN_ELIGIBLE_STATUSES.has(st)) return false;
  if (st === 'Queued') return false;
  if (!isUnassignedDriverId(job.driverId)) return false;
  if (hasRealPassengerDataFromJob(job)) return false;
  const activityMs = jobActivityMs(job);
  if (activityMs > 0 && now - activityMs <= DISPATCH_POOL_MAX_AGE_MS) return false;
  if (activityMs === 0) return false;
  return true;
}

export function recordActivityMs(rec: Record<string, unknown>): number {
  const fields = [
    rec.lastUpdatedAt,
    rec.LastUpdatedAt,
    rec.updatedAt,
    rec.UpdatedAt,
    rec.jobUpdatedAt,
    rec.JobUpdatedAt,
    rec.createdAt,
    rec.CreatedAt,
    rec.queuedAt,
    rec.QueuedAt,
    rec.assignedAt,
    rec.AssignedAt,
    rec.offeredAt,
    rec.OfferedAt,
    rec.BookingDateTime,
    rec.bookingDateTime,
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

export function jobActivityMs(job: Job): number {
  return job.jobUpdatedAt ?? job.createdAt ?? 0;
}

/** Ingest pool rows unless they are confirmed stale orphans (all criteria — see isStaleOrphanAllbookingsRow). */
export function isDispatchPoolRowLive(
  bookingId: number,
  rec: Record<string, unknown>,
  pendingRef: Map<number, Job>,
  now = Date.now(),
): boolean {
  if (isQueueAwaitingAllbookings(bookingId)) return true;
  if (isOfferAwaitingAllbookings(bookingId, now)) return true;
  if (isWithinOptimisticWindow(bookingId, now)) return true;

  const pending = pendingRef.get(bookingId);
  if (pending && !isStaleOrphanJobShell(pending, now)) return true;

  return !isStaleOrphanAllbookingsRow(rec, now);
}

const completedSuppressUntil = new Map<number, number>();

export function markCompletedJobSuppress(jobId: number, now = Date.now()): void {
  completedSuppressUntil.set(jobId, now + COMPLETED_SUPPRESS_MS);
}

export function clearCompletedJobSuppress(jobId: number): void {
  completedSuppressUntil.delete(jobId);
}

/** True while stale Active/Assigned snapshots must not re-enter the live pool. */
export function isCompletedJobSuppressed(jobId: number, now = Date.now()): boolean {
  const until = completedSuppressUntil.get(jobId);
  if (until == null) return false;
  if (now >= until) {
    completedSuppressUntil.delete(jobId);
    return false;
  }
  return true;
}

export function markQueueAwaitingAllbookings(jobId: number): void {
  queueAwaitingAllbookings.add(jobId);
}

export function clearQueueAwaitingAllbookings(jobId: number): void {
  queueAwaitingAllbookings.delete(jobId);
}

export function markOfferAwaitingAllbookings(jobId: number, now = Date.now()): void {
  offerAwaitingAllbookings.set(jobId, now + OFFER_AWAIT_ALLBOOKINGS_MS);
}

export function clearOfferAwaitingAllbookings(jobId: number): void {
  offerAwaitingAllbookings.delete(jobId);
}

export function isOfferAwaitingAllbookings(jobId: number, now = Date.now()): boolean {
  const until = offerAwaitingAllbookings.get(jobId);
  if (until == null) return false;
  if (now >= until) {
    offerAwaitingAllbookings.delete(jobId);
    return false;
  }
  return true;
}

export function isQueueAwaitingAllbookings(jobId: number): boolean {
  return queueAwaitingAllbookings.has(jobId);
}

/** mergeJobUpdate opts while queue-await is active for a booking. */
export function queueAwaitingMergeOpts(
  jobId: number,
): { forceStatus: Job['status'] } | undefined {
  return isQueueAwaitingAllbookings(jobId) ? { forceStatus: 'Queued' } : undefined;
}

export type PendingQueueRegressCtx = {
  bookingsRef?: Map<number, Job>;
  abRec?: Record<string, unknown> | null;
};

/** True when allbookings (or mirror fields) confirms Queued. */
export function allbookingsRecordIsQueued(rec: Record<string, unknown>): boolean {
  const bookingRaw = rec.BookingStatus ?? rec.bookingStatus;
  if (bookingRaw != null && normalizeJobStatus(String(bookingRaw)) === 'Queued') return true;
  const statusRaw = rec.Status ?? rec.status;
  if (statusRaw != null && normalizeJobStatus(String(statusRaw)) === 'Queued') return true;
  if (String(rec.eventType ?? rec.EventType ?? '').toLowerCase() === 'queued') return true;
  return rec.queuedAt != null || rec.QueuedAt != null;
}

/**
 * Drop stale pendingjobs rows when bookingsRef or allbookings already confirms Queued.
 * Also clears queue-await ids (handled before reinject).
 */
export function purgeStalePendingForQueuedBookings(
  pendingRef: Map<number, Job>,
  bookingsRef: Map<number, Job>,
  storeJobs: Job[] = [],
): void {
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

  if (!isQueueAwaitingAllbookings(bookingId)) return false;
  return pjSt !== 'Offered';
}

/** Force Queued status for jobs in the queue-await window. */
export function coerceQueuedIfAwaiting(job: Job): Job {
  if (!isQueueAwaitingAllbookings(job.id)) return job;
  return normalizeJobStatus(job.status) === 'Queued' ? job : { ...job, status: 'Queued' };
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
  pendingRef?: Map<number, Job>,
): void {
  for (const j of storeJobs) {
    if (!isQueueAwaitingAllbookings(j.id)) continue;
    pendingRef?.delete(j.id);
    const queued = coerceQueuedIfAwaiting(j);
    bookingsRef.set(j.id, queued);
  }
}

/** Re-inject Offered jobs when pendingjobs/allbookings lag behind dispatch refresh. */
export function reinjectOfferAwaitingJobs(
  bookingsRef: Map<number, Job>,
  pendingRef: Map<number, Job>,
  storeJobs: Job[],
  now = Date.now(),
): void {
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

function isPoolUaStatus(status: string): boolean {
  return POOL_UA_STATUSES.has(normalizeJobStatus(status) as Job['status']);
}

export function isWithinOptimisticWindow(jobId: number, now = Date.now()): boolean {
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
  if (isCompletedJobSuppressed(job.id, now)) return false;
  if (TERMINAL_BOOKING_STATUSES.has(normalizeJobStatus(job.status))) return false;
  if (pendingRef.has(job.id) || bookingsRef.has(job.id)) return true;
  if (isQueueAwaitingAllbookings(job.id)) return true;
  if (normalizeJobStatus(job.status) === 'Offered' && isOfferAwaitingAllbookings(job.id, now)) {
    return true;
  }
  if (isWithinOptimisticWindow(job.id, now)) return true;
  const st = normalizeJobStatus(job.status);
  if (LIVE_LIFECYCLE_STATUSES.has(st)) return true;
  if (hasRealPassengerDataFromJob(job)) return true;
  if (!isUnassignedDriverId(job.driverId)) return true;
  if (st === 'Queued') return true;
  if (isStaleOrphanJobShell(job, now)) return false;
  return false;
}
