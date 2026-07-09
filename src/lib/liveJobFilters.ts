import { findZoneAtCoords, type CompanyZone } from '@/lib/companyZones';
import { normalizeJobStatus } from '@/lib/jobStatusAuthority';
import { driverIdsMatch } from '@/types/driver';
import type { Job } from '@/types/job';
import { jobPickupTypeLabel, parseLatLng } from '@/types/job';

export type LiveJobFilters = {
  driverId: string;
  serviceType: string;
  jobType: '' | 'ASAP' | 'LATER';
  zoneId: string;
  status: string;
};

export const EMPTY_LIVE_JOB_FILTERS: LiveJobFilters = {
  driverId: '',
  serviceType: '',
  jobType: '',
  zoneId: '',
  status: '',
};

export const LIVE_STATUS_FILTER_OPTIONS = [
  'Pending',
  'No One',
  'Scheduled',
  'Offered',
  'Queued',
  'Assigned',
  'Picking',
  'Arrived',
  'Active',
  'OnTrip',
] as const;

export function hasActiveLiveJobFilters(filters: LiveJobFilters): boolean {
  return !!(
    filters.driverId ||
    filters.serviceType ||
    filters.jobType ||
    filters.zoneId ||
    filters.status
  );
}

function jobMatchesDriver(job: Job, driverId: string): boolean {
  const candidates = [job.driverId, job.queuedForDriverId, job.vehicleId, job.vehicleNo].filter(Boolean);
  return candidates.some((id) => driverIdsMatch(String(id), driverId));
}

export function resolveJobZoneId(job: Job, zones: CompanyZone[]): string {
  const explicit = String(job.zoneId ?? '').trim();
  if (explicit) return explicit;
  const pt = parseLatLng(job.pickLatLng);
  if (!pt) return '';
  return findZoneAtCoords(pt.lat, pt.lng, zones)?.id ?? '';
}

export function filterLiveJobs(
  jobs: Job[],
  filters: LiveJobFilters,
  zones: CompanyZone[] = [],
): Job[] {
  if (!hasActiveLiveJobFilters(filters)) return jobs;

  return jobs.filter((job) => {
    if (filters.driverId && !jobMatchesDriver(job, filters.driverId)) return false;
    if (filters.serviceType && job.serviceType !== filters.serviceType) return false;
    if (filters.jobType && jobPickupTypeLabel(job) !== filters.jobType) return false;
    if (filters.status && normalizeJobStatus(job.status) !== filters.status) return false;
    if (filters.zoneId && resolveJobZoneId(job, zones) !== filters.zoneId) return false;
    return true;
  });
}

export function uniqueLiveJobDrivers(jobs: Job[]): { id: string; label: string }[] {
  const map = new Map<string, string>();
  for (const job of jobs) {
    for (const id of [job.driverId, job.queuedForDriverId]) {
      const drv = String(id ?? '').trim();
      if (!drv || drv === '0' || drv === '-1' || drv === '-2') continue;
      const label = String(job.driverName ?? '').trim() || `Driver ${drv}`;
      map.set(drv, label);
    }
  }
  return Array.from(map.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
