/** Keep in sync with src/lib/jobStatusAuthority.ts — Phase 1 pure authority surface. */

export const TERMINAL_BOOKING_STATUSES = new Set(['Completed', 'Cancelled', 'No Show']);

export const LIVE_DISPATCH_STATUSES = new Set([
  'Offered',
  'Queued',
  'Assigned',
  'Picking',
  'Arrived',
  'Active',
  'OnTrip',
  'Pending',
  'No One',
  'Scheduled',
]);

export const LIVE_DISPATCH_TABS = new Set(['offer', 'assign', 'active', 'queue']);

export const POOL_UA_STATUSES = new Set(['Pending', 'No One', 'Scheduled']);

export const POOL_TAB_STATUSES = new Set(['Pending', 'No One', 'Scheduled']);

export const LIVE_LIFECYCLE_STATUSES = new Set([
  'Active',
  'Picking',
  'Arrived',
  'OnTrip',
  'Assigned',
  'Offered',
  'Scheduled',
]);

export const ACTIVE_BOOKING_STATUSES = new Set([
  'Offered',
  'Queued',
  'Assigned',
  'Picking',
  'Arrived',
  'Active',
  'OnTrip',
]);

export const LIVE_OFFER_STATUSES = new Set(['Offered', 'Assigned']);

export const STATUS_RANK = {
  'No One': 1,
  Pending: 1,
  Scheduled: 1,
  Offered: 2,
  Queued: 3,
  Assigned: 4,
  Picking: 5,
  Arrived: 6,
  Active: 7,
  OnTrip: 7,
  Completed: 100,
  Cancelled: 100,
  'No Show': 100,
};

export function normalizeJobStatus(raw) {
  const s = String(raw || '').trim();
  if (s === 'NoOne' || s === 'no_one' || s === 'NO ONE') return 'No One';
  if (s === 'pending' || s === 'PENDING') return 'Pending';
  if (s === 'queued' || s === 'QUEUED') return 'Queued';
  if (s === 'OnBoard' || s === 'onboard' || s === 'On Board') return 'Active';
  return s;
}

export function uaStatusBadge(job) {
  const st = normalizeJobStatus(job.status);
  if (st === 'No One') return { label: 'NO ONE', color: '#94a3b8', bg: 'rgba(100,116,139,0.2)' };
  if (st === 'Pending') return { label: 'PENDING', color: '#5b7cfa', bg: 'rgba(79,110,247,0.2)' };
  return null;
}

export function statusBadgeStyle(status) {
  const st = normalizeJobStatus(status);
  if (st === 'No One') return { label: 'NO ONE', color: '#94a3b8', bg: 'rgba(100,116,139,0.2)' };
  if (st === 'Pending') return { label: 'PENDING', color: '#5b7cfa', bg: 'rgba(79,110,247,0.2)' };
  if (st === 'Scheduled') return { label: 'SCHEDULED', color: '#f59e0b', bg: 'rgba(245,158,11,0.2)' };
  return null;
}

export function jobStatusAbbrev(status) {
  const st = normalizeJobStatus(status);
  switch (st) {
    case 'No One':
      return { abbrev: 'NON', dotColor: '#94a3b8' };
    case 'Pending':
      return { abbrev: 'PND', dotColor: '#4f6ef7' };
    case 'Offered':
      return { abbrev: 'OFR', dotColor: '#f59e0b' };
    case 'Assigned':
      return { abbrev: 'ASN', dotColor: '#6366f1' };
    case 'Picking':
      return { abbrev: 'PIK', dotColor: '#6366f1' };
    case 'Arrived':
      return { abbrev: 'ARR', dotColor: '#6366f1' };
    case 'Active':
    case 'OnTrip':
      return { abbrev: 'ACT', dotColor: '#22c55e' };
    case 'Scheduled':
      return { abbrev: 'SCH', dotColor: '#0ea5e9' };
    case 'Queued':
      return { abbrev: 'QUE', dotColor: '#a855f7' };
    default:
      return { abbrev: st.slice(0, 3).toUpperCase(), dotColor: '#64748b' };
  }
}

