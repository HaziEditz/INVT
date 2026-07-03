import test from 'node:test';
import assert from 'node:assert/strict';
import { jobTabForStatus } from '../../src/types/job.ts';
import {
  coerceAllbookingsLiveStatus,
  allbookingsRecordIsQueued,
  pendingSnapshotWouldRegressQueue,
  shouldIgnorePendingSnapshot,
  applyQueuedPreservationOnServerMerge,
  resolveJobLifecycle,
  mergeJobSnapshots,
} from '../../src/lib/jobLifecycleDecision.ts';

function shellJob(id, status, driverId = 'D001', extra = {}) {
  return {
    id,
    companyId: '860869',
    status,
    source: 'dispatch',
    serviceType: 'taxi',
    pickAddress: '',
    pickLatLng: '',
    dropAddress: '',
    dropLatLng: '',
    passengerName: '',
    passengerPhone: '',
    paymentType: 'Cash',
    estimatedFare: '',
    bookingDateTime: new Date().toISOString(),
    driverId,
    ...extra,
  };
}

// ─── A. Pure unit cases (plan table) ─────────────────────────────────────────

test('A1: Queued + stale pendingjobs Pending → status Queued, tab queue, pending dropped', () => {
  const bookingId = 8692607001;
  const storeJob = shellJob(bookingId, 'Queued');
  const result = resolveJobLifecycle({
    bookingId,
    storeJob,
    pendingRow: { BookingStatus: 'Pending', DriverId: '-1' },
    bookingCacheStatus: 'Queued',
    allbookingsRow: { BookingStatus: 'Queued', DriverId: 'D001' },
    flags: { isQueueAwaiting: false, editContext: 'listener' },
  });
  assert.equal(result.status, 'Queued');
  assert.equal(result.tab, 'queue');
  assert.equal(result.droppedPending, true);
});

test('A2: Queued + allbookings only (no pending) → stays Queued', () => {
  const bookingId = 8692607002;
  const storeJob = shellJob(bookingId, 'Queued');
  const result = resolveJobLifecycle({
    bookingId,
    storeJob,
    pendingRow: null,
    allbookingsRow: { BookingStatus: 'Queued', DriverId: 'D001' },
  });
  assert.equal(result.status, 'Queued');
  assert.equal(result.tab, 'queue');
  assert.equal(result.droppedPending, false);
});

test('A3: Assigned + stale pending Pending → stays Assigned, tab assign', () => {
  const bookingId = 8692607003;
  const storeJob = shellJob(bookingId, 'Assigned');
  const result = resolveJobLifecycle({
    bookingId,
    storeJob,
    pendingRow: { BookingStatus: 'Pending', DriverId: '-1' },
    bookingCacheStatus: 'Assigned',
    allbookingsRow: { BookingStatus: 'Assigned', DriverId: 'D001' },
    flags: { editContext: 'listener' },
  });
  assert.equal(result.status, 'Assigned');
  assert.equal(result.tab, 'assign');
  assert.equal(result.droppedPending, true);
});

test('A4: post-edit save — base Queued + fresh allbookings Queued → no Pending demotion', () => {
  const optimistic = shellJob(8692607004, 'Queued', 'D001', {
    passengerName: 'Edited Name',
    updateSeq: 5,
  });
  const fresh = shellJob(8692607004, 'Queued', 'D001', { updateSeq: 5 });
  const merged = mergeJobSnapshots({
    bookingId: optimistic.id,
    storeJob: optimistic,
    optimisticJob: optimistic,
    freshJob: fresh,
    authoritativeSeq: 5,
    flags: { editContext: 'postEditSave', baseStatus: 'Queued' },
  });
  assert.equal(merged.status, 'Queued');
  assert.equal(merged.passengerName, 'Edited Name');
});

test('A5: post-edit save — fresh pool-shaped lag but store Queued → keeps Queued', () => {
  const optimistic = shellJob(8692607005, 'Queued', 'D001', { updateSeq: 8 });
  const fresh = shellJob(8692607005, 'Pending', '0', { updateSeq: 8 });
  const merged = mergeJobSnapshots({
    bookingId: optimistic.id,
    storeJob: optimistic,
    optimisticJob: optimistic,
    freshJob: fresh,
    authoritativeSeq: 8,
    flags: { editContext: 'postEditSave', baseStatus: 'Queued' },
  });
  assert.equal(merged.status, 'Queued');
  assert.equal(merged.updateSeq, 8);
});

test('A6: stale pending Offered while allbookings Queued → Queued wins', () => {
  const bookingId = 8692607006;
  const storeJob = shellJob(bookingId, 'Queued');
  const regress = pendingSnapshotWouldRegressQueue(
    bookingId,
    { BookingStatus: 'Offered', DriverId: 'D001' },
    {
      abRec: { BookingStatus: 'Queued', DriverId: 'D001' },
      queueAwaiting: false,
    },
  );
  assert.equal(regress, false);

  const result = resolveJobLifecycle({
    bookingId,
    storeJob,
    pendingRow: { BookingStatus: 'Offered', DriverId: 'D001' },
    allbookingsRow: { BookingStatus: 'Queued', DriverId: 'D001' },
  });
  assert.equal(result.status, 'Queued');
  assert.equal(result.tab, 'queue');
});

