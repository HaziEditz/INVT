import type { Job, JobEditLockInfo } from '@/types/job';
import { getEditLockSessionId } from '@/lib/editLockSession';
import { useJobStore } from '@/store/jobStore';

const API = '/api';
const RELEASE_RETRIES = 3;

export interface JobEditLockResponse {
  ok: boolean;
  locked?: boolean;
  bookingId?: number;
  conflict?: boolean;
  lock?: JobEditLockInfo;
  error?: string;
  error_code?: string;
}

export function formatJobEditLockLabel(lock?: JobEditLockInfo | null): string {
  if (!lock) return 'another user';
  const actor = (lock.actor || '').trim();
  switch (lock.source) {
    case 'dispatcher':
      return actor ? `dispatcher ${actor}` : 'another dispatcher';
    case 'passenger':
      return actor ? `passenger ${actor}` : 'the passenger app';
    case 'website':
      return actor ? `website (${actor})` : 'the website';
    default:
      return actor || lock.source || 'another user';
  }
}

export function jobEditLockHeldBySelf(job: Job, sessionId = getEditLockSessionId()): boolean {
  const lock = job.editLock;
  if (!lock?.active) return false;
  return !!lock.sessionId && lock.sessionId === sessionId;
}

export function jobEditLockBlockedForSelf(job: Job, sessionId = getEditLockSessionId()): boolean {
  const lock = job.editLock;
  if (!lock?.active) return false;
  return !jobEditLockHeldBySelf(job, sessionId);
}

/** Clear edit-lock flags in the client store immediately (e.g. after modal close). */
export function clearLocalJobEditLock(jobId: number): void {
  const job = useJobStore.getState().jobs.find((j) => j.id === jobId);
  if (!job) return;
  useJobStore.getState().upsertJob({
    ...job,
    jobEditing: false,
    editLock: undefined,
  });
}

export async function setJobEditLock(
  bookingId: number,
  locked: boolean,
  opts?: {
    actorName?: string;
    sessionId?: string;
    source?: 'dispatcher' | 'passenger' | 'website';
    forceRelease?: boolean;
  },
): Promise<JobEditLockResponse> {
  const r = await fetch(`${API}/job/edit-lock`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bookingId,
      locked,
      source: opts?.source ?? 'dispatcher',
      actorName: opts?.actorName,
      sessionId: opts?.sessionId ?? getEditLockSessionId(),
      forceRelease: opts?.forceRelease === true,
    }),
  });
  const data = (await r.json().catch(() => ({}))) as JobEditLockResponse;
  if (!r.ok) {
    return { ok: false, ...data, error: data.error || `HTTP ${r.status}` };
  }
  return { ok: true, ...data };
}

export async function releaseJobEditLock(
  jobId: number | null,
  actorName: string,
  opts?: { force?: boolean },
): Promise<boolean> {
  if (!jobId) return true;
  const sessionId = getEditLockSessionId();
  const force = opts?.force !== false;

  for (let attempt = 0; attempt < RELEASE_RETRIES; attempt++) {
    try {
      const res = await setJobEditLock(jobId, false, {
        actorName,
        sessionId,
        forceRelease: force || attempt > 0,
      });
      if (res.ok) {
        clearLocalJobEditLock(jobId);
        return true;
      }
      if (res.error_code !== 'edit_locked' && res.conflict !== true) break;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
  }

  clearLocalJobEditLock(jobId);
  return false;
}

export async function tryAcquireJobEditLock(
  bookingId: number,
  actorName: string,
): Promise<{ ok: true; sessionId: string } | { ok: false; conflict: boolean; message: string }> {
  const sessionId = getEditLockSessionId();
  const res = await setJobEditLock(bookingId, true, { actorName, sessionId });
  if (res.ok) return { ok: true, sessionId };
  const message =
    res.error ||
    (res.lock
      ? `Job is being edited by ${formatJobEditLockLabel(res.lock)}`
      : 'Could not open job for editing');
  return { ok: false, conflict: !!res.conflict || res.error_code === 'edit_locked', message };
}

/** Best-effort unlock when the tab is closing — uses keepalive fetch. */
export function releaseJobEditLockKeepalive(jobId: number, actorName: string): void {
  try {
    const body = JSON.stringify({
      bookingId: jobId,
      locked: false,
      source: 'dispatcher',
      actorName,
      sessionId: getEditLockSessionId(),
      forceRelease: true,
    });
    fetch(`${API}/job/edit-lock`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
    clearLocalJobEditLock(jobId);
  } catch {
    /* ignore */
  }
}
