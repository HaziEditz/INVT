import { mergeJobUpdate } from '@/lib/mergeJob';
import { create } from 'zustand';
import type { Job, JobTab } from '@/types/job';
import { jobScheduledTime } from '@/types/job';
import { ACTIVE_BOOKING_STATUSES, jobTabForStatus, normalizeJobStatus } from '@/lib/jobStatusAuthority';
import { queueAwaitingMergeOpts } from '@/lib/jobPoolSync';

interface JobStore {
  jobs: Job[];
  removedJobIds: number[];
  selectedJobId: number | null;
  hoveredJobId: number | null;
  activeTab: JobTab;
  setJobs: (jobs: Job[]) => void;
  upsertJob: (job: Job) => void;
  removeJob: (id: number) => void;
  clearRemovedJob: (id: number) => void;
  isJobBlacklisted: (id: number) => boolean;
  setSelectedJobId: (id: number | null) => void;
  setHoveredJobId: (id: number | null) => void;
  setActiveTab: (tab: JobTab) => void;
}

function uaPickupSortKey(job: Job): number {
  return jobScheduledTime(job)?.getTime() ?? job.createdAt ?? Number.MAX_SAFE_INTEGER;
}

export function filterJobsForTab(jobs: Job[], tab: JobTab): Job[] {
  return jobs
    .filter((j) => jobTabForStatus(j) === tab)
    .sort((a, b) => {
      if (tab === 'ua') {
        const pa = uaPickupSortKey(a);
        const pb = uaPickupSortKey(b);
        if (pa !== pb) return pa - pb;
        return a.id - b.id;
      }
      const ca = a.createdAt || 0;
      const cb = b.createdAt || 0;
      if (ca !== cb) return ca - cb;
      return a.id - b.id;
    });
}

function isLivePoolStatus(status: string): boolean {
  return ACTIVE_BOOKING_STATUSES.has(normalizeJobStatus(status));
}

export const useJobStore = create<JobStore>((set, get) => ({
  jobs: [],
  removedJobIds: [],
  selectedJobId: null,
  hoveredJobId: null,
  activeTab: 'ua',
  setJobs: (jobs) => set({ jobs: [...jobs] }),
  upsertJob: (job) =>
    set((s) => {
      const live = isLivePoolStatus(job.status);
      const removedJobIds = live
        ? s.removedJobIds.filter((id) => id !== job.id)
        : s.removedJobIds;
      if (!live && removedJobIds.includes(job.id)) return s;
      const queueOpts = queueAwaitingMergeOpts(job.id);
      const idx = s.jobs.findIndex((j) => j.id === job.id);
      if (idx >= 0) {
        const prev = s.jobs[idx];
        const next = [...s.jobs];
        const merged = mergeJobUpdate(prev, job, queueOpts);
        const prevTab = jobTabForStatus(prev);
        const incomingTab = jobTabForStatus(job);
        const mergedTab = jobTabForStatus(merged);
        if (prevTab === 'queue' && mergedTab !== 'queue') {
          console.log('[queue-edit-pin]', {
            phase: 'jobStore.upsertJob-left-queue',
            jobId: job.id,
            prev: { status: prev.status, driverId: prev.driverId, tab: prevTab },
            incoming: { status: job.status, driverId: job.driverId, tab: incomingTab },
            merged: { status: merged.status, driverId: merged.driverId, tab: mergedTab },
            queueOpts: queueOpts ?? null,
            at: Date.now(),
          });
        }
        next[idx] = merged;
        return { jobs: next };
      }
      const inserted = queueOpts
        ? mergeJobUpdate(job as Job, { status: 'Queued' }, queueOpts)
        : job;
      return { jobs: [...s.jobs, inserted] };
    }),
  removeJob: (id) =>
    set((s) => {
      if (s.removedJobIds.includes(id)) {
        return {
          jobs: s.jobs.filter((j) => j.id !== id),
          selectedJobId: s.selectedJobId === id ? null : s.selectedJobId,
          hoveredJobId: s.hoveredJobId === id ? null : s.hoveredJobId,
        };
      }
      return {
        jobs: s.jobs.filter((j) => j.id !== id),
        removedJobIds: [...s.removedJobIds, id],
        selectedJobId: s.selectedJobId === id ? null : s.selectedJobId,
        hoveredJobId: s.hoveredJobId === id ? null : s.hoveredJobId,
      };
    }),
  clearRemovedJob: (id) =>
    set((s) => ({ removedJobIds: s.removedJobIds.filter((x) => x !== id) })),
  isJobBlacklisted: (id) => get().removedJobIds.includes(id),
  setSelectedJobId: (id) => {
    if (id === null) console.trace('[Store] selectedJobId cleared to null');
    set({ selectedJobId: id });
  },
  setHoveredJobId: (id) => set({ hoveredJobId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
