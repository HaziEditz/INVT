import crypto from 'node:crypto';
import { ADMIN_KEY, DP, DSR, DSL, DS, TEST_CID } from './config.mjs';
import { cookieFromResponse, dmPairs, get, parseDataManager, post } from './http.mjs';
import {
  assertEditLockClear,
  assertFirebaseHealthy,
  assertStatusSync,
  fetchJobTrace,
  pollJobTrace,
} from './jobTrace.mjs';

let shared = null;

export async function resetHarness() {
  if (shared) {
    try {
      await shared.cleanupAll();
    } catch {
      /* ignore */
    }
  }
  shared = null;
}

export async function getHarness(opts = {}) {
  if (opts.fresh) await resetHarness();
  if (!shared) shared = await createHarness(opts);
  return shared;
}

export async function createHarness(opts = {}) {
  const driverCount = opts.drivers ?? 3;

  async function seedDrivers() {
    const r = await post(
      `/dev/loadtest/seed?drivers=${driverCount}&jobs=0&cid=${encodeURIComponent(TEST_CID)}`,
      {},
    );
    if (r.status !== 200 || !r.body?.ok) {
      throw new Error(`loadtest seed failed: ${r.status} ${JSON.stringify(r.body)}`);
    }
    return r.body;
  }

  await seedDrivers();

  const login = await post('/api/session/login', { companyId: TEST_CID, uid: 'regtest-harness' });
  if (login.status !== 200) {
    throw new Error(`session login failed: ${login.status} ${JSON.stringify(login.body)}`);
  }
  const cookie = cookieFromResponse(login);

  const sessionId = crypto.randomUUID();
  const createdJobIds = new Set();
  const driverIds = [];
  for (let i = 0; i < driverCount; i++) driverIds.push(9000 + i);

  const h = {
    companyId: TEST_CID,
    cookie,
    sessionId,
    createdJobIds,
    driverIds,

    adminHeaders: { 'X-Admin-Key': ADMIN_KEY },
    dispatcherHeaders: { Cookie: cookie },
    driverHeaders(driverId) {
      return { 'X-Admin-Key': ADMIN_KEY, 'X-User-Key': `regtest-key-${driverId}` };
    },

    /** Production driver-app shape: driverId + companyId in body; optional wrong/missing X-User-Key. */
    driverAppHeaders(_driverId, { userKey } = {}) {
      const headers = { 'Content-Type': 'application/json' };
      if (userKey) headers['X-User-Key'] = userKey;
      return headers;
    },

    driverAppBody(driverId, fields = {}) {
      return {
        driverId: String(driverId),
        companyId: TEST_CID,
        ...fields,
      };
    },

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

    async firebasePeek(path) {
      const r = await get(`/admin/firebasePeek?path=${encodeURIComponent(path)}`, h.adminHeaders);
      if (r.status !== 200 || !r.body.ok) {
        throw new Error(`firebasePeek ${path}: ${JSON.stringify(r.body).slice(0, 200)}`);
      }
      return r.body.node;
    },

    trackJob(id) {
      createdJobIds.add(Number(id));
    },

    async createJobViaInsert(fields = {}) {
      const marker = `REGTEST-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const notes = fields.notesSuffix ? `REGTEST ${marker} ${fields.notesSuffix}` : `REGTEST ${marker}`;
      const pairs = [
        'PickLocation', fields.pick || '1 Dee St, Invercargill',
        'DropLocation', fields.drop || 'Invercargill Airport',
        'Name', fields.name || 'Regression Passenger',
        'PassengerId', fields.phone || '021 555 0101',
        'PassengersNo', String(fields.passengers ?? 1),
        'BagsNo', String(fields.bags ?? 0),
        'VehicleType', fields.vehicleType || 'Any',
        'Dispatchbefore', '0',
        'DispatchTimebefore', '0',
        'DateTime', fields.dateTime ?? '',
        'DId', '0',
        'VId', '0',
        'bookstatus', fields.bookstatus || 'Pending',
        'DispatcherName', 'Regression',
        'EntitiesDetails', notes,
        'Source', fields.source || 'Dispatch Console',
      ];
      const r = await h.dpost(DSR, 'InsertBookingv4', pairs);
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
          (trace.firebase?.allbookings != null || trace.firebase?.pendingjobs != null) &&
          trace.dispatchUiHint?.jobStoreVsAllbookingsMismatch !== true &&
          trace.dispatchUiHint?.jobStoreVsPendingMismatch !== true,
        { timeoutMs: 25000 },
      );
      return bookingId;
    },

    async createAsapJob(notesSuffix = '') {
      return h.createJobViaInsert({ notesSuffix, bookstatus: 'Pending' });
    },

    async createPreBookingViaApi(fields = {}) {
      const minutesAhead = fields.minutesAhead ?? 180;
      const scheduledAt =
        fields.scheduledAt ??
        new Date(Date.now() + minutesAhead * 60000)
          .toLocaleString('sv-SE', { timeZone: 'Pacific/Auckland' })
          .replace('T', ' ')
          .slice(0, 16);
      const driverId = fields.driverId ?? h.driverIds[0];
      const body = {
        passengerName: fields.name || 'Pre-book Passenger',
        passengerPhone: fields.phone || '021 555 0199',
        pickup: fields.pickup || '1 Dee St, Invercargill',
        dropoff: fields.drop || 'Invercargill Airport',
        scheduledAt,
        notes: fields.notes || `REGTEST pre-book ${Date.now()}`,
        companyId: h.companyId,
        driverId: String(driverId),
        vehicleType: fields.vehicleType || 'Taxi',
        paymentType: fields.paymentType || 'Cash',
        createdBy: 'driver',
        ...(fields.vehicleId ? { vehicleId: fields.vehicleId } : {}),
        ...(fields.passengers != null ? { passengers: fields.passengers } : {}),
      };
      const r = await post('/api/pre-booking', body);
      return { response: r, scheduledAt, driverId, body };
    },

    async triggerDriverSos(driverId, { lat, lng, phone, appClient, userKey } = {}) {
      const body = h.driverAppBody(driverId, {
        lat: lat ?? -46.412,
        lng: lng ?? 168.353,
        phone: phone ?? `021 ${800000 + driverId}`,
      });
      const headers = appClient
        ? h.driverAppHeaders(driverId, { userKey })
        : h.driverHeaders(driverId);
      return post('/api/driver/sos', body, headers);
    },

    async cancelDriverSos(driverId, { appClient, userKey } = {}) {
      const headers = appClient
        ? h.driverAppHeaders(driverId, { userKey })
        : h.driverHeaders(driverId);
      return post('/api/driver/sos/cancel', h.driverAppBody(driverId, {}), headers);
    },

    async acknowledgeSos(sosId, dispatcherName = 'Regtest Dispatcher') {
      return post('/api/sos/acknowledge', { sosId, dispatcherName }, h.dispatcherHeaders);
    },

    async resolveSos(sosId) {
      return post('/api/sos/resolve', { sosId }, h.dispatcherHeaders);
    },

    async sendDispatchMessage(driverId, message) {
      const dt = new Date().toISOString().replace('T', ' ').substring(0, 16);
      return h.dpost(DP, '[MessageInsert]', [
        'RecieverId', String(driverId),
        'Message', message,
        'DateTime', dt,
      ]);
    },

    async sendDriverMessage(driverId, message, { appClient, userKey } = {}) {
      const headers = appClient
        ? h.driverAppHeaders(driverId, { userKey })
        : h.driverHeaders(driverId);
      return post('/api/driver/message', h.driverAppBody(driverId, { message }), headers);
    },

    async retrieveMessageDrivers() {
      const r = await h.dpost(DSL, '[RetrieveMessages]', []);
      return parseDataManager(r.body);
    },

    async unreadCountForDriver(driverId) {
      const list = await h.retrieveMessageDrivers();
      if (!Array.isArray(list)) return 0;
      const row = list.find((d) => String(d.Id) === String(driverId));
      return row?.Count ?? 0;
    },

    async createScheduledJob({ minutesAhead = 120, dispatchBefore = 30, notesSuffix = 'scheduled' } = {}) {
      const id = await h.createJobViaInsert({ dispatchBefore: 0, notesSuffix });
      const dt = new Date(Date.now() + minutesAhead * 60000);
      const dateTime = dt.toLocaleString('sv-SE', { timeZone: 'Pacific/Auckland' }).replace('T', ' ');
      const seq = await h.readUpdateSeq(id);
      const r = await h.bookingUpdate(
        id,
        {
          BookingDateTime: dateTime,
          Pickingtime: dateTime,
          DispatchTimebefore: String(dispatchBefore),
          Dispatchbefore: String(dispatchBefore),
        },
        seq,
      );
      if (!r.body.ok) {
        throw new Error(`schedule via update failed: ${JSON.stringify(r.body)}`);
      }
      const trace = await h.poll(
        id,
        (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Scheduled',
        { timeoutMs: 25000 },
      );
      return { bookingId: id, trace };
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

    async jobCommand(bookingId, command, by, payload = {}, headers = null) {
      const seq = payload.ifSeq ?? payload.ifVersion;
      const body = {
        bookingId,
        command,
        by,
        payload,
        ifSeq: seq ?? (await h.readUpdateSeq(bookingId)),
      };
      return post('/api/job/command', body, headers || (by === 'dispatcher' ? h.dispatcherHeaders : h.adminHeaders));
    },

    async cancel(bookingId, cancelledBy, opts = {}) {
      const body = {
        bookingId,
        companyId: TEST_CID,
        cancelledBy,
        reason: opts.reason,
        noShow: opts.noShow === true,
        forceTerminal: opts.forceTerminal === true,
        terminalKind: opts.terminalKind,
        dispatcherName: opts.dispatcherName,
      };
      const headers =
        cancelledBy === 'dispatcher'
          ? h.dispatcherHeaders
          : { ...h.adminHeaders, ...(opts.driverId ? {} : {}) };
      return post('/api/cancel', body, headers);
    },

    async driverCancel(bookingId, driverId, opts = {}) {
      return post(
        '/api/cancel',
        {
          bookingId,
          companyId: TEST_CID,
          cancelledBy: 'driver',
          driverId,
          reason: opts.reason,
          noShow: opts.noShow === true,
          forceTerminal: opts.forceTerminal === true,
        },
        h.adminHeaders,
      );
    },

    async stageJob(bookingId, driverId, status) {
      return post(
        '/api/job/stage',
        { bookingId, driverId, status },
        h.adminHeaders,
      );
    },

    async acceptJob(bookingId, driverId) {
      return post('/api/job/accept', { bookingId, jobId: bookingId, driverId }, h.adminHeaders);
    },

    async completeJob(bookingId, driverId, opts = {}) {
      return post(
        '/api/job/command',
        {
          bookingId,
          command: 'complete',
          by: 'dispatcher',
          payload: { driverId, fare: opts.fare ?? 25.5, distance: opts.distance ?? 10 },
          ifSeq: await h.readUpdateSeq(bookingId),
        },
        h.dispatcherHeaders,
      );
    },

    async cancelAllOffered() {
      const r = await get(`/admin/jobTrace?cid=${encodeURIComponent(TEST_CID)}&status=Offered`, h.adminHeaders);
      if (r.status !== 200 || !r.body.jobs) return;
      for (const j of r.body.jobs) {
        try {
          await h.cancelAssigned(j.id);
        } catch {
          /* best effort */
        }
      }
    },

    async cancelAllLiveJobs() {
      const liveStatuses = [
        'Offered',
        'Assigned',
        'Picking',
        'Arrived',
        'Active',
        'Queued',
        'Pending',
        'No One',
        'Scheduled',
      ];
      for (const status of liveStatuses) {
        const r = await get(
          `/admin/jobTrace?cid=${encodeURIComponent(TEST_CID)}&status=${encodeURIComponent(status)}`,
          h.adminHeaders,
        );
        if (r.status !== 200 || !Array.isArray(r.body.jobs)) continue;
        for (const j of r.body.jobs) {
          try {
            if (['Pending', 'No One', 'Scheduled'].includes(status)) {
              await h.cancelUnassigned(j.id);
            } else {
              await h.cancelAssigned(j.id);
            }
          } catch {
            /* best effort */
          }
        }
      }
    },

    async ensureDriverReady(driverId) {
      await h.configureDriver(driverId, {
        passforlink: `regtest-key-${driverId}`,
        vehiclestatus: 'Available',
        vehicletype: 'Sedan',
        seatCapacity: 4,
        lat: -46.412,
        lng: 168.353,
        zoneid: '1',
        zonename: 'Central',
      });
      await h.driverStatusChanged(driverId, 'Available');
    },

    async assignAccept(jobId, driverId) {
      await h.ensureDriverReady(driverId);
      await h.assignJob(jobId, driverId, driverId);
      await h.poll(jobId, (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered', {
        timeoutMs: 25000,
      });
      const acc = await h.acceptJob(jobId, driverId);
      if (!acc.body.ok) {
        throw new Error(`accept failed: ${JSON.stringify(acc.body)}`);
      }
      await h.poll(jobId, (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Assigned', {
        timeoutMs: 25000,
      });
    },

    async assignJob(bookingId, driverId, vehicleId) {
      return h.jobCommand(
        bookingId,
        'assign',
        'dispatcher',
        { driverId, vehicleId: vehicleId ?? driverId, fanout: true },
        h.dispatcherHeaders,
      );
    },

    async triggerAutoDispatch() {
      const r = await post('/dev/loadtest/auto-dispatch-tick', {});
      if (r.status !== 200) throw new Error(`auto-dispatch-tick: ${JSON.stringify(r.body)}`);
      return r.body;
    },

    /** Poll until auto-dispatch offers, retrying ticks; manual assign as last resort. */
    async waitForAutoOffer(jobId, driverId, { timeoutMs = 45000 } = {}) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        await h.triggerAutoDispatch();
        try {
          return await h.poll(
            jobId,
            (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered',
            { timeoutMs: Math.min(8000, deadline - Date.now()) },
          );
        } catch {
          /* retry after next tick */
        }
      }
      await h.ensureDriverReady(driverId);
      await h.assignJob(jobId, driverId, driverId);
      return h.poll(
        jobId,
        (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered',
        { timeoutMs: 25000 },
      );
    },

    async triggerScheduledRelease() {
      const r = await post('/dev/loadtest/scheduled-release', {});
      if (r.status !== 200) throw new Error(`scheduled-release: ${JSON.stringify(r.body)}`);
      return r.body;
    },

    async configureDriver(driverId, props) {
      let r = await post('/dev/loadtest/configure-driver', { driverId, ...props }, h.adminHeaders);
      if (r.status !== 200 || !r.body?.ok) {
        await post(
          `/dev/loadtest/seed?drivers=${driverIds.length}&jobs=0&cid=${encodeURIComponent(TEST_CID)}`,
          {},
        );
        r = await post('/dev/loadtest/configure-driver', { driverId, ...props }, h.adminHeaders);
      }
      if (r.status !== 200 || !r.body?.ok) {
        throw new Error(`configure-driver: ${JSON.stringify(r.body)}`);
      }
      return r.body;
    },

    async driverStatusChanged(driverId, newstatus, extra = {}) {
      return h.dpost(DS, '[DriverStatusChanged]', [
        'driverid', String(driverId),
        'newstatus', newstatus,
        'vehiclenumber', extra.vehiclenumber || `T${driverId}`,
        'drivername', extra.drivername || `Test Driver ${driverId}`,
        'zonename', extra.zonename || 'Central',
        'zonequeue', String(extra.zonequeue ?? 1),
        'lat', String(extra.lat ?? -46.412),
        'lng', String(extra.lng ?? 168.353),
      ]);
    },

    async queueJob(bookingId, driverId) {
      return h.dpost(DS, '[QueueJob]', ['bookingid', bookingId, 'driverid', String(driverId)]);
    },

    async recallQueuedJob(bookingId) {
      return h.dpost(DS, '[RecallQueuedJob]', ['bookingid', bookingId]);
    },

    async offerJob(bookingId, driverId) {
      return h.dpost(DP, '[changeriddestatusforoffer]', [
        'bookingid', bookingId,
        'ridestatus', 'Offered',
        'driverid', driverId,
        'returnreason', '',
      ]);
    },

    async cancelUnassigned(bookingId) {
      return h.dpost(DP, '[CancelUnAssignedJobStatusFromJobList]', ['BookingId', bookingId]);
    },

    async cancelAssigned(bookingId) {
      return h.dpost(DS, '[CancelJobStatusFromJobList]', ['BookingId', bookingId]);
    },

    async cleanupAll() {
      for (const id of [...createdJobIds]) {
        try {
          const trace = await h.jobTrace(id);
          const st = String(trace.jobStore?.lifecycle?.BookingStatus || trace.jobStore?.lifecycle?.Status || '');
          if (['Pending', 'No One', 'Scheduled'].includes(st)) {
            await h.cancelUnassigned(id);
          } else if (['Offered', 'Assigned', 'Picking', 'Arrived', 'Active', 'Queued'].includes(st)) {
            await h.cancelAssigned(id).catch(() =>
              h.driverCancel(id, trace.jobStore?.lifecycle?.DriverId || h.driverIds[0]),
            );
          }
        } catch {
          /* best effort */
        }
      }
      createdJobIds.clear();
      await h.cancelAllLiveJobs();
      for (const did of driverIds) {
        try {
          await h.driverStatusChanged(did, 'Available');
          await h.resolveSos(String(did)).catch(() => h.cancelDriverSos(did));
        } catch {
          /* best effort */
        }
      }
    },

    async mutateJobStore(bookingId, patch) {
      const r = await post('/dev/loadtest/mutate-jobstore', { bookingId, patch }, h.adminHeaders);
      if (r.status !== 200 || !r.body?.ok) {
        throw new Error(`mutate-jobstore #${bookingId}: ${JSON.stringify(r.body)}`);
      }
      return r.body;
    },

    async setFirebaseBooking(bookingId, patch, companyId = h.companyId, opts = {}) {
      const r = await post(
        '/dev/loadtest/set-firebase-booking',
        { bookingId, patch, companyId, preserveTimestamps: !!opts.preserveTimestamps },
        h.adminHeaders,
      );
      if (r.status !== 200 || !r.body?.ok) {
        throw new Error(`set-firebase-booking #${bookingId}: ${JSON.stringify(r.body)}`);
      }
      return r.body;
    },

    async repairBooking(bookingId, action = 'sync') {
      const r = await post('/dev/loadtest/repair-booking', { bookingId, action }, h.adminHeaders);
      return r;
    },
  };

  await h.cancelAllLiveJobs();

  const driverDefaults = {
    passforlink: null,
    lat: -46.412,
    lng: 168.353,
    vehicletype: 'Sedan',
    seatCapacity: 4,
    zoneid: '1',
    zonename: 'Central',
    vehiclestatus: 'Available',
  };

  for (const did of driverIds) {
    let ok = false;
    for (let attempt = 0; attempt < 2 && !ok; attempt++) {
      try {
        await h.configureDriver(did, { ...driverDefaults, passforlink: `regtest-key-${did}` });
        ok = true;
      } catch (e) {
        if (attempt === 0) await seedDrivers();
        else throw e;
      }
    }
  }

  return h;
}

