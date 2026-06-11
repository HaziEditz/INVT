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
  setSelectedJobId: (id: number | null) => void;
  setActiveTab: (tab: JobTab) => void;
  jobsForTab: (tab: JobTab) => Job[];
  countForTab: (tab: JobTab) => number;
}

export const useJobStore = create<JobStore>((set, get) => ({
  jobs: [],
  removedJobIds: [],
  selectedJobId: null,
  activeTab: 'ua',
  setJobs: (jobs) => set({ jobs }),
  upsertJob: (job) =>
    set((s) => {
      const idx = s.jobs.findIndex((j) => j.id === job.id);
      if (idx >= 0) {
        const next = [...s.jobs];
        next[idx] = { ...next[idx], ...job };
        return { jobs: next };
      }
      return { jobs: [...s.jobs, job] };
    }),
  removeJob: (id) =>
    set((s) => ({
      jobs: s.jobs.filter((j) => j.id !== id),
      removedJobIds: s.removedJobIds.includes(id) ? s.removedJobIds : [...s.removedJobIds, id],
      selectedJobId: s.selectedJobId === id ? null : s.selectedJobId,
    })),
  clearRemovedJob: (id) =>
    set((s) => ({ removedJobIds: s.removedJobIds.filter((x) => x !== id) })),
  setSelectedJobId: (id) => set({ selectedJobId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  jobsForTab: (tab) => {
    const jobs = get().jobs;
    return jobs
      .filter((j) => jobTabForStatus(j) === tab)
      .sort((a, b) => {
        const ca = a.createdAt || 0;
        const cb = b.createdAt || 0;
        if (cb !== ca) return cb - ca;
        return b.id - a.id;
      });
  },
  countForTab: (tab) => get().jobsForTab(tab).length,
}));
