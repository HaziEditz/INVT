import type { Job } from '@/types/job';
import { driverIdsMatch } from '@/types/driver';
import {
  isUnassignedDriverId,
  normalizeJobStatus,
  TERMINAL_BOOKING_STATUSES,
} from '@/lib/jobStatusAuthority';

export type SuspendBlockReason = 'free' | 'assigned' | 'queued' | 'active';

export type DriverAdminAction = 'suspend' | 'kick';

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

function guardMessage(
  action: DriverAdminAction,
  reason: SuspendBlockReason,
  jobId: number,
): string {
  const verb = action === 'kick' ? 'kick' : 'suspend';
  if (reason === 'active') {
    return action === 'kick'
      ? 'Driver has a passenger on board. Cannot kick until trip completes.'
      : 'Driver has passenger on board. Cannot suspend until trip completes.';
  }
  if (reason === 'queued') {
    return `Driver has queued job #${jobId}. Reassign from Queue tab first, then ${verb}.`;
  }
  return `Driver has assigned job #${jobId}. Reassign from Assign tab first, then ${verb}.`;
}

/** Classify whether a driver can be kicked/suspended now, or which tab the dispatcher must use first. */
export function evaluateDriverJobGuard(
  driver: { driverId: string; vehicleId?: string; vehicleNo?: string },
  jobs: ReadonlyArray<Pick<Job, 'id' | 'driverId' | 'status'>>,
  action: DriverAdminAction = 'suspend',
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
      message: guardMessage(action, 'active', activeJob.id),
      canScheduleAfterTrip: action === 'suspend',
    };
  }
  if (queuedJob) {
    return {
      canProceed: false,
      reason: 'queued',
      jobId: queuedJob.id,
      message: guardMessage(action, 'queued', queuedJob.id),
      canScheduleAfterTrip: false,
    };
  }
  if (assignedJob) {
    return {
      canProceed: false,
      reason: 'assigned',
      jobId: assignedJob.id,
      message: guardMessage(action, 'assigned', assignedJob.id),
      canScheduleAfterTrip: false,
    };
  }

  return { canProceed: true, reason: 'free', canScheduleAfterTrip: false };
}

/** @deprecated Use evaluateDriverJobGuard(driver, jobs, 'suspend') */
export function evaluateSuspendGuard(
  driver: { driverId: string; vehicleId?: string; vehicleNo?: string },
  jobs: ReadonlyArray<Pick<Job, 'id' | 'driverId' | 'status'>>,
): SuspendGuardResult {
  return evaluateDriverJobGuard(driver, jobs, 'suspend');
}

export function evaluateKickGuard(
  driver: { driverId: string; vehicleId?: string; vehicleNo?: string },
  jobs: ReadonlyArray<Pick<Job, 'id' | 'driverId' | 'status'>>,
): SuspendGuardResult {
  return evaluateDriverJobGuard(driver, jobs, 'kick');
}
