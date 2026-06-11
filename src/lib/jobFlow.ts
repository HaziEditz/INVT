import type { Job, JobStatus } from '@/types/job';
import { getDb, ref, remove, update } from '@/lib/firebase';
import { useJobStore } from '@/store/jobStore';

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

export async function assignJob(
  bookingId: number,
  driverId: string,
  vehicleId: string,
  ifVersion = 0
) {
  return jobCommand({
    bookingId,
    command: 'assign',
    by: 'dispatcher',
    ifVersion,
    payload: { driverId, vehicleId },
  });
}

export async function cancelJob(
  bookingId: number,
  companyId: string,
  dispatcherName = 'Dispatcher'
) {
  const cancelledAt = new Date().toISOString();
  const cancelReason = 'Cancelled by dispatcher';

  // Remove immediately from local state — do not wait for API or Firebase
  useJobStore.getState().removeJob(bookingId);

  await jsonFetch(`${API}/cancel`, {
    method: 'POST',
    body: JSON.stringify({
      bookingId,
      companyId,
      cancelledBy: 'dispatcher',
      cancelledAt,
      reason: cancelReason,
      dispatcherName,
    }),
  });

  try {
    const db = getDb();
    await remove(ref(db, `pendingjobs/${companyId}/${bookingId}`));
    await update(ref(db, `allbookings/${companyId}/${bookingId}`), {
      status: 'Cancelled',
      BookingStatus: 'Cancelled',
      Status: 'Cancelled',
      cancelledBy: dispatcherName,
      CancelledBy: dispatcherName,
      cancelledAt,
      CancelledAt: cancelledAt,
      cancelReason,
      CancelReason: cancelReason,
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

export async function setPending(job: Job) {
  return setJobStatus(job.companyId, job.id, 'Pending', { originalStatus: 'pending' }, job.updateSeq);
}

export async function setNoOne(job: Job) {
  return setJobStatus(job.companyId, job.id, 'No One', { originalStatus: 'no_one' }, job.updateSeq);
}

export function logoutSession() {
  document.cookie = 'BW_SID=; Max-Age=0; path=/';
  window.location.href = '/login';
}
