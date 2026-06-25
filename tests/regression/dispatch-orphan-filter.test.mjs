import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DISPATCH_POOL_MAX_AGE_MS,
  isDispatchPoolRowLive,
  isStaleOrphanAllbookingsRow,
  recordActivityMs,
  shouldPreserveAbsentStoreJob,
} from '../lib/jobPoolSync.mjs';

const now = Date.parse('2026-06-21T12:00:00.000Z');
const dayAgo = now - DISPATCH_POOL_MAX_AGE_MS - 60_000;
const recent = now - 60_000;

const emptyGhost = {
  BookingStatus: 'Pending',
  DriverId: '0',
  createdAt: dayAgo,
};

test('dispatch orphan filter: empty unassigned Pending ghost >24h is stale orphan', () => {
  assert.equal(isStaleOrphanAllbookingsRow(emptyGhost, now), true);
  const pending = new Map();
  assert.equal(isDispatchPoolRowLive(8692606001, emptyGhost, pending, now), false);
});

test('dispatch orphan filter: real address Pending >24h is never orphan', () => {
  const rec = {
    BookingStatus: 'Pending',
    DriverId: '0',
    PickupAddress: '1 Dee St, Invercargill',
    createdAt: dayAgo,
  };
  assert.equal(isStaleOrphanAllbookingsRow(rec, now), false);
  assert.equal(isDispatchPoolRowLive(8692606002, rec, new Map(), now), true);
});

test('dispatch orphan filter: Queued with driver and queuedAt is never orphan', () => {
  const rec = {
    BookingStatus: 'Queued',
    DriverId: '9001',
    queuedAt: dayAgo,
    PickupAddress: 'Queue St',
    createdAt: dayAgo,
  };
  assert.equal(isStaleOrphanAllbookingsRow(rec, now), false);
  assert.equal(isDispatchPoolRowLive(8692606003, rec, new Map(), now), true);
});

test('dispatch orphan filter: recent empty ghost is not stale orphan', () => {
  const rec = { ...emptyGhost, createdAt: recent };
  assert.equal(isStaleOrphanAllbookingsRow(rec, now), false);
  assert.equal(isDispatchPoolRowLive(8692606004, rec, new Map(), now), true);
});

test('dispatch orphan filter: scheduled future job is never orphan', () => {
  const rec = {
    BookingStatus: 'Scheduled',
    DriverId: '0',
    PickupAddress: 'Airport',
    BookingDateTime: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: dayAgo,
  };
  assert.equal(isStaleOrphanAllbookingsRow(rec, now), false);
});

test('dispatch orphan filter: recordActivityMs picks newest timestamp field', () => {
  const ms = recordActivityMs({
    createdAt: dayAgo,
    lastUpdatedAt: new Date(recent).toISOString(),
  });
  assert.equal(ms, recent);
});

test('dispatch orphan filter: real booking preserved in store even when stale', () => {
  const pending = new Map();
  const bookings = new Map();
  const job = {
    id: 500,
    status: 'Pending',
    pickAddress: 'Customer Rd',
    driverId: '0',
    createdAt: dayAgo,
  };
  assert.equal(shouldPreserveAbsentStoreJob(job, pending, bookings, now), true);
});
