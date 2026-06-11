import { create } from 'zustand';
import type { Job, JobTab } from '@/types/job';
import { jobTabForStatus } from '@/types/job';

interface JobStore {
  jobs: Job[];
  removedJobIds: number[];
  selectedJobId: number | null;
  activeTab: JobTab;
  setJobs: (jobs: Job[]) => void;
  upsertJob: (job: Job) => void;
  removeJob: (id: number) => void;
  clearRemovedJob: (id: number) => void;
  isJobBlacklisted: (id: number) => boolean;
  setSelectedJobId: (id: number | null) => void;
  setActiveTab: (tab: JobTab) => void;
}

export function filterJobsForTab(jobs: Job[], tab: JobTab): Job[] {
  return jobs
    .filter((j) => jobTabForStatus(j) === tab)
    .sort((a, b) => {
      const ca = a.createdAt || 0;
      const cb = b.createdAt || 0;
      if (cb !== ca) return cb - ca;
      return b.id - a.id;
    });
}

export const useJobStore = create<JobStore>((set, get) => ({
  jobs: [],
  removedJobIds: [],
  selectedJobId: null,
  activeTab: 'ua',
  setJobs: (jobs) => set({ jobs: [...jobs] }),
  upsertJob: (job) =>
    set((s) => {
      if (s.removedJobIds.includes(job.id)) return s;
      const idx = s.jobs.findIndex((j) => j.id === job.id);
      if (idx >= 0) {
        const next = [...s.jobs];
        next[idx] = { ...next[idx], ...job };
        return { jobs: next };
      }
      return { jobs: [...s.jobs, job] };
    }),
  removeJob: (id) =>
    set((s) => {
      if (s.removedJobIds.includes(id)) {
        return {
          jobs: s.jobs.filter((j) => j.id !== id),
          selectedJobId: s.selectedJobId === id ? null : s.selectedJobId,
        };
      }
      return {
        jobs: s.jobs.filter((j) => j.id !== id),
        removedJobIds: [...s.removedJobIds, id],
        selectedJobId: s.selectedJobId === id ? null : s.selectedJobId,
      };
    }),
  clearRemovedJob: (id) =>
    set((s) => ({ removedJobIds: s.removedJobIds.filter((x) => x !== id) })),
  isJobBlacklisted: (id) => get().removedJobIds.includes(id),
  setSelectedJobId: (id) => set({ selectedJobId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
