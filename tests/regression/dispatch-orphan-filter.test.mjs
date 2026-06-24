import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DISPATCH_POOL_MAX_AGE_MS,
  isDispatchPoolRowLive,
  recordActivityMs,
  shouldPreserveAbsentStoreJob,
} from '../lib/jobPoolSync.mjs';

const now = Date.parse('2026-06-21T12:00:00.000Z');
const dayAgo = now - DISPATCH_POOL_MAX_AGE_MS - 60_000;
const recent = now - 60_000;

test('dispatch orphan filter: stale allbookings Pending without pendingjobs is not live', () => {
  const pending = new Map();
  const rec = {
    BookingStatus: 'Pending',
    createdAt: dayAgo,
  };
  assert.equal(isDispatchPoolRowLive(8692606001, rec, pending, now), false);
});

test('dispatch orphan filter: recent Queued allbookings row is live without pendingjobs', () => {
  const pending = new Map();
  const rec = {
    BookingStatus: 'Queued',
    lastUpdatedAt: new Date(recent).toISOString(),
  };
  assert.equal(isDispatchPoolRowLive(8692606002, rec, pending, now), true);
});

test('dispatch orphan filter: stale pendingjobs row is not live without recent activity', () => {
  const pending = new Map([
    [8692606003, { id: 8692606003, status: 'Pending', createdAt: dayAgo }],
  ]);
  const rec = { BookingStatus: 'Pending', createdAt: dayAgo };
  assert.equal(isDispatchPoolRowLive(8692606003, rec, pending, now), false);
});

test('dispatch orphan filter: recent pendingjobs row is live', () => {
  const pending = new Map([
    [8692606004, { id: 8692606004, status: 'Pending', createdAt: recent }],
  ]);
  const rec = { BookingStatus: 'Pending', createdAt: recent };
  assert.equal(isDispatchPoolRowLive(8692606004, rec, pending, now), true);
});

test('dispatch orphan filter: recordActivityMs picks newest timestamp field', () => {
  const ms = recordActivityMs({
    createdAt: dayAgo,
    lastUpdatedAt: new Date(recent).toISOString(),
  });
  assert.equal(ms, recent);
});

test('dispatch orphan filter: absent store job with stale createdAt is not preserved', () => {
  const pending = new Map();
  const bookings = new Map();
  const job = { id: 500, status: 'Queued', createdAt: dayAgo };
  assert.equal(shouldPreserveAbsentStoreJob(job, pending, bookings, now), false);
});
