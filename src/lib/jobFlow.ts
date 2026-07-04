import {
  jobFromFirebase,
  jobUpdateSeqFromRecord,
  isPreDispatchWindow,
  preDispatchAssignBlockMessage,
  type Job,
  type JobStatus,
} from '@/types/job';
import {
  normalizeJobStatus,
  pinQueuedOptimisticJob,
  retainQueuedOptimisticAfterServerMerge,
} from '@/lib/jobStatusAuthority';
import { getEditLockSessionId } from '@/lib/editLockSession';
import { getDb, ref, remove, update, get } from '@/lib/firebase';
import { purgeCancelledJobFromListeners, purgeDispatchTerminalJob } from '@/hooks/useJobs';
import { mergeJobUpdate } from '@/lib/mergeJob';
import { isAssignedDriverSelection } from '@/lib/createJobForm';
import { useJobStore } from '@/store/jobStore';
import { useUiStore } from '@/store/uiStore';

const API = '/api';

/** Serialize booking updates per job so rapid saves never reuse a stale ifSeq. */
const jobUpdateChains = new Map<number, Promise<void>>();

function latestStoreJob(jobId: number): Job | undefined {
  return useJobStore.getState().jobs.find((j) => j.id === jobId);
}

function latestJobSeq(jobId: number, fallback = 0): number {
  return latestStoreJob(jobId)?.updateSeq ?? fallback;
}

function editChangesTouchTiming(changes: Record<string, unknown>): boolean {
  return [
    'BookingDateTime',
    'Pickingtime',
    'DispatchTimebefore',
    'Dispatchbefore',
    'ScheduledFor',
    'ScheduledForMs',
    'NotifyDispatchAt',
  ].some((k) => Object.prototype.hasOwnProperty.call(changes, k));
}

/** Mirror server _applyTimingEditPrelude so optimistic UI matches saved state. */
export function applyClientTimingEditPrelude(
  job: Job,
  changes: Record<string, unknown>,
): Record<string, unknown> {
  if (!editChangesTouchTiming(changes)) return changes;
  const next = { ...changes };
  const prevDb = job.dispatchBeforeMinutes ?? 0;
  const nextDb =
    next.DispatchTimebefore !== undefined || next.Dispatchbefore !== undefined
      ? parseInt(String(next.DispatchTimebefore ?? next.Dispatchbefore ?? 0), 10) || 0
      : prevDb;
  const nowToLater = prevDb === 0 && nextDb > 0;
  const laterToNow = prevDb > 0 && nextDb === 0;
  const pickRef = next.Pickingtime ?? next.BookingDateTime ?? job.bookingDateTime;
  const pickupMs = pickRef ? Date.parse(String(pickRef).replace(' ', 'T')) : NaN;

  if (
    !Number.isNaN(pickupMs) &&
    (nowToLater || nextDb > 0 || normalizeJobStatus(job.status) === 'Scheduled')
  ) {
    next.ScheduledFor = pickupMs;
    next.ScheduledForMs = pickupMs;
    if (nextDb > 0) {
      next.NotifyDispatchAt = new Date(pickupMs - nextDb * 60_000).toISOString();
    }
  }

  if (nowToLater) {
    const st = normalizeJobStatus(job.status);
    if (['Pending', 'No One', 'Offered', 'Assigned', 'Queued'].includes(st)) {
      next.BookingStatus = 'Scheduled';
      next.Status = 'Scheduled';
      next.DriverId = '0';
      next.VehicleId = '0';
      next.manualOffer = false;
    }
  } else if (laterToNow) {
    next.ScheduledFor = 0;
    next.ScheduledForMs = 0;
    next.NotifyDispatchAt = '';
    if (normalizeJobStatus(job.status) === 'Scheduled') {
      next.BookingStatus = 'Pending';
      next.Status = 'Pending';
    }
  }

  return next;
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || data.message || `HTTP ${r.status}`);
  return data as T;
}

