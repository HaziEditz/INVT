import { useEffect, useRef, useState } from 'react';
import { mergeJobUpdate } from '@/lib/mergeJob';
import { getDb, ref, onValue, onChildAdded, onChildChanged, onChildRemoved, get } from '@/lib/firebase';
import { useJobStore } from '@/store/jobStore';
import { useUiStore } from '@/store/uiStore';
import {
  jobFromFirebase,
  jobStatusFromFirebaseRecord,
  jobTabForStatus,
  normalizeJobStatus,
  isPreBookedJob,
  jobDispatchTime,
  type Job,
} from '@/types/job';
import {
  markOptimisticLiveTransition,
  markQueueAwaitingAllbookings,
  clearQueueAwaitingAllbookings,
  minimalJobFromDispatchRefresh,
  reinjectQueueAwaitingJobs,
  shouldPreserveAbsentStoreJob,
} from '@/lib/jobPoolSync';
import { isExternalJobSource } from '@/lib/utils';

function mergeJobs(maps: Map<number, Job>[]): Job[] {
  const byId = new Map<number, Job>();
  for (const m of maps) {
    for (const [id, job] of m) {
      const prev = byId.get(id);
      byId.set(id, prev ? mergeJobUpdate(prev, job) : job);
    }
  }
  return Array.from(byId.values());
}

function isUaJob(job: Job): boolean {
  return jobTabForStatus(job) === 'ua';
}

function isBlacklisted(jobId: number): boolean {
  return useJobStore.getState().isJobBlacklisted(jobId);
}

/** Purge cancelled job from in-memory listener caches so it cannot reappear. */
export function purgeCancelledJobFromListeners(jobId: number) {
  listenerPendingCache?.delete(jobId);
  listenerBookingsCache?.delete(jobId);
}

let listenerPendingCache: Map<number, Job> | null = null;
let listenerBookingsCache: Map<number, Job> | null = null;

const ACTIVE_BOOKING_STATUSES = new Set([
  'Assigned',
  'Picking',
  'Arrived',
  'Active',
  'OnTrip',
  'Queued',
  'Offered',
]);

const TERMINAL_BOOKING_STATUSES = new Set(['Completed', 'Cancelled', 'No Show']);

type DispatchRefreshPayload = {
  action?: string;
  status?: string;
  driverId?: string;
  declinedDriverId?: string;
  returnReason?: string;
  updateSeq?: number;
};

function notifyOfferReturned(bookingId: number, refresh: DispatchRefreshPayload) {
  const action = refresh.action;
  if (action !== 'timeout' && action !== 'decline') return;
  const drv = String(refresh.declinedDriverId || refresh.driverId || '').trim();
  const who = drv && drv !== '0' ? `Driver ${drv}` : 'Driver';
  const verb = action === 'timeout' ? 'did not respond to' : 'declined';
  useUiStore.getState().addToast({
    type: 'warning',
    title: `Offer returned — job #${bookingId}`,
    message: `${who} ${verb} job #${bookingId} — returned to pending.`,
    category: 'general',
  });
}

const POOL_RESTORE_ACTIONS = new Set(['status', 'timeout', 'decline', 'recall', 'scheduled_release']);

const POOL_UA_STATUSES = new Set<Job['status']>(['Pending', 'No One', 'Scheduled']);
const LIVE_OFFER_STATUSES = new Set(['Offered', 'Assigned']);

function isPoolUaStatus(status: string): boolean {
  return POOL_UA_STATUSES.has(normalizeJobStatus(status) as Job['status']);
}

function pendingjobsAbsentIsPoolRestore(
  job: Job | null,
  refresh: DispatchRefreshPayload,
): boolean {
  if (!job) return false;
  if (!isPoolUaStatus(job.status)) return false;
  if (POOL_RESTORE_ACTIONS.has(refresh.action || '')) return true;
  return normalizeJobStatus(refresh.status || '') === normalizeJobStatus(job.status);
}

function pendingSnapshotWouldRegressPool(
  refresh: DispatchRefreshPayload,
  pjVal: Record<string, unknown>,
): boolean {
  if (!refresh.status) return false;
  const target = normalizeJobStatus(refresh.status);
  if (target !== 'Pending' && target !== 'No One') return false;
  if (!POOL_RESTORE_ACTIONS.has(refresh.action || '')) return false;
  const pjSt = normalizeJobStatus(String(pjVal.BookingStatus ?? pjVal.Status ?? pjVal.status ?? ''));
  return LIVE_OFFER_STATUSES.has(pjSt);
}

