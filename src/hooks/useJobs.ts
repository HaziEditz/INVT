import { useEffect, useRef, useState } from 'react';
import { getDb, ref, onValue, onChildAdded, onChildChanged, onChildRemoved, get } from '@/lib/firebase';
import { useJobStore } from '@/store/jobStore';
import { useUiStore } from '@/store/uiStore';
import { jobFromFirebase, jobTabForStatus, type Job } from '@/types/job';
import { playNewJobSound } from '@/lib/notifySound';

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
  const removeJob = useJobStore((s) => s.removeJob);
  const pendingRef = useRef<Map<number, Job>>(new Map());
  const bookingsRef = useRef<Map<number, Job>>(new Map());
  const knownPendingIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!companyId) return;
    const db = getDb();
    const childUnsubs: Array<() => void> = [];

    const sync = () => {
      setJobs(mergeJobs([bookingsRef.current, pendingRef.current]));
    };

    const notifyNewJob = (job: Job) => {
      if (!isUaJob(job)) return;
      playNewJobSound();
      useUiStore.getState().addToast({
        type: 'info',
        title: `New job #${job.id}`,
        message: job.pickAddress || undefined,
      });
    };

    const applyPending = (key: string, rec: Record<string, unknown>, isNew: boolean) => {
      const job = jobFromFirebase(key, rec, companyId);
      if (!job) return;
      pendingRef.current.set(job.id, job);
      sync();
      if (isNew) notifyNewJob(job);
    };

    const pRef = ref(db, `pendingjobs/${companyId}`);
    const bRef = ref(db, `allbookings/${companyId}`);

    knownPendingIds.current = new Set();

    get(pRef)
      .then((snap) => {
        pendingRef.current = new Map();
        const val = snap.val();
        if (val && typeof val === 'object') {
          for (const [key, rec] of Object.entries(val as Record<string, Record<string, unknown>>)) {
            const job = jobFromFirebase(key, rec, companyId);
            if (job) {
              pendingRef.current.set(job.id, job);
              knownPendingIds.current.add(job.id);
            }
          }
        }
        sync();

        childUnsubs.push(
          onChildAdded(pRef, (snap) => {
            const val = snap.val();
            if (!val || typeof val !== 'object') return;
            const job = jobFromFirebase(snap.key!, val as Record<string, unknown>, companyId);
            if (!job) return;
            const isNew = !knownPendingIds.current.has(job.id);
            knownPendingIds.current.add(job.id);
            applyPending(snap.key!, val as Record<string, unknown>, isNew);
          })
        );

        childUnsubs.push(
          onChildChanged(pRef, (snap) => {
            const val = snap.val();
            if (!val || typeof val !== 'object') return;
            applyPending(snap.key!, val as Record<string, unknown>, false);
          })
        );

        childUnsubs.push(
          onChildRemoved(pRef, (snap) => {
            const id = parseInt(snap.key || '0', 10);
            if (!id) return;
            pendingRef.current.delete(id);
            knownPendingIds.current.delete(id);
            removeJob(id);
            sync();
          })
        );
      })
      .catch(() => {});

    const unsubBookings = onValue(bRef, (snap) => {
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
      sync();
    });

    return () => {
      for (const unsub of childUnsubs) unsub();
      unsubBookings();
    };
  }, [companyId, setJobs, removeJob]);
}

export function useClosedJobs(companyId: string | null, enabled: boolean) {
  const [closed, setClosed] = useState<Job[]>([]);

  useEffect(() => {
    if (!companyId || !enabled) return;
    const db = getDb();
    const paths = [`completedJobs/${companyId}`, `closedJobs/${companyId}`];
    const maps: Job[][] = [[], []];

    const unsubs = paths.map((p, i) => {
      const r = ref(db, p);
      return onValue(r, (snap) => {
        const list: Job[] = [];
        const val = snap.val();
        if (val && typeof val === 'object') {
          for (const [key, rec] of Object.entries(val as Record<string, Record<string, unknown>>)) {
            const job = jobFromFirebase(key, rec, companyId);
            if (job) {
              job.status = 'Completed';
              list.push(job);
            }
          }
        }
        maps[i] = list;
        const merged = new Map<number, Job>();
        for (const arr of maps) for (const j of arr) merged.set(j.id, j);
        setClosed(Array.from(merged.values()).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)));
      });
    });

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [companyId, enabled]);

  return closed;
}
