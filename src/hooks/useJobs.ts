import { useEffect, useRef, useState } from 'react';
import { getDb, ref, onValue } from '@/lib/firebase';
import { useJobStore } from '@/store/jobStore';
import { jobFromFirebase, type Job } from '@/types/job';

function mergeJobs(maps: Map<number, Job>[]): Job[] {
  const byId = new Map<number, Job>();
  for (const m of maps) {
    for (const [id, job] of m) byId.set(id, { ...byId.get(id), ...job });
  }
  return Array.from(byId.values());
}

export function useJobs(companyId: string | null) {
  const setJobs = useJobStore((s) => s.setJobs);
  const pendingRef = useRef<Map<number, Job>>(new Map());
  const bookingsRef = useRef<Map<number, Job>>(new Map());

  useEffect(() => {
    if (!companyId) return;
    const db = getDb();

    const sync = () => {
      setJobs(mergeJobs([bookingsRef.current, pendingRef.current]));
    };

    const pRef = ref(db, `pendingjobs/${companyId}`);
    const bRef = ref(db, `allbookings/${companyId}`);

    const unsubPending = onValue(pRef, (snap) => {
      pendingRef.current = new Map();
      const val = snap.val();
      if (val && typeof val === 'object') {
        for (const [key, rec] of Object.entries(val as Record<string, Record<string, unknown>>)) {
          const job = jobFromFirebase(key, rec, companyId);
          if (job) pendingRef.current.set(job.id, job);
        }
      }
      sync();
    });

    const unsubBookings = onValue(bRef, (snap) => {
      bookingsRef.current = new Map();
      const val = snap.val();
      if (val && typeof val === 'object') {
        for (const [key, rec] of Object.entries(val as Record<string, Record<string, unknown>>)) {
          const job = jobFromFirebase(key, rec, companyId);
          if (!job) continue;
          const active = ['Assigned', 'Picking', 'Arrived', 'Active', 'OnTrip', 'Queued', 'Offered'].includes(job.status);
          if (active) bookingsRef.current.set(job.id, job);
        }
      }
      sync();
    });

    return () => {
      unsubPending();
      unsubBookings();
    };
  }, [companyId, setJobs]);
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