function seqFromFirebaseRecord(rec: Record<string, unknown> | null | undefined): number | undefined {
  if (!rec || typeof rec !== 'object') return undefined;
  const raw = rec.updateSeq ?? rec._seq ?? rec.version;
  const n = parseInt(String(raw ?? ''), 10);
  return Number.isNaN(n) ? undefined : n;
}

function resolveRefreshDriverId(
  refresh: DispatchRefreshPayload,
  targetStatus: Job['status'],
  job: Job | null,
  prior: Job | null,
): string {
  if (targetStatus === 'No One') return '-1';
  if (targetStatus === 'Pending') {
    if (POOL_RESTORE_ACTIONS.has(refresh.action || '')) return '0';
    if (refresh.driverId === '0' || refresh.driverId === '') return '0';
  }
  if (refresh.driverId !== undefined && refresh.driverId !== null && refresh.driverId !== '') {
    return String(refresh.driverId);
  }
  return job?.driverId ?? prior?.driverId ?? '0';
}

function existingJobSnapshot(
  bookingId: number,
  pendingRef: Map<number, Job>,
  bookingsRef: Map<number, Job>,
): Job | null {
  return (
    bookingsRef.get(bookingId) ??
    pendingRef.get(bookingId) ??
    useJobStore.getState().jobs.find((j) => j.id === bookingId) ??
    null
  );
}

function refreshImpliesTerminal(refresh: DispatchRefreshPayload): boolean {
  if (refresh.action === 'cancel' || refresh.action === 'complete') return true;
  if (!refresh.status) return false;
  return TERMINAL_BOOKING_STATUSES.has(normalizeJobStatus(refresh.status));
}

function applyRefreshStatusHint(
  job: Job | null,
  prior: Job | null,
  refresh: DispatchRefreshPayload,
  bookingId: number,
): Job | null {
  if (!refresh.status) return job;
  const targetStatus = normalizeJobStatus(refresh.status);
  const driverId = resolveRefreshDriverId(refresh, targetStatus, job, prior);
  const updateSeq = refresh.updateSeq ?? job?.updateSeq ?? prior?.updateSeq;
  const patch = { status: targetStatus, driverId, ...(updateSeq != null ? { updateSeq } : {}) } as Job;
  if (job) {
    return mergeJobUpdate(job, patch);
  }
  if (prior && !useJobStore.getState().isJobBlacklisted(bookingId)) {
    return mergeJobUpdate(prior, patch);
  }
  return job;
}

/** Apply dispatchConsole refresh hint immediately — avoids Assign-tab flash while Firebase catches up. */
function optimisticDispatchRefresh(
  companyId: string,
  bookingId: number,
  refresh: DispatchRefreshPayload,
  pendingRef: Map<number, Job>,
  bookingsRef: Map<number, Job>,
  upsertJob: (job: Job) => void,
  syncAll: () => void,
): void {
  if (refreshImpliesTerminal(refresh) || !refresh.status) return;
  if (useJobStore.getState().isJobBlacklisted(bookingId)) return;

  const prior = existingJobSnapshot(bookingId, pendingRef, bookingsRef);
  let job: Job | null = null;
  if (prior) {
    job = applyRefreshStatusHint(null, prior, refresh, bookingId);
  } else if (refresh.action === 'queue') {
    job = minimalJobFromDispatchRefresh(bookingId, companyId, refresh);
  }
  if (!job) return;

  pendingRef.delete(bookingId);
  const st = normalizeJobStatus(job.status);
  if (ACTIVE_BOOKING_STATUSES.has(st)) {
    bookingsRef.set(job.id, job);
  } else if (st === 'Pending' || st === 'No One') {
    pendingRef.set(job.id, job);
    bookingsRef.delete(bookingId);
  }
  if (refresh.action === 'queue' && st === 'Queued') {
    markQueueAwaitingAllbookings(bookingId);
  }
  if (['accept', 'assign', 'offer', 'queue', 'active'].includes(refresh.action || '')) {
    markOptimisticLiveTransition(bookingId);
  }
  upsertJob(job);
  syncAll();
}

