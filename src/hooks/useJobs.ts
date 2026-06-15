import { useEffect, useRef, useState } from 'react';
import { mergeJobUpdate } from '@/lib/mergeJob';
import { getDb, ref, onValue, onChildAdded, onChildChanged, onChildRemoved, get } from '@/lib/firebase';
import { useJobStore } from '@/store/jobStore';
import { useUiStore } from '@/store/uiStore';
import { jobFromFirebase, jobTabForStatus, normalizeJobStatus, type Job, type JobTab } from '@/types/job';
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

const LIVE_DISPATCH_TABS = new Set<JobTab>(['offer', 'assign', 'active', 'queue']);

type DispatchRefreshPayload = {
  action?: string;
  status?: string;
  driverId?: string;
};

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
  const driverId = refresh.driverId ?? job?.driverId ?? prior?.driverId;
  if (job) {
    return mergeJobUpdate(job, { status: targetStatus, driverId } as Job);
  }
  if (prior && !useJobStore.getState().isJobBlacklisted(bookingId)) {
    return mergeJobUpdate(prior, { status: targetStatus, driverId } as Job);
  }
  return job;
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

  job = applyRefreshStatusHint(job, prior, refresh, bookingId);

  if (job && !useJobStore.getState().isJobBlacklisted(job.id)) {
    const st = normalizeJobStatus(job.status);
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

  const pjVal = pjSnap.val();
  if (pjVal && typeof pjVal === 'object') {
    hooks.applyPending(String(bookingId), pjVal as Record<string, unknown>, false);
  } else {
    pendingRef.delete(bookingId);
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
      const merged = mergeJobs([bookingsRef.current, pendingRef.current]).filter(
        (j) => !removed.has(j.id)
      );
      const byId = new Map(merged.map((j) => [j.id, j]));
      for (const j of useJobStore.getState().jobs) {
        if (byId.has(j.id) || removed.has(j.id)) continue;
        const tab = jobTabForStatus(j);
        if (tab === 'ua' || LIVE_DISPATCH_TABS.has(tab)) {
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

      pendingRef.current.set(job.id, job);
      const booking = bookingsRef.current.get(job.id);
      const merged = booking ? mergeJobUpdate(booking, job) : job;
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
      const storeJob = useJobStore.getState().jobs.find((j) => j.id === jobId);
      const stillLive =
        !!storeJob &&
        (LIVE_DISPATCH_TABS.has(jobTabForStatus(storeJob)) || bookingsRef.current.has(jobId));
      if (!stillLive) {
        removeJob(jobId);
        clearRemovedJob(jobId);
      }
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
        const val = snap.val();
        if (val && typeof val === 'object') {
          for (const [key, rec] of Object.entries(val as Record<string, Record<string, unknown>>)) {
            const jobId = parseInt(String(rec.BookingId ?? rec.bookingId ?? key), 10);
            if (!jobId || isBlacklisted(jobId)) continue;

            const job = jobFromFirebase(key, rec, companyId);
            if (!job || isBlacklisted(job.id)) continue;

            const active = ACTIVE_BOOKING_STATUSES.has(job.status);
            if (active) bookingsRef.current.set(job.id, job);
          }
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
        } | null;
        if (!v?.at || v.at === lastDispatchRefreshAtRef.current) return;
        lastDispatchRefreshAtRef.current = v.at;
        const bid = parseInt(String(v.bookingId ?? '0'), 10);
        if (!bid) {
          syncAll();
          return;
        }
        void refreshJobFromFirebaseCaches(
          companyId,
          bid,
          {
            action: v.action,
            status: v.status,
            driverId: v.driverId != null ? String(v.driverId) : undefined,
          },
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
          if (st === 'Cancelled') {
            job.status = 'Cancelled';
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
            if (st !== 'Cancelled') continue;
            const job = jobFromFirebase(key, rec, companyId);
            if (!job) continue;
            job.status = 'Cancelled';
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
