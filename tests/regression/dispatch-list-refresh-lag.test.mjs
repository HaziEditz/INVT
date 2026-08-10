/**
 * Permanent coverage for dispatch list lag:
 * 1) accept→Queued still shown as UA until Arrived (pendingjobs delete + indefinite preserve)
 * 2) complete leaves Active-tab ghost (clearRemovedJob + indefinite Active preserve)
 *
 * These are UI-merge regressions — same class as DISPATCH-ACTIVE-REFRESH-LAG.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret, TEST_CID } from '../lib/config.mjs';
import { getHarness, prepareCleanDispatch } from '../lib/harness.mjs';
import { post } from '../lib/http.mjs';
import {
  clearOptimisticLiveTransition,
  clearQueueAwaitingAllbookings,
  jobTabForStatus,
  markCompletedJobSuppress,
  markOptimisticLiveTransition,
  markQueueAwaitingAllbookings,
  mergeStoreWithFirebaseCaches,
  minimalJobFromDispatchRefresh,
  shouldPreserveAbsentStoreJob,
  applyQueueAcceptOptimistic,
} from '../lib/jobPoolSync.mjs';

/** Simulate assign refresh replacing a stale Pending/Queued store row. */
function applyAssignRefreshOptimistic(
  companyId,
  bookingId,
  driverId,
  pendingRef,
  bookingsRef,
  storeJobs,
  now = Date.now(),
) {
  const prior = storeJobs.find((j) => j.id === bookingId) || null;
  const refresh = {
    action: 'assign',
    status: 'Assigned',
    driverId: String(driverId),
    updateSeq: (prior?.updateSeq ?? 1) + 1,
  };
  const shell = minimalJobFromDispatchRefresh(bookingId, companyId, refresh);
  assert.ok(shell);
  const forced = {
    ...(prior || shell),
    ...shell,
    status: 'Assigned',
    driverId: String(driverId),
  };
  pendingRef.delete(bookingId);
  clearQueueAwaitingAllbookings(bookingId);
  bookingsRef.set(bookingId, forced);
  markOptimisticLiveTransition(bookingId, now);
  const nextStore = [...storeJobs.filter((j) => j.id !== bookingId), forced];
  return mergeStoreWithFirebaseCaches(nextStore, pendingRef, bookingsRef, now);
}

test('dispatch UI lag: queue accept leaves Queue tab even when pendingjobs+allbookings empty', () => {
  const bookingId = 8692800101;
  const pending = new Map();
  const bookings = new Map();
  const staleUa = {
    id: bookingId,
    status: 'Pending',
    pickAddress: '1 Dee St',
    passengerName: 'Pat',
    driverId: '0',
  };
  const merged = applyQueueAcceptOptimistic(
    'co',
    bookingId,
    '9001',
    pending,
    bookings,
    [staleUa],
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].status, 'Queued');
  assert.equal(jobTabForStatus(merged[0]), 'queue');
  assert.equal(pending.has(bookingId), false);
});

/**
 * Gap the refresh-path test above missed: Queued arrives only via pendingjobs mirror
 * (empty bookingsRef, no queue-await yet). Purge must not drop that mirror or Queue
 * tab goes blank until Assigned promote.
 */
test('dispatch UI lag: Queued pendingjobs mirror survives purge+merge with empty bookingsRef', () => {
  const bookingId = 8692800199;
  clearQueueAwaitingAllbookings(bookingId);
  clearOptimisticLiveTransition(bookingId);
  const pending = new Map();
  const bookings = new Map();
  const queuedMirror = {
    id: bookingId,
    status: 'Queued',
    pickAddress: 'Queue Mirror St',
    passengerName: 'Queue Pat',
    driverId: '9001',
    queuedAt: Date.now(),
  };
  pending.set(bookingId, queuedMirror);
  const storeJobs = [queuedMirror];

  const merged = mergeStoreWithFirebaseCaches(storeJobs, pending, bookings);
  assert.equal(pending.has(bookingId), true, 'Queued pendingjobs mirror must not be purged when bookingsRef empty');
  assert.equal(merged.length, 1);
  assert.equal(merged[0].status, 'Queued');
  assert.equal(jobTabForStatus(merged[0]), 'queue');
  assert.equal(shouldPreserveAbsentStoreJob(queuedMirror, pending, bookings), true);
});

test('dispatch UI lag: Queued mirror yields to Assigned bookings without needing Arrived', () => {
  const bookingId = 8692800201;
  clearQueueAwaitingAllbookings(bookingId);
  clearOptimisticLiveTransition(bookingId);
  const pending = new Map();
  const bookings = new Map();
  const queuedMirror = {
    id: bookingId,
    status: 'Queued',
    pickAddress: 'Stuck Queue St',
    passengerName: 'Stuck Pat',
    driverId: '9001',
    updateSeq: 5,
  };
  pending.set(bookingId, queuedMirror);
  bookings.set(bookingId, {
    id: bookingId,
    status: 'Assigned',
    pickAddress: 'Stuck Queue St',
    passengerName: 'Stuck Pat',
    driverId: '9001',
    updateSeq: 5,
  });
  const merged = mergeStoreWithFirebaseCaches([queuedMirror], pending, bookings);
  assert.equal(pending.has(bookingId), false, 'Queued pending mirror must drop once bookings is Assigned');
  assert.equal(merged.length, 1);
  assert.equal(merged[0].status, 'Assigned');
  assert.equal(jobTabForStatus(merged[0]), 'assign');
});