/** Server wrote dispatchConsole/{cid}/refresh — re-read Firebase for one job (or full sync). */
async function refreshJobFromFirebaseCaches(
  companyId: string,
  bookingId: number,
  refresh: DispatchRefreshPayload,
  pendingRef: Map<number, Job>,
  bookingsRef: Map<number, Job>,
  hooks: {
    applyPending: (key: string, rec: Record<string, unknown>, notify: boolean) => void;
    removeJob: (id: number) => void;
    clearRemovedJob: (id: number) => void;
    syncAll: () => void;
  },
) {
  const action = refresh.action;
  const prior = existingJobSnapshot(bookingId, pendingRef, bookingsRef);

  if (refreshImpliesTerminal(refresh)) {
    pendingRef.delete(bookingId);
    bookingsRef.delete(bookingId);
    hooks.removeJob(bookingId);
    hooks.clearRemovedJob(bookingId);
    hooks.syncAll();
    return;
  }

  const db = getDb();
  const [abSnap, pjSnap] = await Promise.all([
    get(ref(db, `allbookings/${companyId}/${bookingId}`)),
    get(ref(db, `pendingjobs/${companyId}/${bookingId}`)),
  ]);

  pendingRef.delete(bookingId);

  let job: Job | null = null;
  const abVal = abSnap.val();
  if (abVal && typeof abVal === 'object') {
    const rec = abVal as Record<string, unknown>;
    const parsed = jobFromFirebase(String(bookingId), rec, companyId);
    if (parsed && !useJobStore.getState().isJobBlacklisted(parsed.id)) {
      const st = normalizeJobStatus(String(rec.BookingStatus ?? rec.Status ?? rec.status ?? parsed.status));
      if (ACTIVE_BOOKING_STATUSES.has(st)) {
        job = parsed;
      } else if (TERMINAL_BOOKING_STATUSES.has(st)) {
        bookingsRef.delete(bookingId);
        hooks.removeJob(bookingId);
        hooks.clearRemovedJob(bookingId);
        hooks.syncAll();
        return;
      } else if (action !== 'accept' && action !== 'assign' && action !== 'offer' && action !== 'queue' && action !== 'active') {
        bookingsRef.delete(bookingId);
      }
    }
  } else if (action === 'cancel') {
    bookingsRef.delete(bookingId);
  }

  if (!job && prior && ['accept', 'assign', 'offer', 'active', 'queue'].includes(action || '')) {
    job = applyRefreshStatusHint(null, prior, refresh, bookingId);
  }

  if (action === 'queue') {
    markQueueAwaitingAllbookings(bookingId);
  }

  job = applyRefreshStatusHint(job, prior, refresh, bookingId);

  const pjVal = pjSnap.val();
  const pjRecord = pjVal && typeof pjVal === 'object' ? (pjVal as Record<string, unknown>) : null;
  const fbSeq = seqFromFirebaseRecord(abVal as Record<string, unknown>) ?? seqFromFirebaseRecord(pjRecord);
  if (job && fbSeq != null && (job.updateSeq ?? 0) < fbSeq) {
    job = mergeJobUpdate(job, { updateSeq: fbSeq } as Job);
  }

  if (job && !useJobStore.getState().isJobBlacklisted(job.id)) {
    const st = jobStatusFromFirebaseRecord(
      abVal && typeof abVal === 'object'
        ? (abVal as Record<string, unknown>)
        : { BookingStatus: job.status, Status: job.status },
    );
    if (st !== job.status) {
      job = mergeJobUpdate(job, { status: st } as Job);
    }
    if (st === 'Queued') {
      clearQueueAwaitingAllbookings(bookingId);
    }
    if (ACTIVE_BOOKING_STATUSES.has(st)) {
      bookingsRef.set(job.id, job);
    } else if (st === 'Pending' || st === 'No One') {
      pendingRef.set(job.id, job);
      bookingsRef.delete(bookingId);
    } else if (TERMINAL_BOOKING_STATUSES.has(st)) {
      bookingsRef.delete(bookingId);
      hooks.removeJob(bookingId);
      hooks.clearRemovedJob(bookingId);
      hooks.syncAll();
      return;
    }
  }

  if (pjRecord) {
    if (pendingSnapshotWouldRegressPool(refresh, pjRecord)) {
      if (import.meta.env.DEV) {
        console.warn(
          `[dispatch-refresh] ignored stale pendingjobs #${bookingId}`,
          pjRecord.BookingStatus ?? pjRecord.Status,
          '→ refresh',
          refresh.status,
        );
      }
      if (job) pendingRef.set(job.id, job);
    } else {
      hooks.applyPending(String(bookingId), pjRecord, false);
    }
  } else {
    if (!pendingjobsAbsentIsPoolRestore(job, refresh)) {
      pendingRef.delete(bookingId);
    } else if (job) {
      pendingRef.set(job.id, job);
    }
    const liveActions = new Set(['accept', 'assign', 'offer', 'queue', 'active', 'status', 'timeout', 'decline', 'recall', 'scheduled_release']);
    if (action === 'cancel') {
      hooks.removeJob(bookingId);
      hooks.clearRemovedJob(bookingId);
    } else if (!liveActions.has(action || '') && !job) {
      hooks.removeJob(bookingId);
      hooks.clearRemovedJob(bookingId);
    }
  }

  hooks.syncAll();
}

