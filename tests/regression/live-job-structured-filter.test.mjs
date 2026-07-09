import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_LIVE_JOB_FILTERS,
  filterJobsForTab,
  filterLiveJobs,
  hasActiveLiveJobFilters,
  makeTestJob,
} from '../lib/liveJobFilters.mjs';

test('Phase 2 live filters: service type and status narrow results', () => {
  const jobs = [
    makeTestJob({ id: 1, status: 'Pending', serviceType: 'taxi' }),
    makeTestJob({ id: 2, status: 'Assigned', serviceType: 'tm', driverId: '9001' }),
    makeTestJob({ id: 3, status: 'Offered', serviceType: 'food', driverId: '9002' }),
  ];

  assert.equal(hasActiveLiveJobFilters(EMPTY_LIVE_JOB_FILTERS), false);

  const tmOnly = filterLiveJobs(jobs, { ...EMPTY_LIVE_JOB_FILTERS, serviceType: 'tm' });
  assert.deepEqual(tmOnly.map((j) => j.id), [2]);

  const offered = filterLiveJobs(jobs, { ...EMPTY_LIVE_JOB_FILTERS, status: 'Offered' });
  assert.deepEqual(offered.map((j) => j.id), [3]);
});

test('Phase 2 live filters: driver and job type apply across tabs', () => {
  const jobs = [
    makeTestJob({ id: 10, status: 'Pending', driverId: '0', bookingType: 'ASAP' }),
    makeTestJob({
      id: 11,
      status: 'Assigned',
      driverId: '9000',
      bookingType: 'SCHEDULED',
      scheduledFor: Date.now() + 3_600_000,
    }),
    makeTestJob({ id: 12, status: 'Queued', driverId: '0', queuedForDriverId: '9000' }),
  ];

  const byDriver = filterLiveJobs(jobs, { ...EMPTY_LIVE_JOB_FILTERS, driverId: '9000' });
  assert.ok(byDriver.some((j) => j.id === 11));
  assert.ok(byDriver.some((j) => j.id === 12));
  assert.equal(byDriver.some((j) => j.id === 10), false);

  const later = filterLiveJobs(jobs, { ...EMPTY_LIVE_JOB_FILTERS, jobType: 'LATER' });
  assert.deepEqual(later.map((j) => j.id), [11]);

  const assignTab = filterJobsForTab(jobs, 'assign', { ...EMPTY_LIVE_JOB_FILTERS, driverId: '9000' });
  assert.deepEqual(assignTab.map((j) => j.id), [11]);

  const queueTab = filterJobsForTab(jobs, 'queue', { ...EMPTY_LIVE_JOB_FILTERS, driverId: '9000' });
  assert.deepEqual(queueTab.map((j) => j.id), [12]);
});

test('Phase 2 live filters: zone id matches explicit job zone', () => {
  const jobs = [
    makeTestJob({ id: 20, zoneId: 'zone-a' }),
    makeTestJob({ id: 21, zoneId: 'zone-b' }),
  ];
  const zones = [{ id: 'zone-a', zoneNumber: 1, name: 'Central', active: true, boundary: [] }];
  const filtered = filterLiveJobs(jobs, { ...EMPTY_LIVE_JOB_FILTERS, zoneId: 'zone-a' }, zones);
  assert.deepEqual(filtered.map((j) => j.id), [20]);
});
