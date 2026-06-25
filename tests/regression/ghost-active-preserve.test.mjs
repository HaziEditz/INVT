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

test('ghost Active card: completed suppress drops Active ghost with passenger data', () => {
  const pending = new Map();
  const bookings = new Map();
  const completed = { id: 8692606213, status: 'Active', pickAddress: 'Done St' };
  const live = { id: 8692606214, status: 'Active', pickAddress: 'Live St' };

  bookings.set(live.id, live);
  markCompletedJobSuppress(8692606213);

  assert.equal(
    shouldPreserveAbsentStoreJob(completed, pending, bookings),
    false,
    'completed-suppressed Active ghost must drop when absent from both caches',
  );

  const merged = mergeStoreWithFirebaseCaches([completed, live], pending, bookings);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, live.id);
  clearCompletedJobSuppress(8692606213);
});

test('ghost Active card: terminal Completed status never preserved on live tabs', () => {
  const pending = new Map();
  const bookings = new Map();
  const job = { id: 100, status: 'Completed', pickAddress: 'x' };
  assert.equal(shouldPreserveAbsentStoreJob(job, pending, bookings), false);
});

test('ghost Active card: Assigned job with real booking data stays preserved', () => {
  clearOptimisticLiveTransition(200);
  const pending = new Map();
  const bookings = new Map();
  const job = { id: 200, status: 'Assigned', pickAddress: 'Race Ave', passengerName: 'Pat' };

  assert.equal(shouldPreserveAbsentStoreJob(job, pending, bookings), true);
  markOptimisticLiveTransition(200);
  assert.equal(shouldPreserveAbsentStoreJob(job, pending, bookings), true);
});

test('ghost Active card: completed suppress blocks stale Active re-inject', () => {
  const pending = new Map();
  const bookings = new Map();
  const job = { id: 400, status: 'Active', pickAddress: 'Done St' };
  markCompletedJobSuppress(400);
  assert.equal(shouldPreserveAbsentStoreJob(job, pending, bookings), false);
  clearCompletedJobSuppress(400);
});

test('ghost Active card: stale empty U-A ghosts are not preserved when absent from caches', () => {
  const pending = new Map();
  const bookings = new Map();
  const stale = {
    id: 300,
    status: 'Pending',
    createdAt: Date.now() - 25 * 60 * 60 * 1000,
  };
  assert.equal(shouldPreserveAbsentStoreJob(stale, pending, bookings), false);
});

test('ghost Active card: stale U-A with real address is preserved when absent from caches', () => {
  const pending = new Map();
  const bookings = new Map();
  const stale = {
    id: 302,
    status: 'Pending',
    pickAddress: 'Pool Rd',
    createdAt: Date.now() - 25 * 60 * 60 * 1000,
  };
  assert.equal(shouldPreserveAbsentStoreJob(stale, pending, bookings), true);
});

test('ghost Active card: recent U-A pool jobs preserved when absent from caches', () => {
  const pending = new Map();
  const bookings = new Map();
  const recent = {
    id: 301,
    status: 'Pending',
    pickAddress: 'Pool Rd',
    createdAt: Date.now() - 60_000,
  };
  assert.equal(shouldPreserveAbsentStoreJob(recent, pending, bookings), true);
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
