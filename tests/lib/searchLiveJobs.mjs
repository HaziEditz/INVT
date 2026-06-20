/** Keep in sync with src/lib/searchLiveJobs.ts */

const TERMINAL = new Set(['Completed', 'Cancelled', 'No Show']);

const TAB_LABELS = {
  ua: 'U-A',
  offer: 'Offer',
  assign: 'Assign',
  active: 'Active',
  queue: 'Queue',
  dy: 'DY',
};

function normalizeJobStatus(st) {
  const s = String(st || '').trim();
  if (s === 'Unassigned') return 'Pending';
  return s;
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

export function jobTabDisplayLabel(tab) {
  return TAB_LABELS[tab] ?? String(tab).toUpperCase();
}

export function isLiveDispatchJob(job) {
  return !TERMINAL.has(normalizeJobStatus(job.status));
}

export function buildJobSearchHaystack(job) {
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

export function searchLiveJobs(jobs, query, limit = 50) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];

  const hits = [];
  for (const job of jobs) {
    if (!isLiveDispatchJob(job)) continue;
    if (!buildJobSearchHaystack(job).includes(q)) continue;
    const tab = jobTabForStatus(job);
    hits.push({ job, tab, tabLabel: jobTabDisplayLabel(tab) });
    if (hits.length >= limit) return hits;
  }

  hits.sort((a, b) => a.job.id - b.job.id);
  return hits;
}

/** Minimal Job shape from admin jobTrace / jobStore lifecycle row. */
export function jobFromTraceLifecycle(trace, companyId) {
  const lc = trace.jobStore?.lifecycle || trace.jobStore?.rawFlags || {};
  const fb = trace.firebase?.allbookings || trace.firebase?.pendingjobs || {};
  const src = { ...fb, ...lc };
  return {
    id: Number(trace.bookingId || src.Id || lc.Id),
    companyId,
    status: normalizeJobStatus(src.BookingStatus || src.Status || 'Pending'),
    serviceType: 'taxi',
    source: 'dispatch',
    pickAddress: String(src.PickAddress || src.pickAddress || ''),
    pickLatLng: '',
    dropAddress: String(src.DropAddress || src.dropAddress || ''),
    dropLatLng: '',
    passengerName: String(src.Name || src.passengerName || ''),
    passengerPhone: String(src.PhoneNo || src.passengerPhone || ''),
    paymentType: 'Cash',
    estimatedFare: '0',
    driverId: String(src.DriverId || src.driverId || '0'),
    vehicleNo: String(src.VehicleNo || src.vehiclenumber || ''),
    bookingDateTime: String(src.BookingDateTime || src.Pickingtime || ''),
  };
}
