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

/** Mirrors src/lib/closedJobs.ts closedJobPaymentDisplay account branch. */
function closedJobPaymentDisplay(job, raw) {
  const payment = String(job.paymentType || '').trim();
  const accountName = String(
    job.accountName ||
      raw?.Account_Name ||
      raw?.AccountName ||
      raw?.jobAccountName ||
      raw?.accountName ||
      '',
  ).trim();
  const label =
    accountName && (/account/i.test(payment) || !payment)
      ? `${payment || 'Account'} · ${accountName}`
      : payment;
  return label || '—';
}

/** Mirrors /api/driver/search-accounts + [searchmulti] business match rules. */
function businessAccountMatchesQuery(b, rawQ) {
  const q = String(rawQ || '').toLowerCase().trim();
  if (!q) return true;
  const name = String(b.name || '').toLowerCase();
  const phone = String(b.phone || '');
  const id = String(b.id || '');
  const code = String(b.accountCode || b.AccountCode || '').toLowerCase();
  const qNum = parseInt(q, 10);
  return (
    name.includes(q) ||
    phone.includes(q) ||
    id.toLowerCase().includes(q) ||
    (code && code.includes(q)) ||
    (qNum > 0 && (b.id === qNum || id === String(qNum)))
  );
}

test('closedJobPaymentDisplay shows Account · business name', () => {
  assert.equal(
    closedJobPaymentDisplay(
      { paymentType: 'Account', accountName: 'Invercargill taxis' },
      {},
    ),
    'Account · Invercargill taxis',
  );
  assert.equal(
    closedJobPaymentDisplay({ paymentType: 'Account' }, { Account_Name: 'Acme Co' }),
    'Account · Acme Co',
  );
  assert.equal(closedJobPaymentDisplay({ paymentType: 'Cash' }, {}), 'Cash');
});

test('business account search matches id case-insensitively and by accountCode', () => {
  const row = {
    id: '-OUNEPJIYVKHAAC6CFTN',
    name: 'Invercargill taxis',
    accountCode: 'INV1',
  };
  assert.equal(businessAccountMatchesQuery(row, '-ounepjiyvkhaac6cftn'), true);
  assert.equal(businessAccountMatchesQuery(row, 'INV1'), true);
  assert.equal(businessAccountMatchesQuery(row, 'inv1'), true);
  assert.equal(businessAccountMatchesQuery(row, 'taxis'), true);
  assert.equal(businessAccountMatchesQuery({ id: 42, name: 'Num Co' }, '42'), true);
  assert.equal(businessAccountMatchesQuery(row, 'nope'), false);
});

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