function isExplicitUnassignChanges(changes: Record<string, unknown>): boolean {
  return !!(
    changes._withdrawDriverId ||
    changes.BookingStatus === 'No One' ||
    changes.Status === 'No One' ||
    changes.BookingStatus === 'Pending' ||
    changes.Status === 'Pending' ||
    (changes.DriverId != null &&
      (Number(changes.DriverId) === -1 || Number(changes.DriverId) === 0))
  );
}

export async function sessionLogin(companyId: string, uid: string) {
  return jsonFetch<{ ok: boolean; companyId: string; company: string; ownerName?: string }>(
    `${API}/session/login`,
    { method: 'POST', body: JSON.stringify({ companyId, uid }) }
  );
}

/** Idempotent — server writes adminAccess/{companyId}/{uid} for RTDB allbookings list reads. */
export async function ensureAdminAccess(companyId: string, uid: string) {
  return jsonFetch<{ ok: boolean; companyId: string; uid: string }>(
    `${API}/session/ensure-admin-access`,
    { method: 'POST', body: JSON.stringify({ companyId, uid }) },
  );
}

export async function sessionMe() {
  return jsonFetch<{
    ok: boolean;
    companyId: string;
    company: string;
    ownerName?: string;
    email?: string;
  }>(`${API}/session/me`);
}

export async function accountStatus(companyId: string) {
  return jsonFetch<{
    canAccess: boolean;
    loginBlocked: boolean;
    blockMessage?: string;
    planName?: string;
  }>(`${API}/account-status?companyId=${encodeURIComponent(companyId)}`);
}

export async function jobCommand(payload: {
  bookingId: number;
  command: 'assign' | 'accept' | 'cancel' | 'recall' | 'update' | 'complete';
  by: 'dispatcher' | 'driver' | 'passenger' | 'website';
  ifVersion?: number;
  payload?: Record<string, unknown>;
}) {
  return jsonFetch(`${API}/job/command`, { method: 'POST', body: JSON.stringify(payload) });
}

export { setJobEditLock, tryAcquireJobEditLock, formatJobEditLockLabel } from '@/lib/jobEditLock';

