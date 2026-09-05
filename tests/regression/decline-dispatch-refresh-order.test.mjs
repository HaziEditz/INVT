/**
 * #8692609053 — decline must signal dispatchConsole refresh BEFORE Firebase pool fanout
 * so dispatch leaves Offered → U-A immediately (not after allbookings/pendingjobs await).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireFirebaseSecret, ADMIN_KEY } from '../lib/config.mjs';
import { post } from '../lib/http.mjs';
import { getHarness, prepareCleanDispatch } from '../lib/harness.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const src = readFileSync(join(root, 'server.js'), 'utf8');

test('driverDeclineJob signals dispatch refresh before pool Firebase fanout', () => {
  const fnStart = src.indexOf('async function driverDeclineJob');
  assert.ok(fnStart >= 0, 'driverDeclineJob missing');
  const fnEnd = src.indexOf('\nasync function ', fnStart + 10);
  const body = src.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 8000);
  const refreshIdx = body.indexOf('await _dispatchRefreshForJob');
  const fanoutIdx = body.indexOf('await _releaseOfferToPoolFirebase');
  assert.ok(refreshIdx >= 0, 'decline refresh missing');
  assert.ok(fanoutIdx >= 0, 'decline pool fanout missing');
  assert.ok(
    refreshIdx < fanoutIdx,
    'decline must refresh dispatchConsole before awaiting _releaseOfferToPoolFirebase (#9053)',
  );
});

test('soft-stale sole offer skips mid-offer network bounce until hard stale', () => {
  assert.match(src, /job\._softStaleSoleOffer/);
  assert.match(
    src,
    /if \(job\._softStaleSoleOffer\)[\s\S]*?NETWORK_OFFER_HARD_STALE_MS/,
  );
});

test('decline → Pending refresh hits dispatchConsole before Offered is cleared in FB', async () => {
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

  const jobId = await h.createAsapJob('decline-refresh-order');
  let assignRes = await h.assignJob(jobId, driverId, driverId);
  if (assignRes.body?.error_code === 'driver_not_in_zone') {
    await h.ensureDriverReady(driverId);
    assignRes = await h.assignJob(jobId, driverId, driverId);
  }
  assert.equal(assignRes.body?.ok, true, JSON.stringify(assignRes.body));
  await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered',
    { timeoutMs: 20000 },
  );

  const t0 = Date.now();
  const declineRes = await post(
    '/api/job/decline',
    { bookingId: jobId, driverId, timedOut: false },
    { 'X-Admin-Key': ADMIN_KEY },
  );
  assert.equal(declineRes.body?.ok, true, JSON.stringify(declineRes.body));

  // jobStore must already be Pending when the decline API returns (before client polls FB).
  const after = await h.jobTrace(jobId);
  const st = String(
    after.jobStore?.lifecycle?.BookingStatus ||
      after.jobStore?.rawFlags?.BookingStatus ||
      '',
  );
  assert.equal(st, 'Pending', `expected Pending immediately after decline, got ${st}`);
  const reason = String(
    after.jobStore?.lifecycle?.returnReason ||
      after.jobStore?.rawFlags?.returnReason ||
      '',
  );
  assert.match(reason, /Declined by driver/i);

  // dispatchConsole refresh should already show decline/Pending (may race overwrite — poll briefly).
  let refreshOk = false;
  for (let i = 0; i < 12; i++) {
    const refresh = await h.firebasePeek(`dispatchConsole/${h.companyId}/refresh`);
    if (
      refresh &&
      Number(refresh.bookingId) === Number(jobId) &&
      String(refresh.action || '') === 'decline' &&
      String(refresh.status || '') === 'Pending'
    ) {
      refreshOk = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  assert.ok(refreshOk, 'expected dispatchConsole/refresh decline→Pending after decline');
  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 8000, `decline path too slow (${elapsed}ms)`);

  await h.mutateJobStore(jobId, {
    BookingStatus: 'Cancelled',
    DriverId: 0,
    VehicleId: 0,
    offeredAt: null,
    manualOffer: false,
  }).catch(() => undefined);
  await h.cleanupAll().catch(() => undefined);
});
