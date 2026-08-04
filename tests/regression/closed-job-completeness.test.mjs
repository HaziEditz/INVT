/**
 * Closed Job completeness + UA Account payment badge (pure logic + hail create).
 */
import '../lib/loadEnv.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { TEST_CID, requireFirebaseSecret } from '../lib/config.mjs';
import { post } from '../lib/http.mjs';
import { getHarness, prepareCleanDispatch } from '../lib/harness.mjs';
import { pollFirebasePeek } from '../lib/jobTrace.mjs';

/** Mirrors src/lib/utils.ts jobPaymentBadgeLabel + paymentLabel. */
function paymentLabel(type) {
  const t = (type || 'cash').toUpperCase();
  if (t.includes('STRIPE')) return 'CARD';
  return t.split(/[\s/]/)[0].slice(0, 12);
}

function jobPaymentBadgeLabel(job) {
  const hasAccount = Boolean(String(job.accountId || '').trim());
  const pt = String(job.paymentType || '').trim();
  if (hasAccount || /account/i.test(pt)) {
    return paymentLabel(pt || 'Account');
  }
  return paymentLabel(pt);
}

/** Mirrors src/lib/closedJobDetail.ts parseClosedFareBreakdown (PascalCase). */
function parseClosedFareBreakdown(raw) {
  const fb = raw.fareBreakdown ?? raw.FareBreakdown;
  if (fb && typeof fb === 'object') {
    const o = fb;
    const parsed = {
      flagFall: num(o.flagFall ?? o.FlagFall),
      distanceKm: num(o.distanceKm ?? o.DistanceKm),
      waitingMinutes: num(o.waitingMinutes ?? o.WaitingMinutes),
      waitingCharge: num(o.waitingCharge ?? o.WaitingCharge ?? o.waitingCost),
      distanceCharge: num(o.distanceCharge ?? o.DistanceCharge ?? o.RideCost),
      total: num(o.total ?? o.Total ?? o.totalFare ?? o.TotalFare),
    };
    if (Object.values(parsed).some((v) => v != null)) return parsed;
  }
  return null;
}

function num(v) {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isNaN(n) ? undefined : n;
}

/** Mirrors hail timeline key mapping from closedJobTimeline. */
function hailTimelineKeys(step) {
  return {
    onboard: step.onboardAt ?? step.hailStartedAt,
    completed: step.completeAt ?? step.hailEndedAt,
    hailStarted: step.hailStartedAt,
  };
}

test('UA badge: Account job shows ACCOUNT not raw Firebase account id', () => {
  const label = jobPaymentBadgeLabel({
    accountId: '-OUNEPJIYVKHAAC6CFTN',
    paymentType: 'Account',
  });
  assert.equal(label, 'ACCOUNT');
  assert.doesNotMatch(label, /OUNEPJIYVKHAAC6CFTN/i);
});

test('UA badge: accountId alone still shows ACCOUNT (paymentType empty)', () => {
  assert.equal(jobPaymentBadgeLabel({ accountId: '-Os7EhxblNgbMg2B0D6G' }), 'ACCOUNT');
});

test('UA badge: cash unchanged', () => {
  assert.equal(jobPaymentBadgeLabel({ paymentType: 'Cash' }), 'CASH');
});

test('parseClosedFareBreakdown accepts FareBreakdown PascalCase mirror', () => {
  const parsed = parseClosedFareBreakdown({
    FareBreakdown: {
      flagFall: 3.5,
      distanceKm: 2.1,
      waitingMinutes: 1,
      waitingCharge: 0.8,
      distanceCharge: 4.2,
      total: 8.5,
    },
  });
  assert.ok(parsed);
  assert.equal(parsed.flagFall, 3.5);
  assert.equal(parsed.total, 8.5);
  assert.equal(parsed.distanceCharge, 4.2);
});

test('hail timeline keys map hailStartedAt/onboardAt/hailEndedAt', () => {
  const keys = hailTimelineKeys({
    hailStartedAt: 1000,
    onboardAt: 1000,
    hailEndedAt: 2000,
  });
  assert.equal(keys.hailStarted, 1000);
  assert.equal(keys.onboard, 1000);
  assert.equal(keys.completed, 2000);
});

test.before(async () => {
  await getHarness({ fresh: true });
});

