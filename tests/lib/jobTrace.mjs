import assert from 'node:assert/strict';
import { ADMIN_KEY, TEST_CID } from './config.mjs';
import { DEFAULT_HTTP_TIMEOUT_MS, get, post } from './http.mjs';

/** Per-request timeout for jobTrace polls — hung server must fail fast. */
export const JOB_TRACE_HTTP_TIMEOUT_MS = DEFAULT_HTTP_TIMEOUT_MS;

export async function fetchJobTrace(bookingId, companyId = TEST_CID) {
  const r = await get(
    `/admin/jobTrace/${bookingId}?cid=${encodeURIComponent(companyId)}`,
    { 'X-Admin-Key': ADMIN_KEY },
    { timeoutMs: JOB_TRACE_HTTP_TIMEOUT_MS },
  );
  assert.equal(r.status, 200, `jobTrace HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
  assert.equal(r.body.ok, true, `jobTrace not ok for #${bookingId}`);
  return r.body;
}

export function jobStoreStatus(trace) {
  return String(trace.jobStore?.lifecycle?.status || trace.jobStore?.rawFlags?.status || '').trim();
}

export function readFirebaseStatus(node) {
  if (!node || typeof node !== 'object') return null;
  return String(node.BookingStatus || node.Status || '').trim() || null;
}

export function assertFirebaseHealthy(trace, label = '') {
  const hint = trace.dispatchUiHint || {};
  const prefix = label ? `${label}: ` : '';
  assert.notEqual(hint.pendingVsAllbookingsMismatch, true, `${prefix}pending vs allbookings mismatch`);
  assert.notEqual(hint.jobStoreVsPendingMismatch, true, `${prefix}jobStore vs pending mismatch`);
  assert.notEqual(hint.jobStoreVsAllbookingsMismatch, true, `${prefix}jobStore vs allbookings mismatch`);
  assert.notEqual(hint.splitBrainOrphan, true, `${prefix}split-brain orphan`);
}

export function assertEditLockClear(trace, label = '') {
  const prefix = label ? `${label}: ` : '';
  const fbAb = trace.firebase?.allbookings;
  const fbPj = trace.firebase?.pendingjobs;
  const st = String(trace.jobStore?.lifecycle?.BookingStatus || trace.jobStore?.lifecycle?.Status || '');
  const checkPendingJobs = ['Pending', 'No One', 'Scheduled'].includes(st);
  if (fbAb) {
    assert.notEqual(fbAb.editLockActive, true, `${prefix}allbookings editLockActive`);
    assert.notEqual(fbAb.jobEditing, true, `${prefix}allbookings jobEditing`);
    assert.notEqual(fbAb.dispatcherEditing, true, `${prefix}allbookings dispatcherEditing`);
  }
  if (fbPj && checkPendingJobs) {
    assert.notEqual(fbPj.editLockActive, true, `${prefix}pendingjobs editLockActive`);
  }
}

export async function pollJobTrace(
  bookingId,
  predicate,
  { timeoutMs = 15000, intervalMs = 400, companyId = TEST_CID } = {},
) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  let lastErr = null;
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      last = await fetchJobTrace(bookingId, companyId);
      if (predicate(last)) return last;
      lastErr = null;
    } catch (e) {
      lastErr = e;
      // Hard transport failure (timeout / reset) — do not spin until outer deadline.
      const msg = String(e && e.message ? e.message : e);
      if (/timed out|ECONNRESET|ECONNREFUSED|EPIPE|socket hang up/i.test(msg)) {
        throw new Error(`pollJobTrace transport error for #${bookingId}: ${msg}`);
      }
    }
    await new Promise((r) => setTimeout(r, Math.min(intervalMs, Math.max(0, deadline - Date.now()))));
  }
  const detail = lastErr ? lastErr.message : JSON.stringify(last?.dispatchUiHint || last, null, 2);
  throw new Error(`pollJobTrace timeout for #${bookingId}: ${detail}`);
}

export function assertStatusSync(trace, expectedStatus, label = '') {
  const prefix = label ? `${label}: ` : '';
  const st = expectedStatus;
  const storeStatus = String(trace.jobStore?.lifecycle?.BookingStatus || trace.jobStore?.lifecycle?.Status || '');
  assert.equal(storeStatus, st, `${prefix}jobStore status`);
  const ab = readFirebaseStatus(trace.firebase?.allbookings);
  const pj = readFirebaseStatus(trace.firebase?.pendingjobs);
  if (ab) assert.equal(ab, st, `${prefix}allbookings status`);
  if (pj) assert.equal(pj, st, `${prefix}pendingjobs status`);
  assertFirebaseHealthy(trace, prefix);
}

export function assertTerminalClean(trace, expectedTerminal, label = '') {
  const prefix = label ? `${label}: ` : '';
  const live = trace.jobStore?.found === true;
  const closed = trace.jobStore?.closedFound === true;
  assert.ok(!live || closed, `${prefix}terminal job should not remain live-only in jobStore`);
  if (closed) {
    const st = String(trace.jobStore?.lifecycle?.BookingStatus || '');
    assert.equal(st, expectedTerminal, `${prefix}closed status`);
  }
  assert.equal(trace.firebase?.pendingjobs, null, `${prefix}pendingjobs should be deleted`);
  assertFirebaseHealthy(trace, prefix);
}

export async function pollFirebasePeek(path, predicate, { timeoutMs = 15000, intervalMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      const r = await get(
        `/admin/firebasePeek?path=${encodeURIComponent(path)}`,
        { 'X-Admin-Key': ADMIN_KEY },
        { timeoutMs: JOB_TRACE_HTTP_TIMEOUT_MS },
      );
      last = r.body?.node ?? null;
      if (predicate(last)) return last;
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      if (/timed out|ECONNRESET|ECONNREFUSED|EPIPE|socket hang up/i.test(msg)) {
        throw new Error(`pollFirebasePeek transport error for ${path}: ${msg}`);
      }
    }
    await new Promise((r) => setTimeout(r, Math.min(intervalMs, Math.max(0, deadline - Date.now()))));
  }
  throw new Error(`pollFirebasePeek timeout for ${path}: ${JSON.stringify(last)}`);
}
