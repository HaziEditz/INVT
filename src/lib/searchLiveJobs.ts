import type { Job, JobTab } from '@/types/job';
import { jobTabForStatus, normalizeJobStatus } from '@/types/job';

const TERMINAL = new Set(['Completed', 'Cancelled', 'No Show']);

const TAB_LABELS: Record<JobTab, string> = {
  ua: 'U-A',
  offer: 'Offer',
  assign: 'Assign',
  active: 'Active',
  queue: 'Queue',
  dy: 'DY',
};

export type LiveJobSearchHit = {
  job: Job;
  tab: JobTab;
  tabLabel: string;
};

export function jobTabDisplayLabel(tab: JobTab): string {
  return TAB_LABELS[tab] ?? tab.toUpperCase();
}

export function isLiveDispatchJob(job: Job): boolean {
  return !TERMINAL.has(normalizeJobStatus(job.status));
}

/** Concatenated searchable text for partial matching (legacy Filter haystack). */
export function buildJobSearchHaystack(job: Job): string {
  return [
    job.id,
    job.passengerName,
    job.passengerPhone,
    job.pickAddress,
    job.dropAddress,
    job.driverName,
    job.driverId,
    job.vehicleNo,
    job.vehicleId,
    job.status,
    job.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function searchLiveJobs(jobs: Job[], query: string, limit = 50): LiveJobSearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const hits: LiveJobSearchHit[] = [];
  for (const job of jobs) {
    if (!isLiveDispatchJob(job)) continue;
    if (!buildJobSearchHaystack(job).includes(q)) continue;
    const tab = jobTabForStatus(job);
    hits.push({ job, tab, tabLabel: jobTabDisplayLabel(tab) });
    if (hits.length >= limit) return hits;
  }

  hits.sort((a, b) => {
    const idCmp = a.job.id - b.job.id;
    if (idCmp !== 0) return idCmp;
    return a.tabLabel.localeCompare(b.tabLabel);
  });
  return hits;
}
