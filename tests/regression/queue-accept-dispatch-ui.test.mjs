import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret, TEST_CID } from '../lib/config.mjs';
import { getHarness, prepareCleanDispatch } from '../lib/harness.mjs';
import {
  applyQueueAcceptOptimistic,
  clearQueueAwaitingAllbookings,
  isQueueAwaitingAllbookings,
  jobTabForStatus,
  markQueueAwaitingAllbookings,
  mergeStoreWithFirebaseCaches,
  minimalJobFromDispatchRefresh,
  pendingSnapshotWouldRegressQueue,
  reinjectQueueAwaitingJobs,
} from '../lib/jobPoolSync.mjs';

test('dispatch UI: queue refresh without prior snapshot lands on Queue tab', () => {
  const companyId = 'test-co';
  const bookingId = 8692700001;
  const driverId = '42';
  const pending = new Map();
  const bookings = new Map();
  const store = [];

  const merged = applyQueueAcceptOptimistic(companyId, bookingId, driverId, pending, bookings, store);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, bookingId);
  assert.equal(merged[0].status, 'Queued');
  assert.equal(bookings.has(bookingId), true, 'bookingsRef should hold queued job immediately');
  assert.equal(pending.has(bookingId), false, 'pendingjobs delete must not orphan the job');
});

test('dispatch UI: allbookings snapshot gap retains queued job until confirmed', () => {
  const now = Date.now();
  const bookingId = 8692700002;
  const job = minimalJobFromDispatchRefresh(bookingId, TEST_CID, {
    action: 'queue',
    status: 'Queued',
    driverId: '7',
    updateSeq: 3,
  });
  assert.ok(job);

  const pending = new Map();
  const bookings = new Map();
  const store = [job];
  markQueueAwaitingAllbookings(bookingId);

  // Simulate pendingjobs removed + allbookings rebuild without Queued yet.
  const mergedGap = mergeStoreWithFirebaseCaches(store, pending, bookings, now);
  assert.equal(mergedGap.length, 1, 'queue-await must keep job visible during Firebase gap');
  assert.equal(mergedGap[0].status, 'Queued');

  reinjectQueueAwaitingJobs(bookings, store, pending);
  assert.equal(bookings.has(bookingId), true, 'reinject restores bookingsRef between full snapshots');

  clearQueueAwaitingAllbookings(bookingId);
  bookings.set(bookingId, { ...job, status: 'Queued' });
  const mergedConfirmed = mergeStoreWithFirebaseCaches(store, pending, bookings, now);
  assert.equal(mergedConfirmed.length, 1);
  assert.equal(isQueueAwaitingAllbookings(bookingId), false);
});

test('dispatch UI: queue retention outlasts 8s optimistic window', () => {
  const now = Date.now();
  const bookingId = 8692700003;
  const job = { id: bookingId, status: 'Queued', pickAddress: 'Queue St' };
  markQueueAwaitingAllbookings(bookingId);
  const pending = new Map();
  const bookings = new Map();

  const atNineSeconds = now + 9_000;
  const merged = mergeStoreWithFirebaseCaches([job], pending, bookings, atNineSeconds);
  assert.equal(merged.length, 1, 'queue job persists until allbookings confirms Queued (no time cap)');
});

