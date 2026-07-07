import type { Job } from '@/types/job';
import { driverIdsMatch } from '@/types/driver';
import {
  isUnassignedDriverId,
  normalizeJobStatus,
  TERMINAL_BOOKING_STATUSES,
} from '@/lib/jobStatusAuthority';

export type SuspendBlockReason = 'free' | 'assigned' | 'queued' | 'active';

export type SuspendGuardResult = {
  canProceed: boolean;
  reason: SuspendBlockReason;
  jobId?: number;
  message?: string;
  canScheduleAfterTrip: boolean;
};

const ACTIVE_TRIP_STATUSES = new Set(['Active', 'OnTrip', 'Picking', 'Arrived', 'Busy']);

type DriverRef = {
  driverId: string;
  vehicleId?: string;
  vehicleNo?: string;
};

function driverMatchesJob(driver: DriverRef, job: Pick<Job, 'driverId'>): boolean {
  if (isUnassignedDriverId(job.driverId)) return false;
  const jDrv = String(job.driverId ?? '').trim();
  return (
    driverIdsMatch(jDrv, driver.driverId) ||
    (!!driver.vehicleId && driverIdsMatch(jDrv, driver.vehicleId)) ||
    (!!driver.vehicleNo && driverIdsMatch(jDrv, driver.vehicleNo))
  );
}

/** Classify whether a driver can be suspended now, or which tab the dispatcher must use first. */
export function evaluateSuspendGuard(
  driver: { driverId: string; vehicleId?: string; vehicleNo?: string },
  jobs: ReadonlyArray<Pick<Job, 'id' | 'driverId' | 'status'>>,
): SuspendGuardResult {
  let activeJob: Pick<Job, 'id'> | undefined;
  let queuedJob: Pick<Job, 'id'> | undefined;
  let assignedJob: Pick<Job, 'id'> | undefined;

  for (const job of jobs) {
    if (!driverMatchesJob(driver, job)) continue;
    const st = normalizeJobStatus(job.status);
    if (TERMINAL_BOOKING_STATUSES.has(st)) continue;
    if (ACTIVE_TRIP_STATUSES.has(st)) {
      if (!activeJob) activeJob = job;
    } else if (st === 'Queued') {
      if (!queuedJob) queuedJob = job;
    } else if (st === 'Assigned') {
      if (!assignedJob) assignedJob = job;
    }
  }

  if (activeJob) {
    return {
      canProceed: false,
      reason: 'active',
      jobId: activeJob.id,
      message: 'Driver has passenger on board. Cannot suspend until trip completes.',
      canScheduleAfterTrip: true,
    };
  }
  if (queuedJob) {
    return {
      canProceed: false,
      reason: 'queued',
      jobId: queuedJob.id,
      message: `Driver has queued job #${queuedJob.id}. Reassign from Queue tab first, then suspend.`,
      canScheduleAfterTrip: false,
    };
  }
  if (assignedJob) {
    return {
      canProceed: false,
      reason: 'assigned',
      jobId: assignedJob.id,
      message: `Driver has assigned job #${assignedJob.id}. Reassign from Assign tab first, then suspend.`,
      canScheduleAfterTrip: false,
    };
  }

  return { canProceed: true, reason: 'free', canScheduleAfterTrip: false };
}