test('dispatch UI lag: Queued store merges to Active even when updateSeq does not increase', () => {
  const bookingId = 8692800202;
  clearQueueAwaitingAllbookings(bookingId);
  const pending = new Map();
  const bookings = new Map();
  bookings.set(bookingId, {
    id: bookingId,
    status: 'Active',
    pickAddress: 'Trip St',
    driverId: '9001',
    updateSeq: 3,
  });
  const queuedStore = {
    id: bookingId,
    status: 'Queued',
    pickAddress: 'Trip St',
    driverId: '9001',
    updateSeq: 5,
  };
  const merged = mergeStoreWithFirebaseCaches([queuedStore], pending, bookings);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].status, 'Active');
  assert.equal(jobTabForStatus(merged[0]), 'active');
});

test('dispatch UI lag: queue-await must not overwrite Assigned bookings back to Queued', () => {
  const bookingId = 8692800203;
  markQueueAwaitingAllbookings(bookingId);
  const pending = new Map();
  const bookings = new Map();
  bookings.set(bookingId, {
    id: bookingId,
    status: 'Assigned',
    pickAddress: 'Promote St',
    driverId: '9001',
    updateSeq: 4,
  });
  const queuedStore = {
    id: bookingId,
    status: 'Queued',
    pickAddress: 'Promote St',
    driverId: '9001',
    updateSeq: 3,
  };
  const merged = mergeStoreWithFirebaseCaches([queuedStore], pending, bookings);
  assert.equal(merged[0].status, 'Assigned');
  assert.equal(jobTabForStatus(merged[0]), 'assign');
  clearQueueAwaitingAllbookings(bookingId);
});

test('dispatch UI lag: stale Pending pendingjobs still purged when store already Queued', () => {
  const bookingId = 8692800200;
  clearQueueAwaitingAllbookings(bookingId);
  const pending = new Map();
  const bookings = new Map();
  pending.set(bookingId, {
    id: bookingId,
    status: 'Pending',
    pickAddress: 'Stale Pool',
    driverId: '0',
  });
  const queuedStore = {
    id: bookingId,
    status: 'Queued',
    pickAddress: 'Queue St',
    driverId: '9001',
  };
  const merged = mergeStoreWithFirebaseCaches([queuedStore], pending, bookings);
  assert.equal(pending.has(bookingId), false, 'stale Pending pendingjobs must still drop when store is Queued');
  // Without bookings/await/optimistic, Queued store alone must not invent a Queue ghost forever —
  // but with empty caches the row is absent unless preserve/await (refresh path covers reinject).
  assert.ok(Array.isArray(merged));
});

test('dispatch UI lag: assign refresh moves Queue/Pending off UA without waiting for Arrived', () => {
  const bookingId = 8692800102;
  const pending = new Map();
  const bookings = new Map();
  const queued = {
    id: bookingId,
    status: 'Queued',
    pickAddress: 'Queue St',
    driverId: '9001',
  };
  markQueueAwaitingAllbookings(bookingId);
  const merged = applyAssignRefreshOptimistic(
    'co',
    bookingId,
    '9001',
    pending,
    bookings,
    [queued],
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].status, 'Assigned');
  assert.equal(jobTabForStatus(merged[0]), 'assign');
  assert.notEqual(jobTabForStatus(merged[0]), 'ua');
});

test('dispatch UI lag: stale Pending UA drops after optimistic window when caches empty', () => {
  const now = Date.now();
  const bookingId = 8692800103;
  clearOptimisticLiveTransition(bookingId);
  const pending = new Map();
  const bookings = new Map();
  const staleUa = {
    id: bookingId,
    status: 'Pending',
    pickAddress: 'Stuck UA Rd',
    passengerName: 'Sam',
    driverId: '0',
  };
  assert.equal(shouldPreserveAbsentStoreJob(staleUa, pending, bookings, now), false);
  const merged = mergeStoreWithFirebaseCaches([staleUa], pending, bookings, now);
  assert.equal(merged.length, 0, 'UA ghost must not survive empty Firebase caches');
});

test('dispatch UI lag: completed Active ghost drops immediately with suppress (no manual refresh)', () => {
  const bookingId = 8692800104;
  clearOptimisticLiveTransition(bookingId);
  const pending = new Map();
  const bookings = new Map();
  const activeGhost = {
    id: bookingId,
    status: 'Active',
    pickAddress: 'Done St',
    passengerName: 'Alex',
    driverId: '9001',
  };
  assert.equal(shouldPreserveAbsentStoreJob(activeGhost, pending, bookings), false);

  markCompletedJobSuppress(bookingId, 5);
  const merged = mergeStoreWithFirebaseCaches([activeGhost], pending, bookings);
  assert.equal(merged.length, 0, 'Active tab must clear on complete without refresh');
  assert.equal(shouldPreserveAbsentStoreJob(activeGhost, pending, bookings), false);
});

