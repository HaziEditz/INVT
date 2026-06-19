import crypto from 'node:crypto';
import { ADMIN_KEY, DP, DSR, TEST_CID } from './config.mjs';
import { cookieFromResponse, dmPairs, get, parseDataManager, post } from './http.mjs';
import {
  assertEditLockClear,
  assertFirebaseHealthy,
  assertStatusSync,
  fetchJobTrace,
  pollJobTrace,
} from './jobTrace.mjs';

let shared = null;

export async function getHarness() {
  if (shared) return shared;
  shared = await createHarness();
  return shared;
}

export async function createHarness() {
  await post(`/dev/loadtest/seed?drivers=2&jobs=0&cid=${encodeURIComponent(TEST_CID)}`, {});

  const login = await post('/api/session/login', { companyId: TEST_CID, uid: 'regtest-harness' });
  if (login.status !== 200) {
    throw new Error(`session login failed: ${login.status} ${JSON.stringify(login.body)}`);
  }
  const cookie = cookieFromResponse(login);

  const sessionId = crypto.randomUUID();
  const createdJobIds = new Set();

  const h = {
    companyId: TEST_CID,
    cookie,
    sessionId,
    createdJobIds,

    adminHeaders: { 'X-Admin-Key': ADMIN_KEY },
    dispatcherHeaders: { Cookie: cookie },

    async dpost(path, action, pairs = []) {
      return post(
        path,
        { action, data: dmPairs(...pairs) },
        { 'X-BW-Test-Company': TEST_CID, Cookie: cookie },
      );
    },

    async jobTrace(bookingId) {
      return fetchJobTrace(bookingId, TEST_CID);
    },

    async poll(bookingId, predicate, opts) {
      return pollJobTrace(bookingId, predicate, { companyId: TEST_CID, ...opts });
    },

    async createAsapJob(notesSuffix = '') {
      const marker = `REGTEST-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const notes = `REGTEST ${marker}${notesSuffix ? ` ${notesSuffix}` : ''}`;
      const r = await h.dpost(DSR, 'InsertBookingv4', [
        'PickLocation', '1 Dee St, Invercargill',
        'DropLocation', 'Invercargill Airport',
        'Name', 'Regression Passenger',
        'PassengerId', '021 555 0101',
        'PassengersNo', '1',
        'BagsNo', '0',
        'VehicleType', 'Any',
        'Dispatchbefore', '0',
        'DateTime', '',
        'DId', '0',
        'VId', '0',
        'bookstatus', 'Pending',
        'DispatcherName', 'Regression',
        'EntitiesDetails', notes,
        'Source', 'Dispatch Console',
      ]);
      if (r.status !== 200) {
        throw new Error(`InsertBookingv4 failed: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
      }
      const rows = parseDataManager(r.body);
      const row = Array.isArray(rows) ? rows[0] : rows;
      const bookingId = Number(row?.BookingId || row?.bookingId || 0);
      if (!bookingId) {
        throw new Error(`InsertBookingv4 missing BookingId: ${JSON.stringify(row)}`);
      }
      createdJobIds.add(bookingId);
      await h.poll(
        bookingId,
        (trace) =>
          trace.jobStore?.found === true &&
          (trace.firebase?.allbookings != null || trace.firebase?.pendingjobs != null),
        { timeoutMs: 20000 },
      );
      return bookingId;
    },

    async readUpdateSeq(bookingId) {
      const trace = await h.jobTrace(bookingId);
      return Number(trace.jobStore?.rawFlags?.updateSeq ?? trace.jobStore?.lifecycle?.updateSeq ?? 0);
    },

    async bookingUpdate(bookingId, changes, ifSeq) {
      const seq = ifSeq ?? (await h.readUpdateSeq(bookingId));
      return post(
        '/api/booking/update',
        {
          bookingId,
          by: 'dispatcher',
          ifSeq: seq,
          sessionId: h.sessionId,
          changes,
        },
        h.dispatcherHeaders,
      );
    },

    async setNoOne(bookingId) {
      const seq = await h.readUpdateSeq(bookingId);
      const r = await h.bookingUpdate(
        bookingId,
        {
          BookingStatus: 'No One',
          Status: 'No One',
          DriverId: -1,
          VehicleId: 0,
        },
        seq,
      );
      return { response: r, ifSeq: seq };
    },

    async setPending(bookingId) {
      const seq = await h.readUpdateSeq(bookingId);
      const r = await h.bookingUpdate(
        bookingId,
        {
          BookingStatus: 'Pending',
          Status: 'Pending',
          DriverId: 0,
          VehicleId: 0,
          manualOffer: false,
        },
        seq,
      );
      return { response: r, ifSeq: seq };
    },

    async editLock(bookingId, locked, opts = {}) {
      return post(
        '/api/job/edit-lock',
        {
          bookingId,
          locked,
          source: 'dispatcher',
          actorName: opts.actorName || 'Regression',
          sessionId: opts.sessionId || h.sessionId,
          forceRelease: opts.forceRelease === true,
        },
        h.dispatcherHeaders,
      );
    },

    async cancelUnassigned(bookingId) {
      return h.dpost(DP, '[CancelUnAssignedJobStatusFromJobList]', ['BookingId', bookingId]);
    },

    async cleanupAll() {
      for (const id of [...createdJobIds]) {
        try {
          const trace = await h.jobTrace(id);
          const st = String(trace.jobStore?.lifecycle?.BookingStatus || trace.jobStore?.lifecycle?.Status || '');
          if (st === 'Pending' || st === 'No One' || st === 'Scheduled') {
            await h.cancelUnassigned(id);
          }
        } catch {
          /* best effort */
        }
      }
      createdJobIds.clear();
      await post(`/dev/loadtest/clear?cid=${encodeURIComponent(TEST_CID)}`, {});
    },
  };

  return h;
}

export { assertEditLockClear, assertFirebaseHealthy, assertStatusSync };