// ─── B. Multi-job store isolation ────────────────────────────────────────────

test('B1: Job A Active + Job B Queued — resolve B with stale pending, B stays queue', () => {
  const jobA = shellJob(8692607010, 'Active', 'D001');
  const jobB = shellJob(8692607011, 'Queued', 'D001');
  const resultB = resolveJobLifecycle({
    bookingId: jobB.id,
    storeJob: jobB,
    pendingRow: { BookingStatus: 'Pending', DriverId: '-1' },
    allbookingsRow: { BookingStatus: 'Queued', DriverId: 'D001' },
  });
  assert.equal(resultB.status, 'Queued');
  assert.equal(resultB.tab, 'queue');
  assert.equal(jobTabForStatus(jobA), 'active');
});

test('B2: upsert B only — store tabs stay active + queue', () => {
  const jobs = [
    shellJob(8692607020, 'Active', 'D001'),
    shellJob(8692607021, 'Queued', 'D001'),
  ];
  const resolvedB = resolveJobLifecycle({
    bookingId: jobs[1].id,
    storeJob: jobs[1],
    pendingRow: { BookingStatus: 'No One' },
    allbookingsRow: { BookingStatus: 'Queued', DriverId: 'D001' },
  });
  const nextJobs = jobs.map((j) =>
    j.id === jobs[1].id ? { ...j, status: resolvedB.status } : j,
  );
  assert.equal(jobTabForStatus(nextJobs[0]), 'active');
  assert.equal(jobTabForStatus(nextJobs[1]), 'queue');
});

test('B3: edit B with orphan pending on B — no U-A flash for B', () => {
  const jobB = shellJob(8692607031, 'Queued', 'D001', {
    passengerName: 'After Edit',
    updateSeq: 12,
  });
  const merged = mergeJobSnapshots({
    bookingId: jobB.id,
    storeJob: jobB,
    optimisticJob: jobB,
    freshJob: shellJob(jobB.id, 'No One', '0', { updateSeq: 12 }),
    authoritativeSeq: 12,
    flags: { editContext: 'postEditSave', baseStatus: 'Queued' },
  });
  assert.equal(merged.status, 'Queued');
  assert.notEqual(jobTabForStatus(merged), 'offer');
});

// ─── Extracted helpers (regression guard) ────────────────────────────────────

test('shouldIgnorePendingSnapshot: queue-await flag alone blocks Pending demotion', () => {
  assert.equal(
    shouldIgnorePendingSnapshot({
      bookingId: 1,
      pendingStatus: 'Pending',
      storeStatus: 'Offered',
      queueAwaiting: true,
    }),
    true,
  );
});

test('shouldIgnorePendingSnapshot: Assigned pending accepted when store is not live Queued/Assigned', () => {
  assert.equal(
    shouldIgnorePendingSnapshot({
      bookingId: 1,
      pendingStatus: 'Assigned',
      storeStatus: 'Offered',
      queueAwaiting: false,
    }),
    false,
  );
});

test('applyQueuedPreservationOnServerMerge matches mergeJobUpdateFromServer Queued block', () => {
  const optimistic = shellJob(99, 'Queued', 'D001');
  const fresh = shellJob(99, 'No One', '0');
  const base = { ...optimistic, passengerName: 'Keep', updateSeq: 3 };
  const preserved = applyQueuedPreservationOnServerMerge(base, optimistic, fresh, 3);
  assert.equal(preserved.status, 'Queued');
  assert.equal(preserved.updateSeq, 3);
});

test('coerceAllbookingsLiveStatus: terminal still wins (shared module)', () => {
  const rec = { BookingStatus: 'Cancelled', queuedAt: Date.now(), eventType: 'queued' };
  assert.equal(coerceAllbookingsLiveStatus(rec, 'Cancelled'), 'Cancelled');
});

test('allbookingsRecordIsQueued: genuine queue row', () => {
  assert.equal(
    allbookingsRecordIsQueued({ BookingStatus: 'Queued', DriverId: 'D001' }),
    true,
  );
});

test('listener applyPending guard: bookingCacheStatus Queued drops stale Pending', () => {
  const bookingId = 8692607040;
  const storeJob = shellJob(bookingId, 'Queued');
  const { droppedPending } = resolveJobLifecycle({
    bookingId,
    storeJob,
    pendingRow: { BookingStatus: 'Pending', Status: 'Pending' },
    bookingCacheStatus: 'Queued',
    flags: { isQueueAwaiting: false, editContext: 'listener' },
  });
  assert.equal(droppedPending, true);
});

test('pendingSnapshotWouldRegressQueue: bookingsRef Queued blocks Pending regression', () => {
  const bookingsRef = new Map([[42, shellJob(42, 'Queued')]]);
  assert.equal(
    pendingSnapshotWouldRegressQueue(
      42,
      { BookingStatus: 'Pending' },
      { bookingsRef, queueAwaiting: false },
    ),
    true,
  );
});