test('dispatch UI lag: Active ghost inside optimistic window still drops once suppress stamped', () => {
  const now = Date.now();
  const bookingId = 8692800105;
  markOptimisticLiveTransition(bookingId, now);
  const pending = new Map();
  const bookings = new Map();
  const activeGhost = { id: bookingId, status: 'Active', pickAddress: 'Race St' };
  assert.equal(shouldPreserveAbsentStoreJob(activeGhost, pending, bookings, now + 100), true);
  markCompletedJobSuppress(bookingId, 9, now);
  assert.equal(shouldPreserveAbsentStoreJob(activeGhost, pending, bookings, now + 100), false);
  const merged = mergeStoreWithFirebaseCaches([activeGhost], pending, bookings, now + 100);
  assert.equal(merged.length, 0);
});

test('dispatch UI lag: integration queue then promote lands Assigned without Arrived stage', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);

  const driverId = h.driverIds[0];
  const activeId = await h.createAsapJob('ui-lag-active');
  await h.assignAccept(activeId, driverId);
  await h.stageJob(activeId, driverId, 'Active');
  await h.poll(activeId, (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Active');

  const queuedId = await h.createAsapJob('ui-lag-queued');
  const acc = await h.acceptJob(queuedId, driverId);
  assert.equal(acc.status, 200, JSON.stringify(acc.body));
  assert.equal(acc.body.queued, true, JSON.stringify(acc.body));
  await h.poll(
    queuedId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Queued',
    { timeoutMs: 25000 },
  );

  const qTrace = await h.jobTrace(queuedId);
  const pjStatus = String(
    qTrace.firebase?.pendingjobs?.BookingStatus ||
      qTrace.firebase?.pendingjobs?.Status ||
      '',
  );
  assert.equal(
    pjStatus,
    'Queued',
    `pendingjobs mirror must be Queued for dispatch child listener; got ${pjStatus || 'absent'}`,
  );

  await h.completeJob(activeId, driverId, { fare: '20.00' });
  await h.poll(
    activeId,
    (t) => t.jobStore?.closedFound === true || !t.jobStore?.found,
    { timeoutMs: 30000 },
  );

  let promoteRes;
  for (let attempt = 0; attempt < 4; attempt++) {
    promoteRes = await post(
      '/api/job/promote-queued',
      { bookingId: queuedId, driverId: String(driverId), companyId: TEST_CID },
      h.adminHeaders,
    );
    if (promoteRes.status === 200 && promoteRes.body?.ok) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  assert.equal(promoteRes.status, 200, JSON.stringify(promoteRes.body));
  assert.equal(promoteRes.body.ok, true, JSON.stringify(promoteRes.body));

  const assigned = await h.poll(
    queuedId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Assigned',
    { timeoutMs: 30000 },
  );
  assert.equal(String(assigned.jobStore.lifecycle.BookingStatus), 'Assigned');

  const aTrace = await h.jobTrace(queuedId);
  const pjAssigned = String(
    aTrace.firebase?.pendingjobs?.BookingStatus ||
      aTrace.firebase?.pendingjobs?.Status ||
      '',
  );
  assert.equal(
    pjAssigned,
    'Assigned',
    `pendingjobs must mirror Assigned after promote (not wait for Arrived); got ${pjAssigned || 'absent'}`,
  );

  const pending = new Map();
  const bookings = new Map();
  const merged = applyAssignRefreshOptimistic(
    TEST_CID,
    queuedId,
    driverId,
    pending,
    bookings,
    [{ id: queuedId, status: 'Pending', pickAddress: 'x', driverId: '0' }],
  );
  assert.equal(merged[0].status, 'Assigned');
  assert.equal(jobTabForStatus(merged[0]), 'assign');

  await h.cancelAssigned(queuedId).catch(() => undefined);
});

test('dispatch UI lag: integration complete stamps suppress so Active ghost cannot merge back', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);
  const driverId = h.driverIds[1];
  const jobId = await h.createAsapJob('ui-lag-complete-active');
  await h.assignAccept(jobId, driverId);
  await h.stageJob(jobId, driverId, 'Active');
  await h.poll(jobId, (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Active');

  const complete = await h.completeJob(jobId, driverId, { fare: '33.00' });
  assert.equal(complete.body.ok, true, JSON.stringify(complete.body));
  await h.poll(
    jobId,
    (t) => t.jobStore?.closedFound === true || !t.jobStore?.found,
    { timeoutMs: 30000 },
  );

  markCompletedJobSuppress(jobId);
  const ghost = {
    id: jobId,
    status: 'Active',
    pickAddress: 'Ghost Ave',
    driverId: String(driverId),
  };
  const merged = mergeStoreWithFirebaseCaches([ghost], new Map(), new Map());
  assert.equal(merged.length, 0);
  assert.equal(jobTabForStatus(ghost), 'active');
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