export async function createJob(body: Record<string, unknown>) {
  return jsonFetch<{ ok: boolean; bookingId?: number; jobId?: string | number }>(`${API}/job/create`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateBooking(body: Record<string, unknown>) {
  return jsonFetch(`${API}/booking/update`, { method: 'POST', body: JSON.stringify(body) });
}

function applyChangesToJob(job: Job, changes: Record<string, unknown>, seq?: number): Job {
  const status = changes.BookingStatus ?? changes.Status;
  const dispatchBeforeMinutes =
    changes.DispatchTimebefore !== undefined || changes.Dispatchbefore !== undefined
      ? parseInt(String(changes.DispatchTimebefore ?? changes.Dispatchbefore ?? 0), 10) || 0
      : job.dispatchBeforeMinutes ?? 0;

  let scheduledFor = job.scheduledFor;
  if (changes.ScheduledFor !== undefined || changes.ScheduledForMs !== undefined) {
    const raw = changes.ScheduledFor ?? changes.ScheduledForMs;
    const n = Number(raw);
    scheduledFor = n > 0 && !Number.isNaN(n) ? n : undefined;
  } else if (dispatchBeforeMinutes === 0 && editChangesTouchTiming(changes)) {
    scheduledFor = undefined;
  }

  let notifyDispatchAt = job.notifyDispatchAt;
  if (changes.NotifyDispatchAt !== undefined) {
    const raw = String(changes.NotifyDispatchAt || '').trim();
    notifyDispatchAt = raw || undefined;
  } else if (dispatchBeforeMinutes === 0 && editChangesTouchTiming(changes)) {
    notifyDispatchAt = undefined;
  }

  return {
    ...job,
    pickAddress: String(changes.PickAddress ?? changes.PickLocation ?? job.pickAddress),
    pickLatLng: String(changes.PickLatLng ?? job.pickLatLng),
    dropAddress: String(changes.DropAddress ?? changes.DropLocation ?? job.dropAddress),
    dropLatLng: String(changes.DropLatLng ?? job.dropLatLng),
    passengerName: String(changes.Name ?? job.passengerName),
    passengerPhone: String(changes.PhoneNo ?? job.passengerPhone),
    notes: String(changes.Notes ?? job.notes ?? ''),
    paymentType: String(changes.PaymentMethod ?? changes.PaymentType ?? job.paymentType),
    serviceType: String(changes.serviceType ?? changes.ServiceType ?? job.serviceType) as Job['serviceType'],
    bookingDateTime: String(changes.BookingDateTime ?? changes.Pickingtime ?? job.bookingDateTime),
    dispatchBeforeMinutes,
    scheduledFor,
    notifyDispatchAt,
    status: status != null ? (String(status) as Job['status']) : job.status,
    driverId:
      changes.DriverId != null
        ? Number(changes.DriverId) === -1
          ? '-1'
          : Number(changes.DriverId) <= 0
            ? undefined
            : String(changes.DriverId)
        : job.driverId,
    vehicleId:
      changes.VehicleId != null
        ? Number(changes.VehicleId) === 0
          ? undefined
          : String(changes.VehicleId)
        : job.vehicleId,
    vehicleType: String(changes.VehicleType ?? job.vehicleType ?? ''),
    tariffId: changes.TarriffId != null ? String(changes.TarriffId) : job.tariffId,
    tariffName: changes.TarriffName != null ? String(changes.TarriffName) : job.tariffName,
    estimatedFare: String(changes.EstimatedFare ?? changes.CustomeRate ?? job.estimatedFare ?? ''),
    urgent: changes.Urgent === 'Yes' || changes.Urgent === true,
    corner: changes.CornerAddress ? String(changes.CornerAddress).length > 0 : job.corner,
    createdAt: job.createdAt,
    lastEditedAt: changes.lastEditedAt != null ? String(changes.lastEditedAt) : job.lastEditedAt,
    lastEditedBy: changes.lastEditedBy != null ? String(changes.lastEditedBy) : job.lastEditedBy,
    editHistory:
      changes.editHistory && Array.isArray(changes.editHistory)
        ? (changes.editHistory as Job['editHistory'])
        : job.editHistory,
    updateSeq: seq ?? (job.updateSeq ?? 0) + 1,
  };
}

function firebasePatchFromChanges(changes: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const map: Record<string, string> = {
    PickAddress: 'PickAddress',
    DropAddress: 'DropAddress',
    PickLatLng: 'PickLatLng',
    DropLatLng: 'DropLatLng',
    Name: 'PassengerName',
    PhoneNo: 'PhoneNo',
    Notes: 'Notes',
    PaymentMethod: 'PaymentType',
    PaymentType: 'PaymentType',
    serviceType: 'serviceType',
    BookingDateTime: 'BookingDateTime',
    DispatchTimebefore: 'DispatchTimebefore',
    Dispatchbefore: 'Dispatchbefore',
    ScheduledFor: 'ScheduledFor',
    NotifyDispatchAt: 'NotifyDispatchAt',
    BookingStatus: 'Status',
    Status: 'Status',
    EstimatedFare: 'Fare',
    Urgent: 'Urgent',
    VehicleType: 'VehicleType',
  };
  for (const [from, to] of Object.entries(map)) {
    if (changes[from] !== undefined) patch[to] = changes[from];
  }
  if (changes.BookingStatus !== undefined) {
    patch.BookingStatus = changes.BookingStatus;
    if (patch.Status === undefined) patch.Status = changes.BookingStatus;
  }
  if (changes.Status !== undefined) {
    patch.Status = changes.Status;
    if (patch.BookingStatus === undefined) patch.BookingStatus = changes.Status;
  }
  if (changes.Name !== undefined) patch.Name = changes.Name;
  if (changes.DriverId !== undefined) patch.DriverId = changes.DriverId;
  if (changes.VehicleId !== undefined) patch.VehicleId = changes.VehicleId;
  if (changes.releasedAt !== undefined) patch.releasedAt = changes.releasedAt;
  if (changes.manualOffer !== undefined) patch.manualOffer = changes.manualOffer;
  if (changes.queuedAt === null || changes.QueuedAt === null) {
    patch.queuedAt = null;
    patch.QueuedAt = null;
    patch.eventType = changes.eventType ?? 'updated';
  }
  if (changes.ScheduledFor === 0 || changes.ScheduledForMs === 0) {
    patch.ScheduledFor = null;
  }
  if (changes.NotifyDispatchAt === '') {
    patch.NotifyDispatchAt = null;
  }
  return patch;
}

function shouldMirrorToPendingJobs(status: JobStatus | string): boolean {
  const st = normalizeJobStatus(String(status));
  return st === 'Pending' || st === 'No One' || st === 'Offered' || st === 'Scheduled';
}

/** Best-effort client mirror — server fanout is authoritative; must not block Save. */
function mirrorJobChangesToFirebase(
  companyId: string,
  jobId: number,
  changes: Record<string, unknown>,
  status: JobStatus | string,
  authoritativeSeq: number,
): void {
  void (async () => {
    try {
      const db = getDb();
      const fbPatch = firebasePatchFromChanges(changes);
      if (Object.keys(fbPatch).length === 0) return;
      fbPatch._seq = authoritativeSeq;
      fbPatch.version = authoritativeSeq;
      fbPatch.updateSeq = authoritativeSeq;
      const st = normalizeJobStatus(String(status));
      if (st === 'Queued') {
        fbPatch.BookingStatus = 'Queued';
        fbPatch.Status = 'Queued';
        fbPatch.eventType = 'queued';
      } else {
        fbPatch.eventType = 'updated';
      }
      if (shouldMirrorToPendingJobs(status)) {
        await update(ref(db, `pendingjobs/${companyId}/${jobId}`), fbPatch);
      }
      await update(ref(db, `allbookings/${companyId}/${jobId}`), fbPatch);
    } catch {
      /* non-fatal */
    }
  })();
}

type BookingUpdateResult = {
  ok: boolean;
  seq?: number;
  error?: string;
  error_code?: string;
  stale?: boolean;
  currentSeq?: number;
  status: number;
};

async function postBookingUpdate(body: Record<string, unknown>): Promise<BookingUpdateResult> {
  const r = await fetch(`${API}/booking/update`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await r.json().catch(() => ({}))) as BookingUpdateResult;
  return { ...data, ok: !!data.ok && r.ok, status: r.status };
}

function seqFromFirebaseRecord(rec: Record<string, unknown>): number {
  return jobUpdateSeqFromRecord(rec);
}

async function fetchFreshJobFromFirebase(companyId: string, jobId: number): Promise<Job | null> {
  const readPath = async (path: string): Promise<Job | null> => {
    try {
      const db = getDb();
      const snap = await get(ref(db, `${path}/${companyId}/${jobId}`));
      const val = snap.val();
      if (!val || typeof val !== 'object') return null;
      const rec = val as Record<string, unknown>;
      const job = jobFromFirebase(String(jobId), rec, companyId);
      if (!job) return null;
      return { ...job, updateSeq: seqFromFirebaseRecord(rec) };
    } catch {
      return null;
    }
  };
  const fromAll = await readPath('allbookings');
  const fromPending = await readPath('pendingjobs');
  if (fromAll && fromPending) return mergeJobUpdate(fromAll, fromPending);
  return fromAll ?? fromPending;
}

/** Load authoritative job snapshot from Firebase (both pendingjobs + allbookings). */
export async function hydrateJobFromServer(companyId: string, jobId: number): Promise<Job | null> {
  return fetchFreshJobFromFirebase(companyId, jobId);
}

async function persistJobUpdate(
  jobId: number,
  companyId: string,
  changes: Record<string, unknown>,
  baseJob: Job
): Promise<void> {
  if (Object.keys(changes).length === 0) return;

  const effectiveChanges = applyClientTimingEditPrelude(baseJob, changes);

  const attempt = async (seq: number): Promise<BookingUpdateResult> =>
    postBookingUpdate({
      bookingId: jobId,
      companyId,
      changes: effectiveChanges,
      by: 'dispatcher',
      ifSeq: seq,
      sessionId: getEditLockSessionId(),
    });

  // Use pre-optimistic baseJob seq — store may already carry optimisticSeq+1.
  let ifSeq = baseJob.updateSeq ?? 0;
  let result: BookingUpdateResult | null = null;

  for (let tries = 0; tries < 5; tries++) {
    result = await attempt(ifSeq);
    if (result.ok) break;

    if (result.stale) {
      if (result.currentSeq != null) ifSeq = result.currentSeq;
      const fresh = await fetchFreshJobFromFirebase(companyId, jobId);
      if (fresh) {
        ifSeq = Math.max(ifSeq, fresh.updateSeq ?? 0);
        useJobStore.getState().upsertJob({ ...fresh, updateSeq: ifSeq });
      }
      continue;
    }
    if (result.error_code === 'edit_locked') {
      break;
    }
    break;
  }

  if (!result?.ok) {
    const fresh = await fetchFreshJobFromFirebase(companyId, jobId);
    if (fresh) useJobStore.getState().upsertJob(fresh);
    const message = result?.error || 'Could not save changes';
    useUiStore.getState().addToast({
      type: 'error',
      title: 'Job update failed',
      message,
    });
    throw new Error(message);
  }

  if (result.idempotent && isExplicitUnassignChanges(effectiveChanges)) {
    const fresh = await fetchFreshJobFromFirebase(companyId, jobId);
    if (fresh) useJobStore.getState().upsertJob(fresh);
    const message = 'Unassign was not applied on the server — job may still be assigned';
    useUiStore.getState().addToast({ type: 'error', title: 'Unassign failed', message });
    throw new Error(message);
  }

  const authoritativeSeq = result.seq ?? ifSeq + 1;
  const storeBefore = latestStoreJob(jobId);
  const appliedFromBase = applyChangesToJob(baseJob, effectiveChanges, authoritativeSeq);
  const pinnedQueued = pinQueuedOptimisticJob(baseJob, appliedFromBase);
  let merged: Job;
  let upsertPath: string;
  if (pinnedQueued) {
    // Authority confirmed Queue tab — never upsert a U-A flash for queued edits.
    merged = pinnedQueued;
    upsertPath = 'pinned-queue';
  } else {
    const current = storeBefore ?? baseJob;
    merged = applyChangesToJob(current, effectiveChanges, authoritativeSeq);
    upsertPath = 'fallback-latest-store';
  }
  console.log('[queue-edit-pin]', {
    phase: 'persistJobUpdate-upsert',
    jobId,
    upsertPath,
    authoritativeSeq,
    changeKeys: Object.keys(effectiveChanges),
    baseJob: {
      status: baseJob.status,
      driverId: baseJob.driverId,
      vehicleId: baseJob.vehicleId,
    },
    storeBefore: storeBefore
      ? { status: storeBefore.status, driverId: storeBefore.driverId, vehicleId: storeBefore.vehicleId }
      : null,
    appliedFromBase: {
      status: appliedFromBase.status,
      driverId: appliedFromBase.driverId,
      vehicleId: appliedFromBase.vehicleId,
    },
    upsert: {
      status: merged.status,
      driverId: merged.driverId,
      vehicleId: merged.vehicleId,
    },
    at: Date.now(),
  });
  useJobStore.getState().upsertJob(merged);
  mirrorJobChangesToFirebase(companyId, jobId, effectiveChanges, merged.status, authoritativeSeq);

  const fresh = await fetchFreshJobFromFirebase(companyId, jobId);
  if (fresh) {
    const afterFresh = mergeJobUpdateFromServer(merged, fresh, authoritativeSeq);
    console.log('[queue-edit-pin]', {
      phase: 'persistJobUpdate-after-fresh',
      jobId,
      fresh: { status: fresh.status, driverId: fresh.driverId, vehicleId: fresh.vehicleId, updateSeq: fresh.updateSeq },
      afterFresh: {
        status: afterFresh.status,
        driverId: afterFresh.driverId,
        vehicleId: afterFresh.vehicleId,
        updateSeq: afterFresh.updateSeq,
      },
      at: Date.now(),
    });
    useJobStore.getState().upsertJob(afterFresh);
  } else {
    console.log('[queue-edit-pin]', {
      phase: 'persistJobUpdate-no-fresh',
      jobId,
      at: Date.now(),
    });
  }
}

function mergeJobUpdateFromServer(optimistic: Job, fresh: Job, authoritativeSeq: number): Job {
  const seq = Math.max(authoritativeSeq, fresh.updateSeq ?? 0, optimistic.updateSeq ?? 0);
  const optSt = normalizeJobStatus(optimistic.status);
  const freshSt = normalizeJobStatus(fresh.status);
  const poolUnassign =
    (optSt === 'Pending' || optSt === 'No One') &&
    ['Assigned', 'Picking', 'Arrived', 'Active', 'OnTrip', 'Offered', 'Queued'].includes(freshSt);
  if (poolUnassign && seq >= (fresh.updateSeq ?? 0)) {
    return { ...optimistic, updateSeq: seq };
  }
  let merged = mergeJobUpdate(optimistic, { ...fresh, updateSeq: seq });
  if ((fresh.dispatchBeforeMinutes ?? 0) === 0 && (optimistic.dispatchBeforeMinutes ?? 0) > 0) {
    merged = {
      ...merged,
      dispatchBeforeMinutes: 0,
      scheduledFor: fresh.scheduledFor,
      notifyDispatchAt: fresh.notifyDispatchAt,
    };
  }
  if (
    normalizeJobStatus(fresh.status) === 'Pending' &&
    normalizeJobStatus(optimistic.status) === 'Scheduled' &&
    seq >= (fresh.updateSeq ?? 0)
  ) {
    merged.status = fresh.status;
  }
  return retainQueuedOptimisticAfterServerMerge(optimistic, { ...merged, updateSeq: seq });
}

async function updateJobInner(
  jobId: number,
  companyId: string,
  changes: Record<string, unknown>,
  existingJob: Job
): Promise<void> {
  if (Object.keys(changes).length === 0) return;

  const baseline = latestStoreJob(jobId) ?? existingJob;
  const effectiveChanges = applyClientTimingEditPrelude(baseline, changes);
  const optimisticSeq = (baseline.updateSeq ?? 0) + 1;
  const optimisticJob = applyChangesToJob(baseline, effectiveChanges, optimisticSeq);
  useJobStore.getState().upsertJob(optimisticJob);

  try {
    await persistJobUpdate(jobId, companyId, changes, baseline);
  } catch (e) {
    useJobStore.getState().upsertJob(baseline);
    throw e;
  }
}

export async function updateJob(
  jobId: number,
  companyId: string,
  changes: Record<string, unknown>,
  existingJob: Job
): Promise<void> {
  if (Object.keys(changes).length === 0) return;

  const prev = jobUpdateChains.get(jobId) ?? Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(() => updateJobInner(jobId, companyId, changes, existingJob));
  jobUpdateChains.set(jobId, next);
  try {
    await next;
  } finally {
    if (jobUpdateChains.get(jobId) === next) jobUpdateChains.delete(jobId);
  }
}

export async function setJobStatus(
  companyId: string,
  bookingId: number,
  status: JobStatus,
  extra: Record<string, unknown> = {},
  ifSeq?: number
) {
  const { originalStatus, ifVersion, ...rest } = extra;
  void companyId;
  void originalStatus;
  return updateBooking({
    bookingId,
    by: 'dispatcher',
    ifSeq: ifSeq ?? (typeof ifVersion === 'number' ? ifVersion : undefined),
    changes: { BookingStatus: status, Status: status, ...rest },
  });
}

type JobCommandResult = {
  ok: boolean;
  status?: string;
  version?: number;
  driverId?: string;
  vehicleId?: string;
  error?: string;
  error_code?: string;
  stale?: boolean;
  currentVersion?: number;
  booking?: Record<string, unknown>;
  statusCode?: number;
};

async function postJobCommand(payload: {
  bookingId: number;
  command: 'assign' | 'accept' | 'cancel' | 'recall' | 'update' | 'complete';
  by: 'dispatcher' | 'driver' | 'passenger' | 'website';
  ifVersion?: number;
  payload?: Record<string, unknown>;
}): Promise<JobCommandResult> {
  const r = await fetch(`${API}/job/command`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await r.json().catch(() => ({}))) as JobCommandResult;
  return { ...data, ok: !!data.ok && r.ok, statusCode: r.status };
}

function applyAssignResultToJob(job: Job, driverId: string, vehicleId: string, result: JobCommandResult): Job {
  const nextStatus = (result.status || 'Offered') as Job['status'];
  const seq = result.version ?? (job.updateSeq ?? 0) + 1;
  return {
    ...job,
    status: nextStatus,
    driverId,
    vehicleId: vehicleId || job.vehicleId,
    updateSeq: seq,
  };
}

export async function assignJob(
  bookingId: number,
  driverId: string,
  vehicleId: string,
  ifVersion?: number,
  baseJob?: Job,
  opts?: { fanout?: boolean }
): Promise<void> {
  let ifVer = ifVersion ?? baseJob?.updateSeq ?? 0;
  const attempt = async (): Promise<JobCommandResult> =>
    postJobCommand({
      bookingId,
      command: 'assign',
      by: 'dispatcher',
      ifVersion: ifVer,
      payload: { driverId, vehicleId, fanout: opts?.fanout === true },
    });

  let result = await attempt();

  if (!result.ok && (result.stale || result.error_code === 'version_conflict')) {
    ifVer = result.currentVersion ?? ifVer;
    const fresh =
      baseJob?.companyId != null
        ? await fetchFreshJobFromFirebase(baseJob.companyId, bookingId)
        : null;
    if (fresh) {
      ifVer = Math.max(ifVer, fresh.updateSeq ?? 0);
      useJobStore.getState().upsertJob(fresh);
    }
    result = await attempt();
  }

  if (!result.ok) {
    const message = result.error || 'Could not assign driver';
    useUiStore.getState().addToast({
      type: 'error',
      title: 'Assign failed',
      message,
    });
    throw new Error(message);
  }

  const job = baseJob ?? useJobStore.getState().jobs.find((j) => j.id === bookingId);
  if (job) {
    useJobStore.getState().upsertJob(applyAssignResultToJob(job, driverId, vehicleId, result));
  }
}

export async function cancelJob(
  bookingId: number,
  companyId: string,
  dispatcherName = 'Dispatcher'
) {
  const cancelledAt = new Date().toISOString();
  const cancelSource = 'Dispatcher';
  const cancelReason = dispatcherName && dispatcherName !== 'Dispatcher'
    ? `Cancelled by ${dispatcherName}`
    : 'Cancelled by Dispatcher';

  const result = await jsonFetch<{ ok?: boolean; error?: string }>(`${API}/cancel`, {
    method: 'POST',
    body: JSON.stringify({
      bookingId,
      companyId,
      cancelledBy: 'dispatcher',
      cancelledAt,
      reason: cancelReason,
      dispatcherName,
      terminalKind: 'Cancelled',
    }),
  });

  if (result.ok === false) {
    throw new Error(result.error || 'Cancel rejected by server');
  }

  const suppressSeq = latestJobSeq(bookingId);
  purgeDispatchTerminalJob(bookingId, suppressSeq);

  try {
    const db = getDb();
    await remove(ref(db, `pendingjobs/${companyId}/${bookingId}`));
    await update(ref(db, `allbookings/${companyId}/${bookingId}`), {
      status: 'Cancelled',
      BookingStatus: 'Cancelled',
      Status: 'Cancelled',
      cancelledBy: dispatcherName,
      CancelledBy: dispatcherName,
      CancelSource: cancelSource,
      cancelledAt,
      CancelledAt: cancelledAt,
      cancelReason,
      CancelReason: cancelReason,
      TerminalKind: 'Cancelled',
    });
  } catch {
    /* server may have already updated Firebase */
  }
}

export async function recallJob(bookingId: number, originalStatus: JobStatus) {
  const existing = latestStoreJob(bookingId);
  const result = await jobCommand({
    bookingId,
    command: 'recall',
    by: 'dispatcher',
    payload: { originalStatus },
  }) as { ok?: boolean; booking?: Record<string, unknown>; version?: number };
  if (!result?.ok) {
    throw new Error('Recall failed');
  }
  const booking = result.booking;
  const restoredStatus = normalizeJobStatus(
    String(booking?.BookingStatus ?? booking?.Status ?? 'Pending'),
  );
  const seq = Number(booking?.updateSeq ?? booking?.version ?? result.version ?? existing?.updateSeq ?? 0);
  if (existing) {
    useJobStore.getState().upsertJob({
      ...existing,
      status: restoredStatus,
      driverId: undefined,
      vehicleId: undefined,
      updateSeq: seq || (existing.updateSeq ?? 0) + 1,
      returnReason: String(booking?.returnReason ?? 'Recalled by dispatcher'),
    });
  }
  return result;
}

export async function forceCompleteJob(bookingId: number) {
  return jobCommand({
    bookingId,
    command: 'complete',
    by: 'dispatcher',
    payload: {},
  });
}

export async function applyJobAssignment(
  job: Job,
  selection: string,
  onlineDrivers: Array<{ driverId: string; vehicleId: string }>
): Promise<'pending' | 'noone' | 'assign' | 'reassign'> {
  if (selection === '__pending__') {
    await setPending(job);
    return 'pending';
  }
  if (selection === '__noone__') {
    await setNoOne(job);
    return 'noone';
  }
  const d = onlineDrivers.find((x) => x.driverId === selection);
  if (!d) throw new Error('Driver not found');
  if (isPreDispatchWindow(job)) {
    const message = preDispatchAssignBlockMessage(job);
    useUiStore.getState().addToast({ type: 'error', title: 'Cannot assign yet', message });
    throw new Error(message);
  }
  const hadDriver = !!(job.driverId && isAssignedDriverSelection(job.driverId));
  const isReassign = hadDriver && job.driverId !== d.driverId;
  await assignJob(job.id, d.driverId, d.vehicleId, job.updateSeq, job);
  return isReassign ? 'reassign' : 'assign';
}

/** Apply driver dropdown choice from the create/edit job form. */
export async function applyFormDriverAssignment(
  job: Job,
  form: { driverId: string; vehicleId: string },
  availableDrivers: Array<{ driverId: string; vehicleId: string }>,
  opts?: { fanout?: boolean }
): Promise<void> {
  if (isAssignedDriverSelection(form.driverId)) {
    if (isPreDispatchWindow(job)) {
      const message = preDispatchAssignBlockMessage(job);
      useUiStore.getState().addToast({ type: 'error', title: 'Cannot assign yet', message });
      throw new Error(message);
    }
    const d =
      availableDrivers.find((x) => x.driverId === form.driverId) ??
      ({ driverId: form.driverId, vehicleId: form.vehicleId || '0' } as const);
    await assignJob(job.id, d.driverId, d.vehicleId || form.vehicleId || '0', job.updateSeq, job, opts);
    return;
  }
  if (form.driverId === '-1') {
    await setNoOne(job);
    return;
  }
  await setPending(job);
}

export async function setPending(job: Job) {
  const hadDriver = !!(job.driverId && isAssignedDriverSelection(job.driverId));
  return updateJob(job.id, job.companyId, {
    BookingStatus: 'Pending',
    Status: 'Pending',
    DriverId: 0,
    VehicleId: 0,
    releasedAt: null,
    manualOffer: false,
    queuedAt: null,
    QueuedAt: null,
    eventType: 'updated',
    ...(hadDriver && job.driverId ? { _withdrawDriverId: job.driverId } : {}),
  }, job);
}

export async function setNoOne(job: Job) {
  const hadDriver = !!(job.driverId && isAssignedDriverSelection(job.driverId));
  return updateJob(job.id, job.companyId, {
    BookingStatus: 'No One',
    Status: 'No One',
    DriverId: -1,
    VehicleId: 0,
    queuedAt: null,
    QueuedAt: null,
    eventType: 'updated',
    ...(hadDriver ? { manualOffer: true } : {}),
    ...(hadDriver && job.driverId ? { _withdrawDriverId: job.driverId } : {}),
  }, job);
}

export function logoutSession() {
  document.cookie = 'BW_SID=; Max-Age=0; path=/';
  window.location.href = '/login';
}
