import assert from 'node:assert/strict';
import { ADMIN_KEY, TEST_CID } from './config.mjs';
import { get, post } from './http.mjs';

export async function fetchJobTrace(bookingId, companyId = TEST_CID) {
  const r = await get(`/admin/jobTrace/${bookingId}?cid=${encodeURIComponent(companyId)}`, {
    'X-Admin-Key': ADMIN_KEY,
  });
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
  if (fbAb) {
    assert.notEqual(fbAb.editLockActive, true, `${prefix}allbookings editLockActive`);
    assert.notEqual(fbAb.jobEditing, true, `${prefix}allbookings jobEditing`);
    assert.notEqual(fbAb.dispatcherEditing, true, `${prefix}allbookings dispatcherEditing`);
  }
  if (fbPj) {
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
    try {
      last = await fetchJobTrace(bookingId, companyId);
      if (predicate(last)) return last;
      lastErr = null;
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
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
