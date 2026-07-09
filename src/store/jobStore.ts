import { mergeJobUpdate } from '@/lib/mergeJob';
import { create } from 'zustand';
import type { Job, JobTab } from '@/types/job';
import { jobScheduledTime } from '@/types/job';
import { ACTIVE_BOOKING_STATUSES, jobTabForStatus, normalizeJobStatus } from '@/lib/jobStatusAuthority';
import { queueAwaitingMergeOpts } from '@/lib/jobPoolSync';
import {
  EMPTY_LIVE_JOB_FILTERS,
  filterLiveJobs,
  hasActiveLiveJobFilters,
  type LiveJobFilters,
} from '@/lib/liveJobFilters';
import type { CompanyZone } from '@/lib/companyZones';

interface JobStore {
  jobs: Job[];
  removedJobIds: number[];
  selectedJobId: number | null;
  hoveredJobId: number | null;
  activeTab: JobTab;
  liveJobFilters: LiveJobFilters;
  setJobs: (jobs: Job[]) => void;
  upsertJob: (job: Job) => void;
  /** Authoritative status refresh — merges BookingStatus/updateSeq into existing store row. */
  replaceJob: (job: Job) => void;
  removeJob: (id: number) => void;
  clearRemovedJob: (id: number) => void;
  isJobBlacklisted: (id: number) => boolean;
  setSelectedJobId: (id: number | null) => void;
  setHoveredJobId: (id: number | null) => void;
  setActiveTab: (tab: JobTab) => void;
  setLiveJobFilters: (partial: Partial<LiveJobFilters>) => void;
  clearLiveJobFilters: () => void;
}

function uaPickupSortKey(job: Job): number {
  return jobScheduledTime(job)?.getTime() ?? job.createdAt ?? Number.MAX_SAFE_INTEGER;
}

function sortJobsForTab(jobs: Job[], tab: JobTab): Job[] {
  return [...jobs].sort((a, b) => {
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

export function filterJobsForTab(
  jobs: Job[],
  tab: JobTab,
  filters: LiveJobFilters = EMPTY_LIVE_JOB_FILTERS,
  zones: CompanyZone[] = [],
): Job[] {
  const tabbed = jobs.filter((j) => jobTabForStatus(j) === tab);
  const filtered = hasActiveLiveJobFilters(filters)
    ? filterLiveJobs(tabbed, filters, zones)
    : tabbed;
  return sortJobsForTab(filtered, tab);
}

export function countJobsForTab(
  jobs: Job[],
  tab: JobTab,
  filters: LiveJobFilters = EMPTY_LIVE_JOB_FILTERS,
  zones: CompanyZone[] = [],
): { shown: number; total: number } {
  const tabbed = jobs.filter((j) => jobTabForStatus(j) === tab);
  const total = tabbed.length;
  const shown = hasActiveLiveJobFilters(filters)
    ? filterLiveJobs(tabbed, filters, zones).length
    : total;
  return { shown, total };
}

function isLivePoolStatus(status: string): boolean {
  return ACTIVE_BOOKING_STATUSES.has(normalizeJobStatus(status));
}

/** Status-only merge for authoritative refresh — keep offeredAt, addresses, etc. from store. */
function mergeReplaceJobStatus(existing: Job, incoming: Job): Job {
  const merged: Job = { ...existing };
  if (incoming.status != null) {
    merged.status = incoming.status;
  }
  if (incoming.updateSeq != null) {
    merged.updateSeq = Math.max(existing.updateSeq ?? 0, incoming.updateSeq);
  }
  return merged;
}

export const useJobStore = create<JobStore>((set, get) => ({
  jobs: [],
  removedJobIds: [],
  selectedJobId: null,
  hoveredJobId: null,
  activeTab: 'ua',
  liveJobFilters: { ...EMPTY_LIVE_JOB_FILTERS },
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
  replaceJob: (job) =>
    set((s) => {
      const live = isLivePoolStatus(job.status);
      const removedJobIds = live
        ? s.removedJobIds.filter((id) => id !== job.id)
        : s.removedJobIds;
      if (!live && removedJobIds.includes(job.id)) return s;
      const idx = s.jobs.findIndex((j) => j.id === job.id);
      if (idx >= 0) {
        const next = [...s.jobs];
        next[idx] = mergeReplaceJobStatus(s.jobs[idx], job);
        return { jobs: next, removedJobIds };
      }
      return { jobs: [...s.jobs, job], removedJobIds };
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
  setLiveJobFilters: (partial) =>
    set((s) => ({ liveJobFilters: { ...s.liveJobFilters, ...partial } })),
  clearLiveJobFilters: () => set({ liveJobFilters: { ...EMPTY_LIVE_JOB_FILTERS } }),
}));
