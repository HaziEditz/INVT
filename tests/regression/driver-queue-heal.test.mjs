import test from 'node:test';
import assert from 'node:assert/strict';
import { driverQueueEntryIsStale, DRIVER_QUEUE_MAX_AGE_MS } from '../lib/driverQueueHeal.mjs';

test('driverQueue heal: expired TTL is stale', () => {
  const now = Date.now();
  const rec = { queuedAt: now - DRIVER_QUEUE_MAX_AGE_MS - 1, BookingId: 8692606212 };
  const r = driverQueueEntryIsStale(rec, { BookingStatus: 'Queued', DriverId: 'D002' }, 'D002', now);
  assert.equal(r.stale, true);
  assert.equal(r.reason, 'expired_ttl');
});

test('driverQueue heal: missing allbookings is stale', () => {
  const now = Date.now();
  const rec = { queuedAt: now - 60_000, BookingId: 8692606212 };
  const r = driverQueueEntryIsStale(rec, null, 'D002', now);
  assert.equal(r.stale, true);
  assert.equal(r.reason, 'allbookings_missing');
});

test('driverQueue heal: completed allbookings is stale', () => {
  const now = Date.now();
  const rec = { queuedAt: now - 60_000, BookingId: 8692606212 };
  const r = driverQueueEntryIsStale(rec, { BookingStatus: 'Completed' }, 'D002', now);
  assert.equal(r.stale, true);
  assert.equal(r.reason, 'allbookings_Completed');
});

test('driverQueue heal: live queued row is kept', () => {
  const now = Date.now();
  const rec = { queuedAt: now - 60_000, BookingId: 8692606212 };
  const r = driverQueueEntryIsStale(rec, { BookingStatus: 'Queued', DriverId: 'D002' }, 'D002', now);
  assert.equal(r.stale, false);
});
