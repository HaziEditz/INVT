import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { getHarness, prepareCleanDispatch } from '../lib/harness.mjs';
import {
  clearOptimisticLiveTransition,
  markOptimisticLiveTransition,
  mergeStoreWithFirebaseCaches,
  OPTIMISTIC_LIVE_RETAIN_MS,
  shouldPreserveAbsentStoreJob,
  markCompletedJobSuppress,
  clearCompletedJobSuppress,
} from '../lib/jobPoolSync.mjs';

test('ghost Active card: completed job absent from Firebase caches is not preserved', () => {
  const pending = new Map();
  const bookings = new Map();
  const completed = { id: 8692606213, status: 'Active', pickAddress: 'Done St' };
  const live = { id: 8692606214, status: 'Active', pickAddress: 'Live St' };

  bookings.set(live.id, live);

  assert.equal(
    shouldPreserveAbsentStoreJob(completed, pending, bookings),
    false,
    'completed-looking Active tab job must drop when absent from both caches',
  );

  const merged = mergeStoreWithFirebaseCaches([completed, live], pending, bookings);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, live.id);
});

test('ghost Active card: terminal Completed status never preserved on live tabs', () => {
  const pending = new Map();
  const bookings = new Map();
  const job = { id: 100, status: 'Completed', pickAddress: 'x' };
  assert.equal(shouldPreserveAbsentStoreJob(job, pending, bookings), false);
});

test('ghost Active card: optimistic window retains accept race briefly', () => {
  clearOptimisticLiveTransition(200);
  const pending = new Map();
  const bookings = new Map();
  const job = { id: 200, status: 'Assigned', pickAddress: 'Race Ave' };
  const now = Date.now();

  assert.equal(shouldPreserveAbsentStoreJob(job, pending, bookings, now), false);

  markOptimisticLiveTransition(200, now);
  assert.equal(shouldPreserveAbsentStoreJob(job, pending, bookings, now), true);
  assert.equal(
    shouldPreserveAbsentStoreJob(job, pending, bookings, now + OPTIMISTIC_LIVE_RETAIN_MS + 1),
    false,
  );
});

test('ghost Active card: completed suppress blocks stale Active re-inject', () => {
  const pending = new Map();
  const bookings = new Map();
  const job = { id: 400, status: 'Active', pickAddress: 'Done St' };
  markCompletedJobSuppress(400);
  assert.equal(shouldPreserveAbsentStoreJob(job, pending, bookings), false);
  clearCompletedJobSuppress(400);
});

test('ghost Active card: U-A pool jobs still preserved when absent from caches', () => {
  const pending = new Map();
  const bookings = new Map();
  const job = { id: 300, status: 'Pending', pickAddress: 'Pool Rd' };
  assert.equal(shouldPreserveAbsentStoreJob(job, pending, bookings), true);
});

test('ghost Active card: integration complete removes job from live pool', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);
  const driverId = h.driverIds[0];
  const jobId = await h.createAsapJob('ghost-active-complete');
  await h.assignAccept(jobId, driverId);
  await h.stageJob(jobId, driverId, 'Active');
  await h.poll(jobId, (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Active');

  const complete = await h.completeJob(jobId, driverId, { fare: '42.50' });
  assert.equal(complete.body.ok, true, JSON.stringify(complete.body));

  const trace = await h.poll(
    jobId,
    (t) => t.jobStore?.closedFound === true || !t.jobStore?.found,
    { timeoutMs: 30000 },
  );
  assert.ok(trace.jobStore?.closedFound || !trace.jobStore?.found);

  const staleActive = { id: jobId, status: 'Active', pickAddress: 'Should not linger' };
  markCompletedJobSuppress(jobId);
  const merged = mergeStoreWithFirebaseCaches([staleActive], new Map(), new Map());
  assert.equal(merged.length, 0, 'completed job must not reappear on Active when Firebase nodes are gone');
  clearCompletedJobSuppress(jobId);
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