export function jobStatusFromFirebaseRecord(rec) {
  const dId = rec.DriverId ?? rec.driverId ?? rec.DId;
  if (dId === -1 || dId === '-1') return 'No One';

  const booking = rec.BookingStatus != null ? normalizeJobStatus(String(rec.BookingStatus)) : null;
  const status =
    rec.Status != null || rec.status != null
      ? normalizeJobStatus(String(rec.Status ?? rec.status))
      : null;

  if (booking === 'No One' || status === 'No One') return 'No One';

  if (booking === 'Completed' || booking === 'Cancelled' || booking === 'No Show') return booking;
  if (status === 'Completed' || status === 'Cancelled' || status === 'No Show') return status;

  const LIVE_BOOKING = [
    'Offered',
    'Queued',
    'Assigned',
    'Picking',
    'Arrived',
    'Active',
    'OnTrip',
    'Busy',
  ];
  if (booking && LIVE_BOOKING.includes(booking)) return booking;

  if (booking === 'Pending' || status === 'Pending') return 'Pending';
  if (booking) return booking;
  if (status) return status;
  return 'Pending';
}

export function effectiveJobStatus(job) {
  const drv = String(job.driverId ?? '').trim();
  if (drv === '-1') return 'No One';
  return normalizeJobStatus(job.status);
}

export function isUnassignedDriverId(driverId) {
  const d = String(driverId ?? '').trim();
  return !d || d === '0' || d === '-1' || d === '-2';
}

export function isGenuineQueuedJob(job) {
  if (normalizeJobStatus(job.status) !== 'Queued') return false;
  return !isUnassignedDriverId(job.driverId);
}

export function isPoolUaStatus(status) {
  return POOL_UA_STATUSES.has(normalizeJobStatus(status));
}

export function isTerminalStatus(status) {
  return TERMINAL_BOOKING_STATUSES.has(normalizeJobStatus(status));
}

export function isLiveDispatchStatus(status) {
  return LIVE_DISPATCH_STATUSES.has(normalizeJobStatus(status));
}

export function recordDriverId(rec) {
  return String(
    rec.DriverId ?? rec.driverId ?? rec.AssignedDriverId ?? rec.assignedDriverId ?? '',
  ).trim();
}

export function jobTabForStatus(job) {
  if (job.serviceType === 'food' || job.serviceType === 'freight') return 'dy';
  const st = normalizeJobStatus(job.status);
  const drv = String(job.driverId ?? '').trim();
  const hasQueuedDriver = !!drv && drv !== '0' && drv !== '-1' && drv !== '-2';
  if (st === 'Queued' && hasQueuedDriver) return 'queue';
  if (st === 'Active' || st === 'OnTrip') return 'active';
  if (st === 'Assigned' || st === 'Picking' || st === 'Arrived') return 'assign';
  if (st === 'Offered') return 'offer';
  return 'ua';
}

export function isUaJob(job) {
  return jobTabForStatus(job) === 'ua';
}

export function pinQueuedOptimisticJob(baseJob, applied) {
  if (!isGenuineQueuedJob(baseJob)) return null;
  const pinned = {
    ...applied,
    status: 'Queued',
    driverId: baseJob.driverId,
    vehicleId: baseJob.vehicleId,
  };
  if (jobTabForStatus(pinned) !== 'queue') return null;
  return pinned;
}

export function retainQueuedOptimisticAfterServerMerge(optimistic, merged) {
  if (!isGenuineQueuedJob(optimistic) || jobTabForStatus(optimistic) !== 'queue') {
    return merged;
  }
  if (jobTabForStatus(merged) === 'queue') return merged;
  const mergedSt = normalizeJobStatus(merged.status);
  const demotedToPoolOrUa =
    mergedSt === 'Pending' ||
    mergedSt === 'No One' ||
    mergedSt === 'Scheduled' ||
    mergedSt === 'Offered' ||
    isUnassignedDriverId(merged.driverId);
  if (!demotedToPoolOrUa) return merged;
  const retained = {
    ...merged,
    status: 'Queued',
    driverId: optimistic.driverId,
    vehicleId: optimistic.vehicleId ?? merged.vehicleId,
  };
  return jobTabForStatus(retained) === 'queue' ? retained : merged;
}

export function statusRank(status) {
  if (!status) return -1;
  return STATUS_RANK[normalizeJobStatus(String(status))] ?? 1;
}

