import { useEffect, useRef, useState } from 'react';
import { getDb, ref, onValue, onChildAdded, onChildChanged, onChildRemoved } from '@/lib/firebase';
import { useJobStore } from '@/store/jobStore';
import { useUiStore } from '@/store/uiStore';
import { jobFromFirebase, normalizeJobStatus, type Job } from '@/types/job';
import { playNewJobSound } from '@/lib/notifySound';
import { isExternalJobSource } from '@/lib/utils';

function mergeJobs(maps: Map<number, Job>[]): Job[] {
  const byId = new Map<number, Job>();
  for (const m of maps) {
    for (const [id, job] of m) {
      const prev = byId.get(id);
      byId.set(id, prev ? { ...prev, ...job } : job);
    }
  }
  return Array.from(byId.values());
}

function isUaJob(job: Job): boolean {
  return jobTabForStatus(job) === 'ua';
}

export function useJobs(companyId: string | null) {
  const setJobs = useJobStore((s) => s.setJobs);
  const upsertJob = useJobStore((s) => s.upsertJob);
  const removeJob = useJobStore((s) => s.removeJob);
  const clearRemovedJob = useJobStore((s) => s.clearRemovedJob);
  const pendingRef = useRef<Map<number, Job>>(new Map());
  const bookingsRef = useRef<Map<number, Job>>(new Map());

  useEffect(() => {
    if (!companyId) return;
    const db = getDb();
    const unsubs: Array<() => void> = [];
    let bootstrapping = true;

    const syncAll = () => {
      const removed = new Set(useJobStore.getState().removedJobIds);
      const merged = mergeJobs([bookingsRef.current, pendingRef.current]).filter(
        (j) => !removed.has(j.id)
      );
      const byId = new Map(merged.map((j) => [j.id, j]));
      // Keep optimistic U-A jobs until Firebase pendingjobs confirms them
      for (const j of useJobStore.getState().jobs) {
        if (!byId.has(j.id) && jobTabForStatus(j) === 'ua' && !removed.has(j.id)) {
          byId.set(j.id, j);
        }
      }
      setJobs(Array.from(byId.values()));
    };

    const notifyNewJob = (job: Job) => {
      if (!isUaJob(job) || !isExternalJobSource(job.source)) return;
      playNewJobSound();
      useUiStore.getState().addToast({
        type: 'info',
        title: `New job #${job.id}`,
        message: job.pickAddress || undefined,
      });
    };

    const applyPending = (key: string, rec: Record<string, unknown>, notify: boolean) => {
      const job = jobFromFirebase(key, rec, companyId);
      if (!job) return;
      pendingRef.current.set(job.id, job);
      const booking = bookingsRef.current.get(job.id);
      const merged = booking ? { ...booking, ...job } : job;
      upsertJob(merged);
      syncAll();
      if (notify) notifyNewJob(job);
    };

    const pRef = ref(db, `pendingjobs/${companyId}`);
    const bRef = ref(db, `allbookings/${companyId}`);

    unsubs.push(
      onChildAdded(pRef, (snap) => {
        const val = snap.val();
        if (!val || typeof val !== 'object') return;
        applyPending(snap.key!, val as Record<string, unknown>, !bootstrapping);
      })
    );

    // Existing children fire synchronously during onChildAdded registration
    bootstrapping = false;

    unsubs.push(
      onChildChanged(pRef, (snap) => {
        const val = snap.val();
        if (!val || typeof val !== 'object') return;
        applyPending(snap.key!, val as Record<string, unknown>, false);
      })
    );

    unsubs.push(
      onChildRemoved(pRef, (snap) => {
        const id = parseInt(snap.key || '0', 10);
        if (!id) return;
        pendingRef.current.delete(id);
        removeJob(id);
        clearRemovedJob(id);
        syncAll();
      })
    );

    unsubs.push(
      onValue(bRef, (snap) => {
        bookingsRef.current = new Map();
        const val = snap.val();
        if (val && typeof val === 'object') {
          for (const [key, rec] of Object.entries(val as Record<string, Record<string, unknown>>)) {
            const job = jobFromFirebase(key, rec, companyId);
            if (!job) continue;
            const active = ['Assigned', 'Picking', 'Arrived', 'Active', 'OnTrip', 'Queued', 'Offered'].includes(
              job.status
            );
            if (active) bookingsRef.current.set(job.id, job);
          }
        }
        syncAll();
      })
    );

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [companyId, setJobs, upsertJob, removeJob, clearRemovedJob]);
}

export function useClosedJobs(companyId: string | null, enabled: boolean) {
  const [closed, setClosed] = useState<Job[]>([]);

  useEffect(() => {
    if (!companyId || !enabled) return;
    const db = getDb();
    const maps: Job[][] = [[], [], []];

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
            job.completedAt = at ? Date.parse(at) || job.completedAt : job.completedAt;
          } else {
            job.status = 'Completed';
          }
          list.push(job);
        }
      }
      maps[idx] = list;
      const merged = new Map<number, Job>();
      for (const arr of maps) for (const j of arr) merged.set(j.id, j);
      setClosed(
        Array.from(merged.values()).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
      );
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
        const merged = new Map<number, Job>();
        for (const arr of maps) for (const j of arr) merged.set(j.id, j);
        setClosed(
          Array.from(merged.values()).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
        );
      }),
    ];

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [companyId, enabled]);

  return closed;
}
