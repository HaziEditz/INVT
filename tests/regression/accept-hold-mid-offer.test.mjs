/**
 * #8692609081 — genuine accept must not be bounced by mid-offer 10s lastSeen
 * or silently reset Offered by leftover pendingjobs sync.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { getHarness, prepareCleanDispatch } from '../lib/harness.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const src = readFileSync(join(root, 'server.js'), 'utf8');

test('source: leftover Offered Firebase cannot downgrade Assigned', () => {
  assert.match(src, /function _fbMustNotDowngradeAccepted/);
  assert.match(src, /_POST_ACCEPT_LIVE_STATUSES/);
  const mergeStart = src.indexOf('function _mergeFbIntoJob');
  assert.ok(mergeStart >= 0);
  const mergeEnd = src.indexOf('\nfunction ', mergeStart + 10);
  const merge = src.slice(mergeStart, mergeEnd > mergeStart ? mergeEnd : mergeStart + 2500);
  assert.match(merge, /protectAccepted/);
  assert.match(merge, /_fbMustNotDowngradeAccepted/);
});

test('source: mid-offer 10s heal skips genuine accept', () => {
  assert.match(src, /ACCEPT HOLDS mid-offer skip/);
  assert.match(
    src,
    /function _isDriverMidOfferNetworkStale[\s\S]{0,400}_jobHasAcceptStamp\(job\)\) return false/,
  );
  assert.match(src, /#9063: allbookings\/pendingjobs Offered MUST land before notification/);
});

test('accepted job stays Assigned when leftover pendingjobs Offered is synced', async () => {
  requireFirebaseSecret();
  const h = await getHarness({ fresh: true });
  await prepareCleanDispatch(h);
  const driverId = String(h.driverIds[0]);
  await h.ensureDriverReady(driverId);
  await h.configureDriver(driverId, {
    vehiclestatus: 'Available',
    lastSeen: Date.now(),
    lat: -46.412,
    lng: 168.353,
  });

  const jobId = await h.createAsapJob('accept-hold-pendingjobs');
  const assignRes = await h.assignJob(jobId, driverId, driverId);
  assert.equal(assignRes.body?.ok, true, JSON.stringify(assignRes.body));
  const accept = await h.acceptJob(jobId, driverId);
  assert.equal(accept.status, 200, JSON.stringify(accept.body));
  assert.equal(accept.body?.status, 'Assigned');

  await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Assigned',
    { timeoutMs: 25000 },
  );

  await h.setFirebaseBooking(
    jobId,
    { BookingStatus: 'Offered', Status: 'Offered', DriverId: driverId, offeredAt: Date.now() - 20_000 },
    h.companyId,
    { alsoPending: true },
  );
  await h.setFirebaseBooking(jobId, {
    BookingStatus: 'Assigned',
    Status: 'Assigned',
    DriverId: driverId,
  });

  const sync = await h.repairBooking(jobId, 'pendingjobs-sync');
  assert.equal(sync.status, 200, JSON.stringify(sync.body));
  assert.equal(sync.body?.sync?.ok, true, JSON.stringify(sync.body));
  assert.ok(
    Number(sync.body?.sync?.updated || 0) >= 1,
    `pendingjobs-sync must visit leftover Offered row: ${JSON.stringify(sync.body)}`,
  );

  const after = await h.jobTrace(jobId);
  assert.equal(
    String(after.jobStore?.lifecycle?.BookingStatus || ''),
    'Assigned',
    `leftover pendingjobs Offered must not clobber Assigned: ${JSON.stringify(after.jobStore?.lifecycle)}`,
  );
  assert.notEqual(String(after.jobStore?.lifecycle?.returnReason || ''), 'Network issue — driver unreachable');
});

test('accepted job is not network-bounced when jobStore is falsely Offered and lastSeen is >10s', async () => {
  requireFirebaseSecret();
  const h = await getHarness({ fresh: true });
  await prepareCleanDispatch(h);
  const driverId = String(h.driverIds[0]);
  await h.ensureDriverReady(driverId);
  await h.configureDriver(driverId, {
    vehiclestatus: 'Available',
    lastSeen: Date.now(),
    lat: -46.412,
    lng: 168.353,
  });

  const jobId = await h.createAsapJob('accept-hold-mid-offer');
  const assignRes = await h.assignJob(jobId, driverId, driverId);
  assert.equal(assignRes.body?.ok, true, JSON.stringify(assignRes.body));
  const accept = await h.acceptJob(jobId, driverId);
  assert.equal(accept.status, 200, JSON.stringify(accept.body));

  await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Assigned',
    { timeoutMs: 25000 },
  );

  await h.mutateJobStore(jobId, {
    BookingStatus: 'Offered',
    offeredAt: Date.now() - 25_000,
  });
  await h.configureDriver(driverId, {
    vehiclestatus: 'Assigned',
    lastSeen: Date.now() - 12_000,
  });

  await h.triggerAutoDispatch();
  await h.triggerAutoDispatch();

  const after = await h.jobTrace(jobId);
  const st = String(after.jobStore?.lifecycle?.BookingStatus || '');
  assert.equal(
    st,
    'Assigned',
    `mid-offer 10s heal must not bounce an accepted job; got ${JSON.stringify(after.jobStore?.lifecycle)}`,
  );
});