export function useJobs(companyId: string | null) {
  const setJobs = useJobStore((s) => s.setJobs);
  const upsertJob = useJobStore((s) => s.upsertJob);
  const removeJob = useJobStore((s) => s.removeJob);
  const clearRemovedJob = useJobStore((s) => s.clearRemovedJob);
  const pendingRef = useRef<Map<number, Job>>(new Map());
  const bookingsRef = useRef<Map<number, Job>>(new Map());
  const lastDispatchRefreshAtRef = useRef(0);

  useEffect(() => {
    if (!companyId) return;
    const db = getDb();
    const unsubs: Array<() => void> = [];
    let bootstrapping = true;

    listenerPendingCache = pendingRef.current;
    listenerBookingsCache = bookingsRef.current;

    const syncAll = () => {
      const removed = new Set(useJobStore.getState().removedJobIds);
      const merged = mergeJobs([pendingRef.current, bookingsRef.current]).filter(
        (j) => !removed.has(j.id)
      );
      const byId = new Map(merged.map((j) => [j.id, j]));
      const storeJobs = useJobStore.getState().jobs;
      for (const [id, job] of byId) {
        const existing = storeJobs.find((j) => j.id === id);
        if (existing) byId.set(id, mergeJobUpdate(existing, job));
      }
      for (const j of storeJobs) {
        if (byId.has(j.id) || removed.has(j.id)) continue;
        if (shouldPreserveAbsentStoreJob(j, pendingRef.current, bookingsRef.current)) {
          byId.set(j.id, j);
        }
      }
      setJobs(Array.from(byId.values()));
    };

    const notifyNewJob = (job: Job) => {
      if (!isUaJob(job) || !isExternalJobSource(job.source)) return;
      useUiStore.getState().addToast({
        type: 'info',
        title: `New job #${job.id}`,
        message: job.pickAddress || undefined,
        category: 'new_booking',
      });
    };

    const applyPending = (key: string, rec: Record<string, unknown>, notify: boolean) => {
      const jobId = parseInt(String(rec.BookingId ?? rec.bookingId ?? key), 10);
      if (!jobId || isBlacklisted(jobId)) return;

      const job = jobFromFirebase(key, rec, companyId);
      if (!job || isBlacklisted(job.id)) return;

      const effectiveStatus = jobStatusFromFirebaseRecord(rec);
      if (TERMINAL_BOOKING_STATUSES.has(effectiveStatus)) {
        pendingRef.current.delete(job.id);
        bookingsRef.current.delete(job.id);
        removeJob(job.id);
        clearRemovedJob(job.id);
        syncAll();
        return;
      }

      pendingRef.current.set(job.id, job);
      const booking = bookingsRef.current.get(job.id);
      const storeJob = useJobStore.getState().jobs.find((j) => j.id === job.id);
      let merged = booking ? mergeJobUpdate(booking, job) : job;
      if (storeJob) merged = mergeJobUpdate(storeJob, merged);
      upsertJob(merged);
      syncAll();
      if (notify) notifyNewJob(job);
    };

    const jobsRef = ref(db, `pendingjobs/${companyId}`);
    const bRef = ref(db, `allbookings/${companyId}`);

    const addJobToStore = (snap: { key: string | null; val: () => unknown }) => {
      const jobId = parseInt(snap.key || '0', 10);
      if (!jobId || isBlacklisted(jobId)) return;
      const val = snap.val();
      if (!val || typeof val !== 'object') return;
      applyPending(snap.key!, val as Record<string, unknown>, !bootstrapping);
    };

    const updateJobInStore = (snap: { key: string | null; val: () => unknown }) => {
      const jobId = parseInt(snap.key || '0', 10);
      if (!jobId || isBlacklisted(jobId)) return;
      const val = snap.val();
      if (!val || typeof val !== 'object') return;
      applyPending(snap.key!, val as Record<string, unknown>, false);
    };

    const removeJobFromStore = (snap: { key: string | null }) => {
      const jobId = parseInt(snap.key || '0', 10);
      if (!jobId) return;
      pendingRef.current.delete(jobId);
      // pendingjobs DELETE is normal after accept/queue — do not purge live jobs here.
      // refreshJobFromFirebaseCaches + allbookings own removal; deleting here caused Assign-tab flash.
      syncAll();
    };

    unsubs.push(onChildAdded(jobsRef, addJobToStore));

    // Existing children fire synchronously during onChildAdded registration
    bootstrapping = false;

    unsubs.push(onChildChanged(jobsRef, updateJobInStore));
    unsubs.push(onChildRemoved(jobsRef, removeJobFromStore));

    unsubs.push(
      onValue(bRef, (snap) => {
        bookingsRef.current = new Map();
        const terminalIds: number[] = [];
        const val = snap.val();
        if (val && typeof val === 'object') {
          for (const [key, rec] of Object.entries(val as Record<string, Record<string, unknown>>)) {
            const jobId = parseInt(String(rec.BookingId ?? rec.bookingId ?? key), 10);
            if (!jobId || isBlacklisted(jobId)) continue;

            const job = jobFromFirebase(key, rec, companyId);
            if (!job || isBlacklisted(job.id)) continue;

            // Prefer record-level resolution (BookingStatus wins over stale Status: Pending).
            const effectiveStatus = jobStatusFromFirebaseRecord(rec);
            const stored =
              effectiveStatus !== job.status ? { ...job, status: effectiveStatus } : job;

            if (TERMINAL_BOOKING_STATUSES.has(effectiveStatus)) {
              terminalIds.push(stored.id);
              continue;
            }

            if (ACTIVE_BOOKING_STATUSES.has(effectiveStatus)) {
              bookingsRef.current.set(stored.id, stored);
              if (effectiveStatus === 'Queued') {
                clearQueueAwaitingAllbookings(stored.id);
              }
            } else if (isPoolUaStatus(effectiveStatus)) {
              pendingRef.current.set(stored.id, stored);
            }
          }
        }
        reinjectQueueAwaitingJobs(bookingsRef.current, useJobStore.getState().jobs);
        for (const tid of terminalIds) {
          pendingRef.current.delete(tid);
          bookingsRef.current.delete(tid);
          removeJob(tid);
          clearRemovedJob(tid);
        }
        syncAll();
      })
    );

    unsubs.push(
      onValue(ref(db, `dispatchConsole/${companyId}/refresh`), (snap) => {
        const v = snap.val() as {
          at?: number;
          bookingId?: number;
          action?: string;
          status?: string;
          driverId?: string | number;
          declinedDriverId?: string;
          returnReason?: string;
          updateSeq?: number;
        } | null;
        if (!v?.at || v.at === lastDispatchRefreshAtRef.current) return;
        lastDispatchRefreshAtRef.current = v.at;
        const bid = parseInt(String(v.bookingId ?? '0'), 10);
        if (!bid) {
          syncAll();
          return;
        }
        const refreshPayload: DispatchRefreshPayload = {
          action: v.action,
          status: v.status,
          driverId: v.driverId != null ? String(v.driverId) : undefined,
          declinedDriverId: v.declinedDriverId,
          returnReason: v.returnReason,
          updateSeq:
            v.updateSeq != null
              ? parseInt(String(v.updateSeq), 10)
              : undefined,
        };
        notifyOfferReturned(bid, refreshPayload);
        optimisticDispatchRefresh(
          companyId,
          bid,
          refreshPayload,
          pendingRef.current,
          bookingsRef.current,
          upsertJob,
          syncAll,
        );
        void refreshJobFromFirebaseCaches(
          companyId,
          bid,
          refreshPayload,
          pendingRef.current,
          bookingsRef.current,
          {
            applyPending,
            removeJob,
            clearRemovedJob,
            syncAll,
          },
        );
      })
    );

    return () => {
      for (const u of unsubs) u();
      if (listenerPendingCache === pendingRef.current) listenerPendingCache = null;
      if (listenerBookingsCache === bookingsRef.current) listenerBookingsCache = null;
    };
  }, [companyId, setJobs, upsertJob, removeJob, clearRemovedJob]);

  return useJobStore((s) => s.jobs);
}