/** Clear stray jobs and reset test drivers before dispatch scenarios. */
export async function prepareCleanDispatch(h) {
  await h.cancelAllLiveJobs();
  await h.cancelAllOffered();
  for (let attempt = 0; attempt < 4; attempt++) {
    const rq = await get(
      `/admin/jobTrace?cid=${encodeURIComponent(h.companyId)}&status=Queued`,
      h.adminHeaders,
    );
    if (rq.status !== 200 || !Array.isArray(rq.body.jobs) || rq.body.jobs.length === 0) break;
    for (const j of rq.body.jobs) {
      await h.recallQueuedJob(j.id).catch(() => undefined);
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    const r = await get(
      `/admin/jobTrace?cid=${encodeURIComponent(h.companyId)}&status=Offered`,
      h.adminHeaders,
    );
    if (r.status !== 200 || !Array.isArray(r.body.jobs) || r.body.jobs.length === 0) break;
    await h.cancelAllOffered();
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  for (const did of h.driverIds) {
    await h.configureDriver(did, {
      passforlink: `regtest-key-${did}`,
      vehicletype: 'Sedan',
      seatCapacity: 4,
      vehiclestatus: 'Available',
      lat: -46.412,
      lng: 168.353,
      zoneid: '1',
      zonename: 'Central',
    });
    await h.driverStatusChanged(did, 'Available');
  }
}

export { assertEditLockClear, assertFirebaseHealthy, assertStatusSync };
export { assertTerminalClean, pollFirebasePeek } from './jobTrace.mjs';
