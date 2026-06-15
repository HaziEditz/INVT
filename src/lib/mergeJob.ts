import type { Job, JobStatus } from '@/types/job';
import { normalizeJobStatus } from '@/types/job';

/** Progression rank — higher means further along the dispatch lifecycle. */
const STATUS_RANK: Partial<Record<JobStatus, number>> = {
  'No One': 0,
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
  if (inc === 'Cancelled' || inc === 'Completed' || inc === 'No Show') return inc;
  if ((inc === 'No One' || inc === 'Pending') && incomingSeq >= existingSeq) return inc;
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
];

/** Merge an incoming job patch into an existing record without wiping known-good fields. */
export function mergeJobUpdate(existing: Job, incoming: Partial<Job>): Job {
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
  const existingSeq = existing.updateSeq ?? 0;
  const incomingSeq = incoming.updateSeq ?? existingSeq;
  if (incoming.status != null) {
    merged.status = mergeJobStatus(existing.status, incoming.status, existingSeq, incomingSeq);
  }
  const incDriver = incoming.driverId != null ? String(incoming.driverId) : null;
  if (incDriver === '0' || incDriver === '-1') {
    if (
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
  return merged;
}
