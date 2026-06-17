import type { Job, JobStatus } from '@/types/job';
import { jobFromFirebase, jobUpdateSeqFromRecord, normalizeJobStatus, isPreDispatchWindow, preDispatchAssignBlockMessage } from '@/types/job';
import { getDb, ref, remove, update, get } from '@/lib/firebase';
import { purgeCancelledJobFromListeners } from '@/hooks/useJobs';
import { isAssignedDriverSelection } from '@/lib/createJobForm';
import { useJobStore } from '@/store/jobStore';
import { useUiStore } from '@/store/uiStore';

const API = '/api';

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

export async function sessionLogin(companyId: string, uid: string) {
  return jsonFetch<{ ok: boolean; companyId: string; company: string; ownerName?: string }>(
    `${API}/session/login`,
    { method: 'POST', body: JSON.stringify({ companyId, uid }) }
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
  const scheduledRaw = changes.ScheduledFor ?? changes.ScheduledForMs;
  const scheduledFor =
    scheduledRaw !== undefined
      ? Number(scheduledRaw) || undefined
      : job.scheduledFor;
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
    dispatchBeforeMinutes:
      parseInt(String(changes.DispatchTimebefore ?? changes.Dispatchbefore ?? job.dispatchBeforeMinutes ?? 0), 10) ||
      0,
    scheduledFor: scheduledFor === 0 ? undefined : scheduledFor,
    notifyDispatchAt:
      changes.NotifyDispatchAt !== undefined
        ? String(changes.NotifyDispatchAt || '')
        : job.notifyDispatchAt,
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
      fbPatch.eventType = 'updated';
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
  return (await readPath('allbookings')) ?? (await readPath('pendingjobs'));
}

async function persistJobUpdate(
  jobId: number,
  companyId: string,
  changes: Record<string, unknown>,
  baseJob: Job
): Promise<void> {
  if (Object.keys(changes).length === 0) return;

  let ifSeq = baseJob.updateSeq ?? 0;

  const attempt = async (): Promise<BookingUpdateResult> =>
    postBookingUpdate({
      bookingId: jobId,
      companyId,
      changes,
      by: 'dispatcher',
      ifSeq,
    });

  let result: BookingUpdateResult | null = null;
  for (let tries = 0; tries < 3; tries++) {
    const live = useJobStore.getState().jobs.find((j) => j.id === jobId);
    if (tries > 0 && live?.updateSeq != null) {
      ifSeq = live.updateSeq;
    }

    result = await attempt();
    if (result.ok) break;

    if (result.stale) {
      if (result.currentSeq != null) ifSeq = result.currentSeq;
      const fresh = await fetchFreshJobFromFirebase(companyId, jobId);
      if (fresh) {
        ifSeq = fresh.updateSeq ?? ifSeq;
        useJobStore.getState().upsertJob(fresh);
      }
      continue;
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

  const current = useJobStore.getState().jobs.find((j) => j.id === jobId) ?? baseJob;
  const authoritativeSeq = result.seq ?? (ifSeq != null ? ifSeq + 1 : (current.updateSeq ?? 0) + 1);
  const merged = applyChangesToJob(current, changes, authoritativeSeq);
  useJobStore.getState().upsertJob(merged);
  mirrorJobChangesToFirebase(companyId, jobId, changes, merged.status, authoritativeSeq);
  const fresh = await fetchFreshJobFromFirebase(companyId, jobId);
  if (fresh) useJobStore.getState().upsertJob(fresh);
}

export async function updateJob(
  jobId: number,
  companyId: string,
  changes: Record<string, unknown>,
  existingJob: Job
): Promise<void> {
  if (Object.keys(changes).length === 0) return;

  const optimisticSeq = (existingJob.updateSeq ?? 0) + 1;
  const optimisticJob = applyChangesToJob(existingJob, changes, optimisticSeq);
  useJobStore.getState().upsertJob(optimisticJob);

  await persistJobUpdate(jobId, companyId, changes, existingJob);
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
  let ifVer = ifVersion;
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
    const job = baseJob ?? useJobStore.getState().jobs.find((j) => j.id === bookingId);
    ifVer = result.currentVersion ?? job?.updateSeq ?? ifVer;
    if (job) useJobStore.getState().upsertJob(job);
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

  purgeCancelledJobFromListeners(bookingId);
  useJobStore.getState().removeJob(bookingId);

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
  return jobCommand({
    bookingId,
    command: 'recall',
    by: 'dispatcher',
    payload: { originalStatus },
  });
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
    ...(hadDriver ? { manualOffer: true } : {}),
    ...(hadDriver && job.driverId ? { _withdrawDriverId: job.driverId } : {}),
  }, job);
}

export function logoutSession() {
  document.cookie = 'BW_SID=; Max-Age=0; path=/';
  window.location.href = '/login';
}
