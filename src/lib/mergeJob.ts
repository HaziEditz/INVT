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

/** Pre-booked / Later timing — dispatch window, scheduled pickup, or Scheduled status. */
export function isLaterJobState(
  job: Pick<Job, 'dispatchBeforeMinutes' | 'scheduledFor' | 'notifyDispatchAt' | 'status'>,
): boolean {
  if ((job.dispatchBeforeMinutes ?? 0) > 0) return true;
  if (job.notifyDispatchAt) return true;
  if (job.scheduledFor != null && job.scheduledFor > 0) return true;
  if (normalizeJobStatus(String(job.status ?? '')) === 'Scheduled') return true;
  return false;
}

/** True only when the incoming patch intentionally converts Later → Now (ASAP). */
export function isExplicitLaterToNow(existing: Job, incoming: Partial<Job>): boolean {
  if (!isLaterJobState(existing)) return false;
  if (isLaterJobState(incoming as Job)) return false;

  const prevDb = existing.dispatchBeforeMinutes ?? 0;
  const nextDb = incoming.dispatchBeforeMinutes ?? prevDb;
  if (prevDb > 0 && nextDb === 0) return true;

  const prevSched = existing.scheduledFor ?? 0;
  if (prevSched > 0 && incoming.scheduledFor === 0) return true;

  if (
    prevSched > 0 &&
    incoming.notifyDispatchAt === '' &&
    nextDb === 0 &&
    (incoming.scheduledFor == null || incoming.scheduledFor === 0)
  ) {
    return true;
  }

  if (
    normalizeJobStatus(existing.status) === 'Scheduled' &&
    incoming.status != null &&
    normalizeJobStatus(String(incoming.status)) === 'Pending' &&
    nextDb === 0 &&
    !(incoming.scheduledFor != null && incoming.scheduledFor > 0)
  ) {
    return true;
  }

  return false;
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
  if (incomingSeq >= existingSeq) {
    const prevLater = isLaterJobState(existing);
    const laterToNow = isExplicitLaterToNow(existing, incoming);

    if (laterToNow) {
      merged.dispatchBeforeMinutes = 0;
      merged.scheduledFor =
        incoming.scheduledFor != null && incoming.scheduledFor > 0
          ? incoming.scheduledFor
          : undefined;
      merged.notifyDispatchAt = incoming.notifyDispatchAt?.trim()
        ? incoming.notifyDispatchAt
        : undefined;
      if (
        incoming.status != null &&
        normalizeJobStatus(String(incoming.status)) === 'Pending' &&
        normalizeJobStatus(existing.status) === 'Scheduled'
      ) {
        merged.status = incoming.status;
      }
    } else if (prevLater) {
      // Partial Firebase/metadata patches must not strip Later pickup fields.
      if ((existing.scheduledFor ?? 0) > 0 && !(incoming.scheduledFor != null && incoming.scheduledFor > 0)) {
        merged.scheduledFor = existing.scheduledFor;
      }
      if (existing.notifyDispatchAt && !incoming.notifyDispatchAt) {
        merged.notifyDispatchAt = existing.notifyDispatchAt;
      }
      if ((existing.dispatchBeforeMinutes ?? 0) > 0 && (incoming.dispatchBeforeMinutes ?? 0) === 0) {
        merged.dispatchBeforeMinutes = existing.dispatchBeforeMinutes;
      }
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
