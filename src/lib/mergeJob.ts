import type { Job, JobStatus } from '@/types/job';
import { normalizeJobStatus } from '@/types/job';

/** Progression rank — higher means further along the dispatch lifecycle. */
const STATUS_RANK: Partial<Record<JobStatus, number>> = {
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

function statusRank(status: JobStatus | string | undefined): number {
  if (!status) return -1;
  return STATUS_RANK[normalizeJobStatus(String(status))] ?? 1;
}

/** Never let a stale pendingjobs partial downgrade a newer allbookings status. */
function mergeJobStatus(
  existing: JobStatus,
  incoming: JobStatus | undefined,
  existingSeq: number,
  incomingSeq: number,
): JobStatus {
  if (!incoming) return existing;
  const ex = normalizeJobStatus(existing);
  const inc = normalizeJobStatus(incoming);
  if (inc === 'Cancelled' || inc === 'Completed' || inc === 'No Show') {
    const exNorm = normalizeJobStatus(existing);
    const exRank = statusRank(exNorm);
    // Stale terminal from a reused booking Id must not beat a live active status.
    if (exRank > 0 && exRank < 100 && incomingSeq <= existingSeq) return ex;
    return inc;
  }
  // Pool statuses (No One / Pending / Scheduled) are peers — never let a stale
  // Pending snapshot beat a newer No One (or vice versa) via progression rank.
  const POOL: JobStatus[] = ['No One', 'Pending', 'Scheduled'];
  if (POOL.includes(ex) && POOL.includes(inc)) {
    if (incomingSeq >= existingSeq) return inc;
    return ex;
  }
  if ((inc === 'No One' || inc === 'Pending') && incomingSeq >= existingSeq) return inc;
  // Queued is sticky — stale pool / offer snapshots must not outrank Queued.
  const QUEUED_PROMOTE: JobStatus[] = ['Offered', 'Assigned', 'Picking', 'Arrived', 'Active', 'OnTrip'];
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

/** String fields that must not be overwritten by empty Firebase partial updates. */
const PRESERVE_IF_EMPTY: (keyof Job)[] = [
  'pickAddress',
  'dropAddress',
  'pickLatLng',
  'dropLatLng',
  'passengerName',
  'passengerPhone',
  'estimatedFare',
  'dispatcherName',
  'bookingDateTime',
  'tariffName',
  'tariffId',
  'jobEditing',
];

/** Merge an incoming job patch into an existing record without wiping known-good fields. */
export function mergeJobUpdate(
  existing: Job,
  incoming: Partial<Job>,
  opts?: { forceStatus?: JobStatus },
): Job {
  const merged: Job = { ...existing, ...incoming };
  for (const key of PRESERVE_IF_EMPTY) {
    const nextVal = incoming[key];
    const prevVal = existing[key];
    if (typeof nextVal === 'string' && !nextVal.trim() && typeof prevVal === 'string' && prevVal.trim()) {
      (merged as Record<string, unknown>)[key] = prevVal;
    }
  }
  if (incoming.createdAt == null && existing.createdAt != null) {
    merged.createdAt = existing.createdAt;
  }
  if ((!incoming.editHistory || !incoming.editHistory.length) && existing.editHistory?.length) {
    merged.editHistory = existing.editHistory;
  } else if (incoming.editHistory?.length && existing.editHistory?.length) {
    merged.editHistory =
      incoming.editHistory.length >= existing.editHistory.length
        ? incoming.editHistory
        : existing.editHistory;
  }
  const existingSeq = existing.updateSeq ?? 0;
  const incomingSeq = incoming.updateSeq ?? existingSeq;
  if (opts?.forceStatus) {
    merged.status = opts.forceStatus;
  } else if (incoming.status != null) {
    merged.status = mergeJobStatus(existing.status, incoming.status, existingSeq, incomingSeq);
  }
  const incDriver = incoming.driverId != null ? String(incoming.driverId) : null;
  if (incDriver === '0' || incDriver === '-1') {
    if (
      incomingSeq >= existingSeq &&
      incoming.status != null &&
      (normalizeJobStatus(String(incoming.status)) === 'Pending' ||
        normalizeJobStatus(String(incoming.status)) === 'No One')
    ) {
      merged.driverId = incDriver;
    }
  }
  if (incoming.driverId != null && incomingSeq < existingSeq && statusRank(merged.status) > statusRank('Offered')) {
    if (existing.driverId) merged.driverId = existing.driverId;
  }
  if (incoming.updateSeq == null || incomingSeq < existingSeq) {
    merged.updateSeq = existingSeq;
  }
  if (incomingSeq >= existingSeq && incoming.dispatchBeforeMinutes === 0) {
    merged.dispatchBeforeMinutes = 0;
    if (incoming.scheduledFor === undefined) merged.scheduledFor = undefined;
    if (!incoming.notifyDispatchAt) merged.notifyDispatchAt = undefined;
    if (
      incoming.status != null &&
      normalizeJobStatus(String(incoming.status)) === 'Pending' &&
      normalizeJobStatus(existing.status) === 'Scheduled'
    ) {
      merged.status = incoming.status;
    }
  }
  if (
    incomingSeq >= existingSeq &&
    normalizeJobStatus(String(incoming.status || '')) === 'No One'
  ) {
    merged.status = 'No One';
    if (incDriver === '-1' || incoming.driverId === '-1') merged.driverId = '-1';
  }
  const existingLocked = !!(existing.editLock?.active || existing.jobEditing);
  const incomingLocked = !!(incoming.editLock?.active || incoming.jobEditing);
  if (incoming.jobEditing === false || incoming.editLock?.active === false) {
    merged.jobEditing = false;
    merged.editLock = undefined;
  } else if (existingLocked && !incomingLocked) {
    // Newer unlocked snapshot from Firebase/server — do not preserve a stale lock.
    if (incomingSeq >= existingSeq) {
      merged.jobEditing = incoming.jobEditing ?? false;
      merged.editLock = incoming.editLock;
    } else {
      merged.editLock = existing.editLock;
      merged.jobEditing = existing.jobEditing ?? true;
    }
  }
  return merged;
}