test('dispatch UI: integration accept-while-busy emits Queued refresh consumable by UI merge', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);

  const hailDriver = h.driverIds[2];
  const otherDrivers = h.driverIds.filter((id) => id !== hailDriver);
  for (const id of otherDrivers) {
    await h.driverStatusChanged(id, 'Away', { zonename: 'Central' });
  }

  await h.driverStatusChanged(hailDriver, 'Busy', {
    zonename: 'Central',
    lat: -46.4121,
    lng: 168.3531,
  });
  await h.configureDriver(hailDriver, {
    vehiclestatus: 'Busy',
    lat: -46.4121,
    lng: 168.3531,
    zonename: 'Central',
  });

  const poolJobId = await h.createAsapJob('queue-dispatch-ui');
  await h.triggerAutoDispatch();
  await h.poll(
    poolJobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Pending',
    { timeoutMs: 45000 },
  );

  const acceptRes = await h.acceptJob(poolJobId, hailDriver);
  assert.equal(acceptRes.status, 200, JSON.stringify(acceptRes.body));
  assert.equal(acceptRes.body.queued, true, JSON.stringify(acceptRes.body));

  const queued = await h.poll(
    poolJobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Queued',
    { timeoutMs: 25000 },
  );
  assert.equal(String(queued.firebase?.allbookings?.BookingStatus || queued.firebase?.allbookings?.Status), 'Queued');

  const refresh = queued.firebase?.dispatchConsoleRefresh;
  assert.ok(
    String(queued.jobStore?.lifecycle?.BookingStatus) === 'Queued',
    'jobStore must be Queued for dispatch queue tab',
  );

  const pending = new Map([[poolJobId, { id: poolJobId, status: 'Pending', pickAddress: 'Was U-A' }]]);
  const bookings = new Map();
  const merged = applyQueueAcceptOptimistic(TEST_CID, poolJobId, hailDriver, pending, bookings, []);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].status, 'Queued');
  assert.equal(pending.has(poolJobId), false);
  if (refresh?.status) {
    assert.equal(String(refresh.status), 'Queued');
  }

  await h.recallQueuedJob(poolJobId);
  for (const id of otherDrivers) {
    await h.driverStatusChanged(id, 'Available', { zonename: 'Central' });
  }
  await h.driverStatusChanged(hailDriver, 'Available', { zonename: 'Central' });
});

test('dispatch UI: stale pendingjobs Assigned/Active/Pending cannot pull queue-await job to U-A or Assign', () => {
  const now = Date.now();
  const bookingId = 8692700004;
  const job = { id: bookingId, status: 'Queued', driverId: 'D001', updateSeq: 5, pickAddress: 'Queue St' };
  markQueueAwaitingAllbookings(bookingId);

  for (const staleStatus of ['Pending', 'Assigned', 'Active']) {
    const pending = new Map([[bookingId, { id: bookingId, status: staleStatus, updateSeq: 5 }]]);
    const bookings = new Map();
    const store = [job];
    const merged = mergeStoreWithFirebaseCaches(store, pending, bookings, now);
    assert.equal(merged.length, 1, `stale ${staleStatus} must not duplicate or drop job`);
    assert.equal(merged[0].status, 'Queued', `stale ${staleStatus} must not beat Queued`);
    assert.equal(jobTabForStatus(merged[0]), 'queue', `stale ${staleStatus} must land on Queue tab`);
    assert.equal(pending.has(bookingId), false, `stale ${staleStatus} must be purged from pendingRef`);
    assert.equal(bookings.has(bookingId), true, `stale ${staleStatus} must reinject into bookingsRef`);
  }

  assert.equal(
    pendingSnapshotWouldRegressQueue(bookingId, { BookingStatus: 'Assigned' }),
    true,
  );
  assert.equal(
    pendingSnapshotWouldRegressQueue(bookingId, { BookingStatus: 'Pending' }),
    true,
  );
  assert.equal(
    pendingSnapshotWouldRegressQueue(bookingId, { BookingStatus: 'Queued' }),
    false,
  );
});

test('dispatch UI: confirmed allbookings Queued beats stale pendingjobs Pending (no queue-await)', () => {
  const now = Date.now();
  const bookingId = 8692606253;
  const queuedJob = { id: bookingId, status: 'Queued', driverId: '9001', updateSeq: 8, pickAddress: 'Queue St' };
  const pending = new Map([[bookingId, { id: bookingId, status: 'Pending', updateSeq: 3 }]]);
  const bookings = new Map([[bookingId, queuedJob]]);
  const store = [queuedJob];

  assert.equal(isQueueAwaitingAllbookings(bookingId), false);
  assert.equal(
    pendingSnapshotWouldRegressQueue(
      bookingId,
      { BookingStatus: 'Pending' },
      { bookingsRef: bookings, abRec: { BookingStatus: 'Queued' } },
    ),
    true,
  );

  const merged = mergeStoreWithFirebaseCaches(store, pending, bookings, now);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].status, 'Queued');
  assert.equal(jobTabForStatus(merged[0]), 'queue');
  assert.equal(pending.has(bookingId), false);
});

test('dispatch UI: lowercase queued status routes to Queue tab', () => {
  assert.equal(jobTabForStatus({ id: 1, status: 'queued' }), 'queue');
  assert.equal(jobTabForStatus({ id: 2, status: 'QUEUED' }), 'queue');
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
