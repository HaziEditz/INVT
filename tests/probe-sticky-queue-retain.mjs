/**
 * Recall pool-restore must not stick on Queue; stale Pending (older seq) still retained.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { retainQueuedOptimisticAfterServerMerge, jobTabForStatus } = await import(
  '../src/lib/jobStatusAuthority.ts'
);

test('recall pool-restore: newer Pending + unassigned → U-A (not sticky Queued)', () => {
  const optimistic = {
    id: '2608066',
    status: 'Queued',
    driverId: '9002',
    vehicleId: '9002',
    serviceType: 'Taxi',
    companyId: 'bwtest',
    pickup: 'a',
    dropoff: 'b',
    passengerName: 't',
    createdAt: new Date(),
    updateSeq: 2,
  };
  const recalled = {
    ...optimistic,
    status: 'Pending',
    driverId: '0',
    vehicleId: '',
    updateSeq: 3,
  };
  const out = retainQueuedOptimisticAfterServerMerge(optimistic, recalled);
  assert.equal(out.status, 'Pending');
  assert.equal(String(out.driverId), '0');
  assert.equal(jobTabForStatus(out), 'ua');
});

test('stale Pending (older seq) still retained as Queued', () => {
  const optimistic = {
    id: '2608066',
    status: 'Queued',
    driverId: '9002',
    vehicleId: '9002',
    serviceType: 'Taxi',
    companyId: 'bwtest',
    pickup: 'a',
    dropoff: 'b',
    passengerName: 't',
    createdAt: new Date(),
    updateSeq: 5,
  };
  const stale = { ...optimistic, status: 'Pending', driverId: '0', updateSeq: 4 };
  const out = retainQueuedOptimisticAfterServerMerge(optimistic, stale);
  assert.equal(out.status, 'Queued');
  assert.equal(jobTabForStatus(out), 'queue');
});