export function mergeJobStatus(existing, incoming, existingSeq, incomingSeq) {
  if (!incoming) return existing;
  const ex = normalizeJobStatus(existing);
  const inc = normalizeJobStatus(incoming);
  if (inc === 'Cancelled' || inc === 'Completed' || inc === 'No Show') {
    const exNorm = normalizeJobStatus(existing);
    const exRank = statusRank(exNorm);
    if (exRank > 0 && exRank < 100 && incomingSeq <= existingSeq) return ex;
    return inc;
  }
  const POOL = ['No One', 'Pending', 'Scheduled'];
  if (POOL.includes(ex) && POOL.includes(inc)) {
    if (incomingSeq >= existingSeq) return inc;
    return ex;
  }
  if ((inc === 'No One' || inc === 'Pending') && incomingSeq >= existingSeq) return inc;
  const QUEUED_PROMOTE = ['Offered', 'Assigned', 'Picking', 'Arrived', 'Active', 'OnTrip'];
  if (ex === 'Queued' && (POOL.includes(inc) || QUEUED_PROMOTE.includes(inc))) {
    if (inc === 'Offered' || QUEUED_PROMOTE.includes(inc)) {
      if (incomingSeq <= existingSeq) return ex;
      return inc;
    }
    return ex;
  }
  if (statusRank(inc) < statusRank(ex)) return ex;
  if (statusRank(inc) === statusRank(ex) && incomingSeq < existingSeq) return ex;
  return inc;
}

export function coerceAllbookingsLiveStatus(rec, effectiveStatus) {
  const bookingRaw = rec.BookingStatus ?? rec.bookingStatus;
  const fbBooking = bookingRaw != null ? normalizeJobStatus(String(bookingRaw)) : null;
  const statusRaw = rec.Status ?? rec.status;
  const fbStatus = statusRaw != null ? normalizeJobStatus(String(statusRaw)) : null;

  if (fbBooking && TERMINAL_BOOKING_STATUSES.has(fbBooking)) return fbBooking;
  if (fbStatus && TERMINAL_BOOKING_STATUSES.has(fbStatus)) return fbStatus;
  if (TERMINAL_BOOKING_STATUSES.has(effectiveStatus)) return effectiveStatus;

  if (fbBooking && POOL_TAB_STATUSES.has(fbBooking)) return fbBooking;
  if (fbStatus && POOL_TAB_STATUSES.has(fbStatus)) return fbStatus;

  const drv = recordDriverId(rec);
  if (fbBooking === 'Queued') {
    return isUnassignedDriverId(drv) ? effectiveStatus : 'Queued';
  }
  const eventType = String(rec.eventType ?? rec.EventType ?? '').toLowerCase();
  if (eventType === 'queued' && !isUnassignedDriverId(drv)) {
    if (fbBooking !== 'No One' && fbStatus !== 'No One' && fbBooking !== 'Pending' && fbStatus !== 'Pending') {
      return 'Queued';
    }
  }
  if (
    (rec.queuedAt != null || rec.QueuedAt != null) &&
    !isUnassignedDriverId(drv) &&
    fbBooking !== 'No One' &&
    fbStatus !== 'No One' &&
    fbBooking !== 'Pending' &&
    fbStatus !== 'Pending'
  ) {
    return 'Queued';
  }
  return effectiveStatus;
}

export function allbookingsRecordIsQueued(rec) {
  if (isUnassignedDriverId(recordDriverId(rec))) return false;
  const bookingRaw = rec.BookingStatus ?? rec.bookingStatus;
  const fbBooking = bookingRaw != null ? normalizeJobStatus(String(bookingRaw)) : null;
  if (fbBooking && POOL_TAB_STATUSES.has(fbBooking)) return false;
  if (fbBooking === 'Queued') return true;
  const statusRaw = rec.Status ?? rec.status;
  const fbStatus = statusRaw != null ? normalizeJobStatus(String(statusRaw)) : null;
  if (fbStatus && POOL_TAB_STATUSES.has(fbStatus)) return false;
  if (fbStatus === 'Queued') return true;
  if (String(rec.eventType ?? rec.EventType ?? '').toLowerCase() === 'queued') return true;
  return rec.queuedAt != null || rec.QueuedAt != null;
}

export function pendingSnapshotWouldRegressConfirmedQueue(pjVal, opts) {
  const pjSt = normalizeJobStatus(
    String(pjVal.BookingStatus ?? pjVal.Status ?? pjVal.status ?? ''),
  );
  if (pjSt === 'Queued') return false;
  if (opts.bookingsQueued || opts.abQueued) {
    return pjSt !== 'Offered';
  }
  return false;
}