test('hail create persists VehicleType from body onto job + allbookings', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);
  const driverId = String(h.driverIds[0]);
  await h.ensureDriverReady(driverId);
  await h.configureDriver(driverId, {
    vehiclestatus: 'Available',
    lastSeen: Date.now(),
    lat: -46.4121,
    lng: 168.3531,
    vehicletype: 'WAV',
  });

  const clientTripId = randomUUID();
  const res = await post(
    '/api/job/create',
    {
      companyId: TEST_CID,
      source: 'hail',
      driverId,
      vehicleId: driverId,
      tariffId: 'regtest-tariff',
      clientTripId,
      vehicleType: 'Sedan',
      pickup: {
        address: '1 Dee St, Invercargill',
        lat: -46.4121,
        lng: 168.3531,
      },
      dropoff: {
        address: '1 Dee St, Invercargill',
        lat: -46.4121,
        lng: 168.3531,
      },
      passengers: 1,
    },
    { 'Content-Type': 'application/json' },
  );
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const jobId = String(res.body?.jobId ?? res.body?.bookingId ?? '');
  assert.match(jobId, /^\d+$/);

  const ab = await pollFirebasePeek(
    `allbookings/${TEST_CID}/${jobId}`,
    (n) => n && String(n.VehicleType || n.vehicleType || '').trim() === 'Sedan',
    { timeoutMs: 15_000 },
  );
  assert.equal(String(ab.VehicleType || ab.vehicleType || ''), 'Sedan');

  const trace = await h.jobTrace(jobId);
  const storeVt = String(
    trace?.jobStore?.lifecycle?.VehicleType ||
      trace?.jobStore?.lifecycle?.vehicleType ||
      trace?.jobStore?.rawFlags?.VehicleType ||
      trace?.firebase?.allbookings?.VehicleType ||
      '',
  ).trim();
  assert.equal(storeVt, 'Sedan', JSON.stringify(trace?.jobStore?.lifecycle || {}).slice(0, 400));
});

test('complete fanout persists fareBreakdown + stepTimes + VehicleType', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);
  const driverId = String(h.driverIds[0]);
  await h.ensureDriverReady(driverId);
  await h.configureDriver(driverId, {
    vehiclestatus: 'Available',
    lastSeen: Date.now(),
    lat: -46.4121,
    lng: 168.3531,
  });

  const clientTripId = randomUUID();
  const create = await post(
    '/api/job/create',
    {
      companyId: TEST_CID,
      source: 'hail',
      driverId,
      vehicleId: driverId,
      tariffId: 'regtest-tariff',
      clientTripId,
      vehicleType: 'Van',
      pickup: {
        address: '2 Dee St, Invercargill',
        lat: -46.4121,
        lng: 168.3531,
      },
      dropoff: {
        address: '3 Dee St, Invercargill',
        lat: -46.413,
        lng: 168.354,
      },
      passengers: 1,
    },
    { 'Content-Type': 'application/json' },
  );
  assert.equal(create.status, 200, JSON.stringify(create.body));
  const jobId = parseInt(String(create.body?.jobId ?? create.body?.bookingId), 10);
  assert.ok(jobId > 0);

  const fareBreakdown = {
    flagFall: 3.5,
    distanceKm: 1.2,
    waitingMinutes: 0.5,
    waitingCharge: 0.4,
    distanceCharge: 2.1,
    total: 6.0,
  };
  const stepTimes = {
    hailStartedAt: Date.now() - 60_000,
    onboardAt: Date.now() - 60_000,
    hailEndedAt: Date.now(),
    completeAt: Date.now(),
  };

  const complete = await post(
    '/api/job/complete',
    {
      jobId,
      bookingId: jobId,
      driverId,
      companyId: TEST_CID,
      fare: 6,
      totalFare: 6,
      distanceKm: 1.2,
      payload: {
        fare: 6,
        totalFare: 6,
        distanceKm: 1.2,
        fareBreakdown,
        FareBreakdown: fareBreakdown,
        stepTimes,
        VehicleType: 'Van',
        vehicleType: 'Van',
        flagFall: 3.5,
        distanceCharge: 2.1,
        waitingCharge: 0.4,
      },
    },
    { 'Content-Type': 'application/json' },
  );
  assert.equal(complete.status, 200, JSON.stringify(complete.body));
  assert.equal(complete.body?.ok, true, JSON.stringify(complete.body));

  const node = await pollFirebasePeek(
    `allbookings/${TEST_CID}/${jobId}`,
    (v) =>
      v &&
      (v.fareBreakdown || v.FareBreakdown) &&
      v.stepTimes &&
      String(v.VehicleType || v.vehicleType || '') === 'Van',
    { timeoutMs: 20_000 },
  );

  const fb = node.fareBreakdown || node.FareBreakdown;
  assert.ok(fb && typeof fb === 'object', `missing fareBreakdown: ${JSON.stringify(node)}`);
  assert.equal(Number(fb.total ?? fb.Total), 6);
  assert.ok(node.stepTimes && typeof node.stepTimes === 'object', 'missing stepTimes');
  assert.equal(String(node.VehicleType || node.vehicleType || ''), 'Van');
});