const dispatchNowNotifiedRef = { current: new Set<number>() };

/** Fire toast + alert sound when a pre-booked job enters its dispatch window. */
export function useDispatchWindowAlerts(jobs: Job[]) {
  useEffect(() => {
    const now = new Date();
    for (const job of jobs) {
      if (jobTabForStatus(job) !== 'ua' || !isPreBookedJob(job, now)) continue;
      const dispatchAt = jobDispatchTime(job);
      if (!dispatchAt || now.getTime() < dispatchAt.getTime()) continue;
      if (dispatchNowNotifiedRef.current.has(job.id)) continue;
      dispatchNowNotifiedRef.current.add(job.id);
      useUiStore.getState().addToast({
        type: 'warning',
        title: 'DISPATCH NOW',
        message: `#${job.id} ${job.pickAddress || 'Ready to assign'}`,
        category: 'general',
      });
    }
  }, [jobs]);
}

export function useClosedJobs(companyId: string | null, enabled: boolean) {
  const [closed, setClosed] = useState<Job[]>([]);

  useEffect(() => {
    if (!companyId || !enabled) return;
    const db = getDb();
    const maps: Job[][] = [[], [], []];

    const mergeAndSet = () => {
      const merged = new Map<number, Job>();
      for (const arr of maps) {
        for (const j of arr) merged.set(j.id, j);
      }
      setClosed(
        Array.from(merged.values()).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)),
      );
    };

    const ingestClosed = (idx: number, snap: { val: () => unknown }) => {
      const list: Job[] = [];
      const val = snap.val();
      if (val && typeof val === 'object') {
        for (const [key, rec] of Object.entries(val as Record<string, Record<string, unknown>>)) {
          const job = jobFromFirebase(key, rec, companyId);
          if (!job) continue;
          const st = normalizeJobStatus(String(rec.BookingStatus ?? rec.Status ?? rec.status ?? job.status));
          if (st === 'Cancelled' || st === 'No Show') {
            job.status = st;
            const at = job.cancelledAt || job.completedAt;
            job.completedAt = at ? Date.parse(String(at)) || job.completedAt : job.completedAt;
          } else {
            job.status = 'Completed';
          }
          list.push(job);
        }
      }
      maps[idx] = list;
      mergeAndSet();
    };

    const unsubs = [
      onValue(ref(db, `completedJobs/${companyId}`), (snap) => ingestClosed(0, snap)),
      onValue(ref(db, `closedJobs/${companyId}`), (snap) => ingestClosed(1, snap)),
      onValue(ref(db, `allbookings/${companyId}`), (snap) => {
        const list: Job[] = [];
        const val = snap.val();
        if (val && typeof val === 'object') {
          for (const [key, rec] of Object.entries(val as Record<string, Record<string, unknown>>)) {
            const st = normalizeJobStatus(String(rec.BookingStatus ?? rec.Status ?? rec.status ?? ''));
            if (st !== 'Cancelled' && st !== 'No Show') continue;
            const job = jobFromFirebase(key, rec, companyId);
            if (!job) continue;
            job.status = st;
            const at = job.cancelledAt || String(rec.cancelledAt ?? '');
            job.completedAt = at ? Date.parse(at) || undefined : undefined;
            list.push(job);
          }
        }
        maps[2] = list;
        mergeAndSet();
      }),
    ];

    return () => {
      for (const u of unsubs) u();
    };
  }, [companyId, enabled]);

  return closed;
}
