import type { Job, JobStatus } from '@/types/job';
import { mergeJobStatus, normalizeJobStatus, statusRank } from '@/lib/jobStatusAuthority';

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
  'vehicleType',
];

function isOpenVehicleType(value: unknown): boolean {
  const s = String(value ?? '').trim().toLowerCase();
  return !s || s === 'not specified' || s === 'any';
}

function isConcreteVehicleType(value: unknown): boolean {
  return !isOpenVehicleType(value);
}

/** Merge an incoming job patch into an existing record without wiping known-good fields. */
export function mergeJobUpdate(
  existing: Job,
  incoming: Partial<Job>,
  opts?: { forceStatus?: JobStatus },
): Job {
  const existingSeq = existing.updateSeq ?? 0;
  const incomingSeq = incoming.updateSeq ?? existingSeq;
  const staleVehicleTypeMirror =
    incomingSeq < existingSeq &&
    isOpenVehicleType(incoming.vehicleType) &&
    isConcreteVehicleType(existing.vehicleType);

  const merged: Job = { ...existing, ...incoming };
  for (const key of PRESERVE_IF_EMPTY) {
    const nextVal = incoming[key];
    const prevVal = existing[key];
    if (key === 'vehicleType' && staleVehicleTypeMirror) {
      (merged as Record<string, unknown>)[key] = prevVal;
      continue;
    }
    if (typeof nextVal === 'string' && !nextVal.trim() && typeof prevVal === 'string' && prevVal.trim()) {
      (merged as Record<string, unknown>)[key] = prevVal;
    }
  }
  if (staleVehicleTypeMirror) {
    merged.vehicleType = existing.vehicleType;
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
    merged.scheduledFor = incoming.scheduledFor === undefined ? undefined : incoming.scheduledFor;
    merged.notifyDispatchAt = incoming.notifyDispatchAt ? incoming.notifyDispatchAt : undefined;
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
