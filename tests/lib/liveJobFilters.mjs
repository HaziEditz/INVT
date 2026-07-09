/** Keep in sync with src/lib/liveJobFilters.ts */

function normalizeJobStatus(st) {
  const s = String(st || '').trim();
  if (s === 'Unassigned') return 'Pending';
  return s;
}

function jobPickupTypeLabel(job) {
  const scheduled = job.bookingType?.toUpperCase() === 'SCHEDULED' || (job.scheduledFor && job.scheduledFor > 0);
  if (!scheduled) return 'ASAP';
  return 'LATER';
}

function driverIdsMatch(a, b) {
  const na = String(a || '').trim().toLowerCase();
  const nb = String(b || '').trim().toLowerCase();
  if (!na || !nb) return false;
  if (na === nb) return true;
  const strip = (x) => x.replace(/^t/i, '').replace(/^dd/i, '');
  return strip(na) === strip(nb);
}

export const EMPTY_LIVE_JOB_FILTERS = {
  driverId: '',
  serviceType: '',
  jobType: '',
  zoneId: '',
  status: '',
};

export function hasActiveLiveJobFilters(filters) {
  return !!(
    filters.driverId ||
    filters.serviceType ||
    filters.jobType ||
    filters.zoneId ||
    filters.status
  );
}

function jobMatchesDriver(job, driverId) {
  const candidates = [job.driverId, job.queuedForDriverId, job.vehicleId, job.vehicleNo].filter(Boolean);
  return candidates.some((id) => driverIdsMatch(String(id), driverId));
}

export function resolveJobZoneId(job, zones) {
  const explicit = String(job.zoneId ?? '').trim();
  if (explicit) return explicit;
  return '';
}

export function filterLiveJobs(jobs, filters, zones = []) {
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

function jobTabForStatus(job) {
  if (job.serviceType === 'food' || job.serviceType === 'freight') return 'dy';
  const st = normalizeJobStatus(job.status);
  if (st === 'Queued') return 'queue';
  if (st === 'Active' || st === 'OnTrip') return 'active';
  if (st === 'Assigned' || st === 'Picking' || st === 'Arrived') return 'assign';
  if (st === 'Offered') return 'offer';
  return 'ua';
}

export function filterJobsForTab(jobs, tab, filters = EMPTY_LIVE_JOB_FILTERS, zones = []) {
  const tabbed = jobs.filter((j) => jobTabForStatus(j) === tab);
  const filtered = hasActiveLiveJobFilters(filters) ? filterLiveJobs(tabbed, filters, zones) : tabbed;
  return filtered;
}

export function makeTestJob(overrides = {}) {
  return {
    id: 1,
    companyId: 'bwtest',
    status: 'Pending',
    serviceType: 'taxi',
    source: 'dispatch',
    pickAddress: '1 Test St',
    pickLatLng: '',
    dropAddress: '2 Test St',
    dropLatLng: '',
    passengerName: 'Passenger',
    passengerPhone: '021',
    paymentType: 'Cash',
    estimatedFare: '0',
    driverId: '9000',
    ...overrides,
  };
}