test('complete fanout persists Account_id / Account_Name / PaymentMethod', async () => {
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

  const create = await post(
    '/api/job/create',
    {
      companyId: TEST_CID,
      source: 'hail',
      driverId,
      vehicleId: driverId,
      tariffId: 'regtest-tariff',
      clientTripId: randomUUID(),
      pickup: {
        address: '4 Dee St, Invercargill',
        lat: -46.4121,
        lng: 168.3531,
      },
      dropoff: {
        address: '5 Dee St, Invercargill',
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

  const accountId = 'acct-regtest-1';
  const accountName = 'Regtest Business Account';
  const complete = await post(
    '/api/job/complete',
    {
      jobId,
      bookingId: jobId,
      driverId,
      companyId: TEST_CID,
      fare: 12,
      paymentType: 'Account',
      payload: {
        fare: 12,
        paymentType: 'Account',
        PaymentMethod: 'Account',
        PaymentType: 'Account',
        Account_id: accountId,
        Account_Name: accountName,
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
      String(v.Account_id || v.AccountId || '') === accountId &&
      /Account/i.test(String(v.PaymentMethod || v.paymentMethod || v.PaymentType || '')),
    { timeoutMs: 20_000 },
  );
  assert.equal(String(node.Account_id || node.AccountId || ''), accountId);
  assert.equal(String(node.Account_Name || node.AccountName || ''), accountName);
  assert.match(String(node.PaymentMethod || node.paymentMethod || ''), /Account/i);
});

test('driver search-accounts requires auth and returns accounts array', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);
  const driverId = String(h.driverIds[0]);
  await h.ensureDriverReady(driverId);

  const unauthorized = await post(
    '/api/driver/search-accounts',
    { query: 'taxi' },
    { 'Content-Type': 'application/json' },
  );
  assert.equal(unauthorized.status, 401);

  const withAdmin = await post(
    '/api/driver/search-accounts',
    { query: 'a', driverId },
    { 'Content-Type': 'application/json', ...h.adminHeaders },
  );
  assert.equal(withAdmin.status, 200, JSON.stringify(withAdmin.body));
  assert.equal(withAdmin.body?.ok, true);
  assert.ok(Array.isArray(withAdmin.body?.accounts));
});

test('OPTIONS preflight allows Authorization and X-User-Key for driver APIs', async () => {
  const { httpRequest } = await import('../lib/http.mjs');
  const res = await httpRequest('OPTIONS', '/api/driver/search-accounts', {
    headers: {
      Origin: 'http://localhost:8081',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,authorization,x-user-key',
    },
  });
  assert.ok(res.status === 204 || res.status === 200, `status=${res.status}`);
  const allow = String(
    res.headers?.['access-control-allow-headers'] ||
      res.headers?.['Access-Control-Allow-Headers'] ||
      '',
  ).toLowerCase();
  assert.match(allow, /authorization/);
  assert.match(allow, /x-user-key/);
});

test('complete fanout maps finalDropAddress to DropAddress', async () => {
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

  const create = await post(
    '/api/job/create',
    {
      companyId: TEST_CID,
      source: 'hail',
      driverId,
      vehicleId: driverId,
      tariffId: 'regtest-tariff',
      clientTripId: randomUUID(),
      pickup: {
        address: '6 Dee St, Invercargill',
        lat: -46.4121,
        lng: 168.3531,
      },
      dropoff: {
        address: '',
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

  const drop = '99 Esk St, Invercargill';
  const complete = await post(
    '/api/job/complete',
    {
      jobId,
      bookingId: jobId,
      driverId,
      companyId: TEST_CID,
      fare: 8,
      payload: {
        fare: 8,
        finalDropAddress: drop,
        DropAddress: drop,
        VehicleType: 'Van',
        stepTimes: { hailStartedAt: Date.now() - 10_000, completeAt: Date.now() },
        fareBreakdown: { flagFall: 3, total: 8 },
      },
    },
    { 'Content-Type': 'application/json' },
  );
  assert.equal(complete.status, 200, JSON.stringify(complete.body));

  const node = await pollFirebasePeek(
    `allbookings/${TEST_CID}/${jobId}`,
    (v) =>
      v &&
      String(v.DropAddress || v.dropAddress || v.dropoff || '') === drop,
    { timeoutMs: 20_000 },
  );
  assert.equal(String(node.DropAddress || node.dropAddress || ''), drop);
});

test('complete fanout restores createdAt + timeline mirrors from stepTimes', async () => {
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

  const create = await post(
    '/api/job/create',
    {
      companyId: TEST_CID,
      source: 'hail',
      driverId,
      vehicleId: driverId,
      tariffId: 'regtest-tariff',
      clientTripId: randomUUID(),
      vehicleType: 'Taxi',
      pickup: {
        address: '10 Dee St, Invercargill',
        lat: -46.4121,
        lng: 168.3531,
      },
      dropoff: {
        address: '11 Dee St, Invercargill',
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

  const acceptedAt = Date.now() - 120_000;
  const arrivedAt = Date.now() - 60_000;
  const onboardAt = Date.now() - 50_000;
  const completeAt = Date.now();
  const createdAt = Date.now() - 180_000;
  const complete = await post(
    '/api/job/complete',
    {
      jobId,
      bookingId: jobId,
      driverId,
      companyId: TEST_CID,
      fare: 9,
      payload: {
        fare: 9,
        createdAt,
        VehicleType: 'Taxi',
        DropAddress: '11 Dee St, Invercargill',
        stepTimes: { acceptedAt, arrivedAt, onboardAt, completeAt },
        fareBreakdown: {
          flagFall: 3.5,
          distanceKm: 1,
          waitingMinutes: 0.5,
          waitingCharge: 0.4,
          distanceCharge: 2,
          total: 9,
        },
      },
    },
    { 'Content-Type': 'application/json' },
  );
  assert.equal(complete.status, 200, JSON.stringify(complete.body));

  const node = await pollFirebasePeek(
    `allbookings/${TEST_CID}/${jobId}`,
    (v) =>
      v &&
      v.stepTimes &&
      (v.DriverAcceptedAt || v.driverAcceptedAt) &&
      (v.fareBreakdown || v.FareBreakdown) &&
      String(v.VehicleType || v.vehicleType || '') === 'Taxi',
    { timeoutMs: 20_000 },
  );
  assert.ok(node.stepTimes && typeof node.stepTimes === 'object');
  assert.ok(String(node.DriverAcceptedAt || node.driverAcceptedAt || ''));
  assert.ok(String(node.OnBoardAt || node.onBoardAt || node.ActiveAt || ''));
  assert.equal(String(node.VehicleType || node.vehicleType || ''), 'Taxi');
  const fb = node.fareBreakdown || node.FareBreakdown;
  assert.equal(Number(fb.total ?? fb.Total), 9);
});

test('idempotent complete still fans out fareBreakdown after sparse archive', async () => {
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

  const create = await post(
    '/api/job/create',
    {
      companyId: TEST_CID,
      source: 'hail',
      driverId,
      vehicleId: driverId,
      tariffId: 'regtest-tariff',
      clientTripId: randomUUID(),
      vehicleType: 'Van',
      pickup: {
        address: '7 Dee St, Invercargill',
        lat: -46.4121,
        lng: 168.3531,
      },
      dropoff: {
        address: '8 Dee St, Invercargill',
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

  // First complete (sparse — no meter/timeline), then enriching re-complete.
  const first = await post(
    '/api/job/complete',
    {
      jobId,
      bookingId: jobId,
      driverId,
      companyId: TEST_CID,
      fare: 5,
      payload: { fare: 5, paymentType: 'Cash' },
    },
    { 'Content-Type': 'application/json' },
  );
  assert.equal(first.status, 200, JSON.stringify(first.body));

  const fareBreakdown = {
    flagFall: 3.5,
    distanceKm: 2,
    waitingMinutes: 1,
    waitingCharge: 0.5,
    distanceCharge: 3,
    total: 7,
  };
  const stepTimes = {
    hailStartedAt: Date.now() - 30_000,
    onboardAt: Date.now() - 30_000,
    completeAt: Date.now(),
  };
  const second = await post(
    '/api/job/complete',
    {
      jobId,
      bookingId: jobId,
      driverId,
      companyId: TEST_CID,
      fare: 7,
      payload: {
        fare: 7,
        fareBreakdown,
        FareBreakdown: fareBreakdown,
        stepTimes,
        VehicleType: 'Van',
        finalDropAddress: '8 Dee St, Invercargill',
        DropAddress: '8 Dee St, Invercargill',
      },
    },
    { 'Content-Type': 'application/json' },
  );
  assert.equal(second.status, 200, JSON.stringify(second.body));
  assert.equal(second.body?.ok, true);
  assert.equal(second.body?.idempotent, true);

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
  assert.equal(Number(fb.total ?? fb.Total), 7);
  assert.ok(node.stepTimes && typeof node.stepTimes === 'object');
  assert.equal(String(node.VehicleType || node.vehicleType || ''), 'Van');
});
